const { query } = require('../config/postgres');
const productRepository = require('../repositories/postgres/ProductRepository');
const categoryRepository = require('../repositories/postgres/CategoryRepository');
const inventoryRepository = require('../repositories/postgres/InventoryRepository');
const investorRepository = require('../repositories/postgres/InvestorRepository');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(v) {
  if (v == null || v === '') return false;
  return UUID_REGEX.test(String(v).trim());
}

/** Accept string UUID or populated `{ _id, id }` from clients. */
function resolveInvestorIdRef(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') {
    return raw._id || raw.id || null;
  }
  return raw;
}

function safePiecesPerBox(row) {
  if (!row || row.pieces_per_box == null || row.pieces_per_box === '') return null;
  const n = parseFloat(row.pieces_per_box);
  return Number.isFinite(n) ? n : null;
}

async function resolveCategoryId(categoryOrName) {
  if (categoryOrName == null || categoryOrName === '') return null;
  const s = String(categoryOrName).trim();
  if (UUID_REGEX.test(s)) return s;
  const cat = await categoryRepository.findByName(s);
  return cat ? cat.id : null;
}

function toApiProduct(row, categoryMap = null) {
  if (!row) return null;
  const id = row.id;
  const categoryId = row.category_id;
  const cat = categoryMap && categoryId ? categoryMap.get(categoryId) : null;
  return {
    _id: id,
    id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    hsCode: row.hs_code || null,
    description: row.description,
    category: cat ? { _id: categoryId, id: categoryId, name: cat.name } : (categoryId ? { _id: categoryId, id: categoryId, name: null } : null),
    pricing: {
      cost: parseFloat(row.cost_price) || 0,
      wholesale: row.wholesale_price != null ? parseFloat(row.wholesale_price) : (parseFloat(row.selling_price) || 0),
      retail: parseFloat(row.selling_price) || 0
    },
    inventory: {
      currentStock: parseFloat(row.stock_quantity) || 0,
      reorderPoint: parseFloat(row.min_stock_level) || 0,
      minStock: parseFloat(row.min_stock_level) || 0
    },
    status: row.is_active ? 'active' : 'inactive',
    isActive: row.is_active,
    unit: row.unit,
    piecesPerBox: safePiecesPerBox(row),
    pieces_per_box: safePiecesPerBox(row),
    created_at: row.created_at,
    updated_at: row.updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    imageUrl: row.image_url || null
  };
}

function attachInvestorsToApiProduct(apiProduct, linkRows) {
  if (!apiProduct) return apiProduct;
  if (!linkRows?.length) {
    return { ...apiProduct, hasInvestors: false, investors: [] };
  }
  return {
    ...apiProduct,
    hasInvestors: true,
    investors: linkRows.map((r) => ({
      investor: {
        _id: r.investor_id,
        id: r.investor_id,
        name: r.investor_name,
        email: r.investor_email
      },
      sharePercentage: parseFloat(r.share_percentage) || 30,
      addedAt: r.added_at
    }))
  };
}

async function getCategoryMap(categoryIds) {
  // Only query valid UUIDs — invalid category_id on legacy rows would make Postgres throw (500)
  const uniq = [...new Set(categoryIds.filter(Boolean).filter((id) => isValidUuid(id)))];
  const map = new Map();
  for (const id of uniq) {
    try {
      const cat = await categoryRepository.findById(id);
      if (cat) map.set(id, cat);
    } catch (e) {
      console.warn('getCategoryMap: skip category lookup for', id, e.message);
    }
  }
  return map;
}

class ProductServicePostgres {
  buildFilter(queryParams) {
    const filters = {};
    if (queryParams.search) filters.search = queryParams.search;
    if (queryParams.category) filters.categoryId = queryParams.category;
    else if (queryParams.categories) {
      try {
        const arr = JSON.parse(queryParams.categories);
        if (Array.isArray(arr) && arr.length > 0) filters.categoryId = arr[0];
      } catch (_) {}
    }
    if (queryParams.status === 'active') filters.isActive = true;
    else if (queryParams.status === 'inactive') filters.isActive = false;
    if (queryParams.lowStock === 'true' || queryParams.lowStock === true) filters.lowStock = true;
    if (queryParams.stockStatus) filters.stockStatus = queryParams.stockStatus;
    return filters;
  }

