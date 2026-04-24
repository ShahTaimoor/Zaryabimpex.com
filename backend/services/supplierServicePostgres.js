const supplierRepository = require('../repositories/postgres/SupplierRepository');
const AccountingService = require('./accountingService');
const chartOfAccountsRepository = require('../repositories/postgres/ChartOfAccountsRepository');
const cityRepository = require('../repositories/postgres/CityRepository');

/**
 * Map DB supplier row to API response format (contactPerson, status, businessType, rating)
 */
function mapSupplierForResponse(supplier) {
  if (!supplier) return supplier;
  const contactPersonValue = supplier.contact_person || (supplier.contactPerson && supplier.contactPerson.name) || '';
  const companyName = supplier.company_name ?? supplier.companyName ?? '';
  const businessName = supplier.business_name ?? supplier.businessName ?? '';
  const name = supplier.name || '';
  const displayName = companyName || businessName || name || 'Unknown Supplier';

  return {
    ...supplier,
    companyName,
    businessName,
    displayName,
    email: supplier.email || '',
    phone: supplier.phone || '',
    openingBalance: supplier.opening_balance ?? supplier.openingBalance ?? 0,
    contactPerson: { name: contactPersonValue },
    status: supplier.status ?? (supplier.is_active ? 'active' : 'inactive'),
    businessType: supplier.businessType ?? supplier.supplier_type ?? 'other',
    rating: supplier.rating != null ? Number(supplier.rating) : 3,
    // Add extra aliasing for Excel matching
    contactPersonName: contactPersonValue
  };
}

/**
 * Supplier Service - PostgreSQL Implementation
 */
class SupplierService {
  async resolveOrCreateCityName(cityName, userId) {
    const normalized = String(cityName || '').trim();
    if (!normalized) return '';
    const existingCity = await cityRepository.findByName(normalized);
    if (existingCity) return existingCity.name;
    try {
      const createdCity = await cityRepository.create({
        name: normalized,
        createdBy: userId
      });
      return createdCity?.name || normalized;
    } catch (error) {
      if (error && error.code === '23505') {
        const winner = await cityRepository.findByName(normalized);
        if (winner) return winner.name;
      }
      throw error;
    }
  }

  /**
   * Get suppliers with filtering and pagination
   */
  async getSuppliers(queryParams) {
    const filters = {};
    if (queryParams.isActive !== undefined) {
      filters.isActive = queryParams.isActive === 'true';
    }
    if (queryParams.search) {
      filters.search = queryParams.search;
    }

    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 20;

    const result = await supplierRepository.findWithPagination(filters, {
      page,
      limit,
      sort: 'created_at DESC'
    });

    // Get balances for all suppliers
    const supplierIds = result.suppliers.map(s => s.id);
    const balanceMap = await AccountingService.getBulkSupplierBalances(supplierIds);

    // Attach balances and map response format
    result.suppliers = result.suppliers.map(supplier => {
      const supplierId = String(supplier.id);
      const balance = balanceMap.get(supplierId) || balanceMap.get(supplier.id) || 0;
      return mapSupplierForResponse({
        ...supplier,
        id: supplier.id,
        currentBalance: balance,
        pendingBalance: balance > 0 ? balance : 0,
        advanceBalance: balance < 0 ? Math.abs(balance) : 0
      });
    });

    return result;
  }

  /**
   * Get single supplier by ID
   */
  async getSupplierById(id) {
    const supplier = await supplierRepository.findById(id);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const balance = await AccountingService.getSupplierBalance(id);

    return mapSupplierForResponse({
      ...supplier,
      id: supplier.id,
      currentBalance: balance,
      pendingBalance: balance > 0 ? balance : 0,
      advanceBalance: balance < 0 ? Math.abs(balance) : 0
    });
  }

