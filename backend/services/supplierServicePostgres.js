const supplierRepository = require('../repositories/postgres/SupplierRepository');
const AccountingService = require('./accountingService');
const chartOfAccountsRepository = require('../repositories/postgres/ChartOfAccountsRepository');

/**
 * Map DB supplier row to API response format (contactPerson, status, businessType, rating)
 */
function mapSupplierForResponse(supplier) {
  if (!supplier) return supplier;
  const contactPersonValue = supplier.contact_person || supplier.contactPerson?.name;
  const companyName = supplier.company_name ?? supplier.companyName;
  const businessName = supplier.business_name ?? supplier.businessName;
  const name = supplier.name;
  const displayName = businessName || companyName || name || 'Unknown Supplier';
  return {
    ...supplier,
    companyName,
    businessName,
    displayName,
    contactPerson: contactPersonValue ? { name: contactPersonValue } : (supplier.contactPerson || {}),
    status: supplier.status ?? (supplier.is_active ? 'active' : 'inactive'),
    businessType: supplier.businessType ?? supplier.supplier_type ?? 'other',
    rating: supplier.rating != null ? Number(supplier.rating) : 3
  };
}

/**
 * Supplier Service - PostgreSQL Implementation
 */
class SupplierService {
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
}

module.exports = new SupplierService();