  async getProducts(queryParams) {
    const getAll = queryParams.all === 'true' || queryParams.all === true ||
      (queryParams.limit && parseInt(queryParams.limit) >= 999999);
    const page = getAll ? 1 : (parseInt(queryParams.page) || 1);
    const limit = getAll ? 999999 : (parseInt(queryParams.limit) || 20);

    const filters = this.buildFilter(queryParams);
    const result = await productRepository.findWithPagination(filters, { page, limit });

    const categoryIds = [...new Set(result.products.map(p => p.category_id).filter(Boolean))];
    const categoryMap = await getCategoryMap(categoryIds);

    let products = result.products.map(p => toApiProduct(p, categoryMap));

    // Use inventory table as source of truth for stock (POS and returns update inventory, not products.stock_quantity)
    const productIds = products.map(p => p.id).filter(Boolean);
    if (productIds.length > 0) {
      const inventoryRows = await inventoryRepository.findByProductIds(productIds);
      const stockByProduct = new Map();
      (inventoryRows || []).forEach(inv => {
        const pid = inv.product_id || inv.productId;
        if (pid) stockByProduct.set(String(pid), inv);
      });
      products = products.map(p => {
        const inv = stockByProduct.get(String(p.id));
        if (inv) {
          const cur = Number(inv.current_stock ?? inv.currentStock ?? 0);
          const reserved = Number(inv.reserved_stock ?? inv.reservedStock ?? 0);
          const available = Number(inv.available_stock ?? inv.availableStock ?? cur - reserved);
          const reorder = Number(inv.reorder_point ?? inv.reorderPoint ?? p.inventory?.reorderPoint ?? 0);
          return {
            ...p,
            inventory: {
              ...p.inventory,
              currentStock: cur,
              availableStock: available,
              reservedStock: reserved,
              reorderPoint: reorder,
              minStock: reorder
            }
          };
        }
        return p;
      });
    }

    if (productIds.length > 0) {
      const invMap = await productRepository.findInvestorsByProductIds(productIds);
      products = products.map((p) => attachInvestorsToApiProduct(p, invMap.get(String(p.id)) || []));
    }

    return {
      products,
      pagination: result.pagination
    };
  }

  async getProductById(id) {
    if (!isValidUuid(id)) {
      throw new Error('Invalid product id');
    }
    let row;
    try {
      row = await productRepository.findById(id);
    } catch (e) {
      // Postgres: invalid input syntax for type uuid (22P02)
      if (e && e.code === '22P02') {
        throw new Error('Invalid product id');
      }
      console.error('getProductById query error:', e);
      throw e;
    }
    if (!row) throw new Error('Product not found');
    const categoryMap =
      row.category_id && isValidUuid(row.category_id) ? await getCategoryMap([row.category_id]) : null;
    let product = toApiProduct(row, categoryMap);
    // Use inventory table as source of truth for stock (sale returns update inventory.current_stock)
    const inv = await inventoryRepository.findOne({ productId: id, product: id });
    if (inv) {
      const cur = Number(inv.current_stock ?? inv.currentStock ?? 0);
      const reserved = Number(inv.reserved_stock ?? inv.reservedStock ?? 0);
      const available = Number(inv.available_stock ?? inv.availableStock ?? cur - reserved);
      const reorder = Number(inv.reorder_point ?? inv.reorderPoint ?? product.inventory?.reorderPoint ?? 0);
      product = {
        ...product,
        inventory: {
          ...product.inventory,
          currentStock: cur,
          availableStock: available,
          reservedStock: reserved,
          reorderPoint: reorder,
          minStock: reorder
        }
      };
    }
    const invMap = await productRepository.findInvestorsByProductIds([id]);
    return attachInvestorsToApiProduct(product, invMap.get(String(id)) || []);
  }