  /**
   * Create supplier
   */
  async createSupplier(supplierData, userId) {
    const supplier = await supplierRepository.create({
      ...supplierData,
      createdBy: userId
    });

    // Auto-create Chart of Accounts entry for this supplier
    try {
      const accountCode = `SUPP-${supplier.id}`;
      const accountName = supplier.company_name || supplier.business_name || supplier.name || 'Unknown Supplier';

      // Check if account already exists
      const existingAccount = await chartOfAccountsRepository.findByAccountCode(accountCode);
      if (!existingAccount) {
        await chartOfAccountsRepository.create({
          accountCode: accountCode,
          accountName: accountName,
          accountType: 'liability',
          accountCategory: 'Trade Payables',
          normalBalance: 'credit',
          openingBalance: 0,
          currentBalance: 0,
          allowDirectPosting: false,
          isSystemAccount: false,
          isActive: true,
          description: `Supplier Account: ${accountName}`,
          supplierId: supplier.id,
          createdBy: userId
        });
      }
    } catch (chartError) {
      console.error('Failed to create Chart of Accounts entry for supplier:', chartError);
      // Don't fail the supplier creation if chart account creation fails
    }

    // Post opening balance to ledger
    try {
      const openingBalance = parseFloat(supplierData.openingBalance || 0);
      if (openingBalance !== 0) {
        await AccountingService.postSupplierOpeningBalance(supplier.id, openingBalance, {
          createdBy: userId,
          transactionDate: supplier.created_at || new Date()
        });
      }
    } catch (openingBalanceError) {
      console.error('Failed to post supplier opening balance to ledger:', openingBalanceError);
      // Don't fail supplier creation if ledger posting fails
    }

    return mapSupplierForResponse(supplier);
  }

  /**
   * Update supplier
   */
  async updateSupplier(id, supplierData, userId) {
    const supplier = await supplierRepository.update(id, {
      ...supplierData,
      updatedBy: userId
    });

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    // Post opening balance to account ledger when it changes
    if (supplierData.openingBalance !== undefined) {
      try {
        const amount = parseFloat(supplierData.openingBalance) || 0;
        await AccountingService.postSupplierOpeningBalance(id, amount, {
          createdBy: userId,
          transactionDate: supplier.updated_at || new Date()
        });
      } catch (err) {
        console.error('Error posting supplier opening balance to ledger:', err);
        // Don't fail update - balance will be off until corrected
      }
    }

    return mapSupplierForResponse(supplier);
  }

  /**
   * Delete supplier
   */
  async deleteSupplier(id) {
    const balance = await AccountingService.getSupplierBalance(id);
    if (Math.abs(balance) > 0.01) {
      throw new Error('Cannot delete supplier with outstanding balance');
    }
    const supplier = await supplierRepository.delete(id);
    if (!supplier) throw new Error('Supplier not found');
    return supplier;
  }

  async getSupplierByIdWithLedger(supplierId) {
    return this.getSupplierById(supplierId);
  }

  async searchSuppliers(searchTerm, limit = 10) {
    const suppliers = await supplierRepository.findAll({ search: searchTerm }, { limit });
    const supplierIds = suppliers.map(s => s.id);
    const balanceMap = await AccountingService.getBulkSupplierBalances(supplierIds);
    return suppliers.map(s => {
      const supplierId = String(s.id);
      const balance = balanceMap.get(supplierId) || balanceMap.get(s.id) || 0;
      return {
        ...s,
        id: s.id,
        currentBalance: balance,
        pendingBalance: balance > 0 ? balance : 0,
        advanceBalance: balance < 0 ? Math.abs(balance) : 0
      };
    });
  }

  async getAllSuppliers(filter = {}, options = {}) {
    const f = { ...filter };
    if (f.status !== undefined) { f.isActive = f.status === 'active'; delete f.status; }
    const suppliers = await supplierRepository.findAll(f, { ...options, limit: options.limit || 999999 });
    const supplierIds = suppliers.map(s => s.id);
    const balanceMap = await AccountingService.getBulkSupplierBalances(supplierIds);
    return suppliers.map(s => {
      const supplierId = String(s.id);
      const balance = balanceMap.get(supplierId) || balanceMap.get(s.id) || 0;
      return mapSupplierForResponse({
        ...s,
        id: s.id,
        currentBalance: balance,
        pendingBalance: balance > 0 ? balance : 0,
        advanceBalance: balance < 0 ? Math.abs(balance) : 0
      });
    });
  }

  async getSuppliersForExport(filters = {}) {
    const opts = { limit: 999999 };
    if (filters.status !== undefined) {
      filters.isActive = filters.status === 'active';
      delete filters.status;
    }
    return this.getAllSuppliers(filters, opts);
  }