  async createProduct(productData, userId, req = null) {
    const pricing = productData.pricing || {};
    const cost = pricing.cost !== undefined && pricing.cost !== null ? Number(pricing.cost) : 0;
    const retail = pricing.retail !== undefined && pricing.retail !== null ? Number(pricing.retail) : 0;
    const wholesale = pricing.wholesale !== undefined && pricing.wholesale !== null ? Number(pricing.wholesale) : retail;

    if (cost < 0) throw new Error('Cost price is required and must be non-negative');
    if (retail < 0) throw new Error('Retail price is required and must be non-negative');
    if (wholesale < 0) throw new Error('Wholesale price must be non-negative');

    if (productData.name) {
      const nameExists = await productRepository.nameExists(productData.name);
      if (nameExists) throw new Error('A product with this name already exists. Please choose a different name.');
    }
    if (productData.barcode) {
      const barcodeExists = await productRepository.barcodeExists(productData.barcode);
      if (barcodeExists) throw new Error('A product with this barcode already exists.');
    }

    const inv = productData.inventory || {};
    const categoryInput = productData.category || productData.categoryId;
    let categoryId = null;

    if (categoryInput != null && typeof categoryInput === 'object') {
      const oid = categoryInput.id || categoryInput._id;
      categoryId = isValidUuid(oid) ? String(oid).trim() : null;
    } else {
      categoryId = await resolveCategoryId(categoryInput);
    }

    const piecesPerBox = productData.piecesPerBox ?? productData.pieces_per_box;
    const product = await productRepository.create({
      name: productData.name,
      sku: productData.sku,
      barcode: productData.barcode,
      hsCode: productData.hsCode ?? productData.hs_code,
      description: productData.description,
      categoryId,
      costPrice: cost,
      sellingPrice: retail,
      wholesalePrice: wholesale,
      stockQuantity: inv.currentStock ?? inv.stockQuantity ?? 0,
      minStockLevel: inv.reorderPoint ?? inv.minStock ?? inv.minStockLevel ?? 0,
      unit: productData.unit,
      piecesPerBox: piecesPerBox != null && piecesPerBox !== '' ? parseFloat(piecesPerBox) : null,
      isActive: productData.status !== 'inactive' && productData.isActive !== false,
      createdBy: userId,
      imageUrl: productData.imageUrl || null
    });

    const categoryMap = product.category_id ? await getCategoryMap([product.category_id]) : null;
    return {
      product: toApiProduct(product, categoryMap),
      message: 'Product created successfully'
    };
  }

  async updateProduct(id, updateData, userId, req = null) {
    const current = await productRepository.findById(id);
    if (!current) throw new Error('Product not found');

    if (updateData.name) {
      const nameExists = await productRepository.nameExists(updateData.name, id);
      if (nameExists) throw new Error('A product with this name already exists. Please choose a different name.');
    }
    if (updateData.barcode) {
      const barcodeExists = await productRepository.barcodeExists(updateData.barcode, id);
      if (barcodeExists) throw new Error('A product with this barcode already exists.');
    }

    const data = {};
    if (updateData.name !== undefined) data.name = updateData.name;
    if (updateData.sku !== undefined) data.sku = updateData.sku === '' ? null : updateData.sku;
    if (updateData.barcode !== undefined) data.barcode = updateData.barcode === '' ? null : updateData.barcode;
    if (updateData.hsCode !== undefined || updateData.hs_code !== undefined) {
      const h = updateData.hsCode ?? updateData.hs_code;
      data.hsCode = h === '' || h == null ? null : String(h).trim();
    }
    if (updateData.description !== undefined) data.description = updateData.description;
    if (updateData.category !== undefined || updateData.categoryId !== undefined) {
      const catRaw = [updateData.category, updateData.categoryId].find(
        (v) => v !== undefined && v !== null && (typeof v !== 'string' || v.trim() !== '')
      );
      if (catRaw === undefined) {
        data.categoryId = null;
      } else if (typeof catRaw === 'object') {
        const oid = catRaw.id || catRaw._id;
        data.categoryId = isValidUuid(oid) ? String(oid).trim() : null;
      } else if (!isValidUuid(catRaw)) {
        data.categoryId = await resolveCategoryId(catRaw);
      } else {
        data.categoryId = String(catRaw).trim();
      }
    }
    if (updateData.unit !== undefined) data.unit = updateData.unit;
    if (updateData.piecesPerBox !== undefined || updateData.pieces_per_box !== undefined) {
      const ppb = updateData.piecesPerBox ?? updateData.pieces_per_box;
      data.piecesPerBox = ppb != null && ppb !== '' ? parseFloat(ppb) : null;
    }
    if (updateData.status !== undefined) data.isActive = updateData.status !== 'inactive';
    if (updateData.isActive !== undefined) data.isActive = updateData.isActive;
    if (updateData.imageUrl !== undefined) data.imageUrl = updateData.imageUrl;

    const pricing = updateData.pricing;
    if (pricing) {
      const cost = pricing.cost !== undefined && pricing.cost !== null ? Number(pricing.cost) : current.cost_price;
      const retail = pricing.retail !== undefined && pricing.retail !== null ? Number(pricing.retail) : current.selling_price;
      const currentWholesale = current.wholesale_price ?? current.wholesalePrice ?? current.selling_price;
      const wholesale = pricing.wholesale !== undefined && pricing.wholesale !== null ? Number(pricing.wholesale) : currentWholesale;
      data.costPrice = cost;
      data.sellingPrice = retail;
      data.wholesalePrice = wholesale;
    }

    const inv = updateData.inventory;
    if (inv) {
      if (inv.currentStock !== undefined) data.stockQuantity = inv.currentStock;
      if (inv.reorderPoint !== undefined) data.minStockLevel = inv.reorderPoint;
      if (inv.minStock !== undefined) data.minStockLevel = inv.minStock;
    }

    data.updatedBy = userId;

    const product = await productRepository.update(id, data);
    if (!product) throw new Error('Product not found');

    // Sync inventory fields to inventory table (source of truth for stock display).
    // The UI uses `inventory.current_stock` (and `inventory.available_stock`) and not `products.stock_quantity`.
    const invData = updateData.inventory;
    if (invData) {
      const hasCurrent =
        invData.currentStock !== undefined && invData.currentStock !== null;
      const hasReorderPoint =
        invData.reorderPoint !== undefined && invData.reorderPoint !== null;
      const hasMinStock =
        invData.minStock !== undefined && invData.minStock !== null;

      const shouldUpdateInventory =
        hasCurrent || hasReorderPoint || hasMinStock || invData.maxStock !== undefined;

      if (shouldUpdateInventory) {
        try {
          const existingInv = await inventoryRepository.findOne({ productId: id, product: id });
          const reserved = Number(existingInv?.reserved_stock ?? existingInv?.reservedStock ?? 0) || 0;

          // Determine resulting current stock.
          const existingCurrent = Number(existingInv?.current_stock ?? existingInv?.currentStock ?? 0) || 0;
          const currentStock =
            hasCurrent ? Number(invData.currentStock) : existingCurrent;

          // Determine resulting reorder point.
          const reorderPoint =
            (invData.reorderPoint !== undefined ? invData.reorderPoint : invData.minStock) ??
            existingInv?.reorder_point ??
            existingInv?.reorderPoint ??
            product.min_stock_level ??
            10;

          const availableStock = currentStock - reserved;
          const payload = {
            currentStock,
            availableStock,
            reorderPoint: reorderPoint !== undefined ? Number(reorderPoint) : undefined,
          };

          if (invData.maxStock !== undefined && invData.maxStock !== null) {
            payload.maxStock = Number(invData.maxStock);
          }

          if (existingInv) {
            await inventoryRepository.updateByProductId(id, payload);
          } else {
            await inventoryRepository.create({
              productId: id,
              product: id,
              productModel: 'Product',
              currentStock,
              reservedStock: reserved,
              reorderPoint: Number(payload.reorderPoint ?? 10),
              reorderQuantity: 50,
              maxStock: payload.maxStock ?? null,
              status: 'active'
            });
          }
        } catch (invErr) {
          console.error('Inventory sync on product stock update:', invErr);
        }
      }
    }

    const categoryMap = product.category_id ? await getCategoryMap([product.category_id]) : null;
    return {
      product: toApiProduct(product, categoryMap),
      message: 'Product updated successfully'
    };
  }