  async supplierExists(query) {
    const excludeId = query._id || query.id || null;
    if (query.email != null) {
      const row = await supplierRepository.findByEmail(query.email, excludeId);
      return !!row;
    }
    if (query.companyName != null) {
      const row = await supplierRepository.findByCompanyName(query.companyName, excludeId);
      return !!row;
    }
    if (query['contactPerson.name'] != null) {
      const suppliers = await supplierRepository.findAll({ search: query['contactPerson.name'] }, { limit: 50 });
      const q = String(query['contactPerson.name']).trim().toLowerCase();
      const match = suppliers.find(s => (s.contact_person || '').toLowerCase() === q && (excludeId ? s.id !== excludeId : true));
      return !!match;
    }
    return false;
  }

  async checkCompanyNameExists(companyName, excludeId = null) {
    const row = await supplierRepository.findByCompanyName(companyName, excludeId);
    return !!row;
  }

  /**
   * Bulk create suppliers from imported data (Excel keys: snake_case headers from /excel-manager/import)
   */
  async bulkCreateSuppliers(suppliersData, userId, options = {}) {
    let created = 0;
    let failed = 0;
    const errors = [];
    const autoCreateCities = options.autoCreateCities !== false;

    const str = (v) => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'object' && v !== null && !(v instanceof Date)) {
        if (v.name) return String(v.name).trim();
        return String(v).trim();
      }
      return String(v).trim();
    };

    const num = (v) => {
      const n = parseFloat(String(v).replace(/,/g, '').trim());
      return Number.isFinite(n) ? n : 0;
    };

    const normalizeKey = (k) => String(k || '').toLowerCase().replace(/[\s_\-]+/g, '');
    const pick = (obj, aliases = []) => {
      if (!obj || typeof obj !== 'object') return undefined;
      for (const alias of aliases) {
        if (Object.prototype.hasOwnProperty.call(obj, alias) && obj[alias] !== undefined && obj[alias] !== null && obj[alias] !== '') {
          return obj[alias];
        }
      }
      const normalized = new Map(Object.keys(obj).map((k) => [normalizeKey(k), k]));
      for (const alias of aliases) {
        const key = normalized.get(normalizeKey(alias));
        if (key && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
          return obj[key];
        }
      }
      return undefined;
    };

    for (const supplier of suppliersData) {
      try {
        const cityRaw = supplier.city || supplier.City || '';
        const cityName = autoCreateCities
          ? await this.resolveOrCreateCityName(cityRaw, userId)
          : String(cityRaw || '').trim();

        const companyName = str(
          pick(supplier, [
            'company_name',
            'companyName',
            'company',
            'business_name',
            'businessName',
            'name',
            'supplier_name',
            'supplierName',
            'supplier',
            'vendor_name',
            'vendorName',
            'vendor'
          ])
        );

        const contactName = str(
          pick(supplier, [
            'contact_person',
            'contactperson',
            'contact_person_name',
            'contact_name',
            'contactPerson',
            'contact',
            'person_name'
          ]) || (supplier.contactPerson && supplier.contactPerson.name)
        );

        const addressVal = str(
          pick(supplier, [
            'address',
            'street',
            'street_address',
            'location',
            'full_address'
          ])
        );
        const mappedData = {
          companyName,
          contactPerson: {
            name: contactName,
            title: str(supplier.contact_person_title || (supplier.contactPerson && supplier.contactPerson.title))
          },
          email: str(supplier.email),
          phone: str(supplier.phone || supplier.mobile || supplier.contact_phone),
          address: cityName || addressVal ? { 
            city: cityName, 
            street: addressVal 
          } : undefined,
          openingBalance: num(supplier.opening_balance ?? supplier.openingBalance ?? supplier.balance ?? supplier.opening),
          businessType: str(supplier.business_type || supplier.type || supplier.businessType || 'wholesaler').toLowerCase() || 'wholesaler',
          status: 'active'
        };

        if (!mappedData.companyName) {
          throw new Error('Supplier company name is required');
        }

        await this.createSupplier(mappedData, userId);
        created++;
      } catch (err) {
        failed++;
        const label = str(
          pick(supplier, [
            'company_name',
            'companyName',
            'company',
            'business_name',
            'businessName',
            'name',
            'supplier_name',
            'supplierName',
            'supplier',
            'vendor_name',
            'vendorName',
            'vendor'
          ])
          || 'Row'
        );
        errors.push({ supplier: label || 'Row', error: err.message });
      }
    }

    return { created, failed, errors };
  }
}

module.exports = new SupplierService();