  async deleteProduct(id, req = null) {
    const product = await productRepository.findById(id);
    if (!product) throw new Error('Product not found');
    await productRepository.delete(id);
    return { message: 'Product deleted successfully' };
  }

  async searchProducts(query, limit = 10) {
    const rows = await productRepository.search(query, { limit });
    const categoryIds = [...new Set(rows.map(p => p.category_id).filter(Boolean))];
    const categoryMap = await getCategoryMap(categoryIds);
    return rows.map(p => toApiProduct(p, categoryMap));
  }

  async productExistsByName(name) {
    return productRepository.nameExists(name);
  }

  async getProductByName(name) {
    const row = await productRepository.findByName(name);
    if (!row) return null;
    const categoryMap = row.category_id ? await getCategoryMap([row.category_id]) : null;
    return toApiProduct(row, categoryMap);
  }

  async getLowStockProducts() {
    const rows = await productRepository.findAll({ lowStock: true, isActive: true }, { limit: 500 });
    const categoryIds = [...new Set(rows.map(p => p.category_id).filter(Boolean))];
    const categoryMap = await getCategoryMap(categoryIds);
    return rows.map(p => toApiProduct(p, categoryMap));
  }

  async getProductsForExport(filters = {}) {
    const f = this.buildFilter(filters);
    const rows = await productRepository.findAll(f, { limit: 999999 });
    const categoryIds = [...new Set(rows.map(p => p.category_id).filter(Boolean))];
    const categoryMap = await getCategoryMap(categoryIds);
    return rows.map(p => toApiProduct(p, categoryMap));
  }

  async getLastPurchasePrice(productId) {
    if (!productId) return null;
    const prices = await this.getLastPurchasePrices([productId]);
    const entry = prices[String(productId)];
    return entry ? { lastPurchasePrice: entry.lastPurchasePrice, invoiceNumber: entry.invoiceNumber, purchaseDate: entry.purchaseDate } : null;
  }

  async getLastPurchasePrices(productIds) {
    const prices = {};
    if (!Array.isArray(productIds) || productIds.length === 0) return prices;
    const ids = [...new Set(productIds.map(id => String(id)).filter(Boolean))];
    if (ids.length === 0) return prices;
    try {
      const result = await query(
        `SELECT DISTINCT ON (product_id) product_id, unit_cost as last_purchase_price, reference_number as invoice_number, created_at as purchase_date
         FROM stock_movements
         WHERE product_id = ANY($1::uuid[]) AND movement_type = 'purchase' AND status = 'completed'
         ORDER BY product_id, created_at DESC`,
        [ids]
      );
      for (const row of result.rows || []) {
        const pid = row.product_id && (row.product_id.toString ? row.product_id.toString() : String(row.product_id));
        if (pid) {
          prices[pid] = {
            productId: pid,
            lastPurchasePrice: parseFloat(row.last_purchase_price) || 0,
            invoiceNumber: row.invoice_number || null,
            purchaseDate: row.purchase_date || null
          };
        }
      }
      // Fallback to product cost_price when no purchase history
      const productRows = await productRepository.findAll({ ids }, { limit: ids.length });
      for (const p of productRows || []) {
        const pid = (p.id || p._id) && ((p.id || p._id).toString ? (p.id || p._id).toString() : String(p.id || p._id));
        if (pid && !prices[pid]) {
          const cost = parseFloat(p.cost_price ?? p.costPrice) || 0;
          if (cost > 0) {
            prices[pid] = { productId: pid, lastPurchasePrice: cost, invoiceNumber: null, purchaseDate: null };
          }
        }
      }
    } catch (err) {
      console.error('getLastPurchasePrices error:', err);
    }
    return prices;
  }

  async getPriceForCustomerType(productId, customerType, quantity) {
    const product = await productRepository.findById(productId);
    if (!product) return null;
    return {
      price: parseFloat(product.selling_price) || 0,
      customerType,
      quantity: quantity || 1
    };
  }

  async bulkUpdateProductsAdvanced(productIds, updates) {
    const results = { updated: 0, failed: 0 };
    for (const id of productIds) {
      try {
        await this.updateProduct(id, updates, null);
        results.updated++;
      } catch (_) {
        results.failed++;
      }
    }
    return results;
  }

  async bulkDeleteProducts(productIds) {
    const results = { deleted: 0, failed: 0 };
    for (const id of productIds) {
      try {
        await this.deleteProduct(id);
        results.deleted++;
      } catch (_) {
        results.failed++;
      }
    }
    return results;
  }

  async updateProductInvestors(id, investors) {
    if (!isValidUuid(id)) {
      throw new Error('Invalid product id');
    }
    await this.getProductById(id);
    const list = Array.isArray(investors) ? investors : [];
    for (const inv of list) {
      const iid = resolveInvestorIdRef(inv.investor);
      if (!iid || !isValidUuid(String(iid))) {
        throw new Error('Invalid investor id');
      }
      const row = await investorRepository.findById(iid);
      if (!row) {
        throw new Error(`Investor ${iid} not found`);
      }
    }
    await productRepository.replaceProductInvestors(id, list);
    return this.getProductById(id);
  }

  async removeProductInvestor(id, investorId) {
    if (!isValidUuid(id)) {
      throw new Error('Invalid product id');
    }
    if (!investorId || !isValidUuid(String(investorId))) {
      throw new Error('Invalid investor id');
    }
    await this.getProductById(id);
    await productRepository.deleteProductInvestor(id, investorId);
    return this.getProductById(id);
  }

  /**
   * Products linked to an investor (for Investors page + API route).
   * Each item includes a synthetic `investors` array so existing route mapping still works.
   */
  async getProductsLinkedToInvestor(investorId) {
    if (!isValidUuid(investorId)) {
      throw new Error('Invalid investor id');
    }
    const rows = await productRepository.findProductsByInvestorId(investorId);
    const catIds = [...new Set(rows.map((r) => r.category_id).filter(Boolean))];
    const categoryMap = await getCategoryMap(catIds);
    return rows.map((row) => {
      const linkShare = row.link_share_percentage;
      const linkAdded = row.link_added_at;
      const { link_share_percentage, link_added_at, ...raw } = row;
      const api = toApiProduct(raw, categoryMap);
      return {
        ...api,
        investors: [
          {
            investor: investorId,
            sharePercentage: parseFloat(linkShare) || 30,
            addedAt: linkAdded
          }
        ]
      };
    });
  }

  async restoreProduct(id) {
    const product = await productRepository.findDeletedById(id);
    if (!product) throw new Error('Deleted product not found');
    await productRepository.restore(id);
    return { message: 'Product restored successfully' };
  }

  async getDeletedProducts() {
    const rows = await productRepository.findDeleted({}, { limit: 500 });
    const categoryIds = [...new Set(rows.map(p => p.category_id).filter(Boolean))];
    const categoryMap = await getCategoryMap(categoryIds);
    return rows.map(p => toApiProduct(p, categoryMap));
  }
}

module.exports = new ProductServicePostgres();
