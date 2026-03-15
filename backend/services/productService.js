const productRepository = require('../repositories/ProductRepository');
const investorRepository = require('../repositories/InvestorRepository');
const purchaseInvoiceRepository = require('../repositories/PurchaseInvoiceRepository');
const salesRepository = require('../repositories/SalesRepository');
const inventoryRepository = require('../repositories/InventoryRepository');
const auditLogService = require('./auditLogService');
const costingService = require('./costingService');

class ProductService {
  /**
   * Build filter query from request parameters
   * @param {object} queryParams - Request query parameters
   * @returns {object} - MongoDB filter object
   */
  buildFilter(queryParams) {
    const filter = {};

    // Multi-field search
    if (queryParams.search) {
      const searchTerm = queryParams.search;
      let searchFields = ['name', 'description'];

      // Parse custom search fields if provided
      if (queryParams.searchFields) {
        try {
          searchFields = JSON.parse(queryParams.searchFields);
        } catch (e) {
          // Use default fields
        }
      }

      // Build $or query for multiple fields
      const searchConditions = [];
      searchFields.forEach(field => {
        if (field === 'sku' || field === 'barcode') {
          // Exact match for SKU/barcode
          searchConditions.push({ [field]: { $regex: `^${searchTerm}$`, $options: 'i' } });
        } else {
          // Partial match for other fields
          searchConditions.push({ [field]: { $regex: searchTerm, $options: 'i' } });
        }
      });

      if (searchConditions.length > 0) {
        filter.$or = searchConditions;
      }
    }

    // Category filter (single or multiple)
    if (queryParams.category) {
      filter.category = queryParams.category;
    } else if (queryParams.categories) {
      try {
        const categories = JSON.parse(queryParams.categories);
        if (Array.isArray(categories) && categories.length > 0) {
          filter.category = { $in: categories };
        }
      } catch (e) {
        // Invalid format, ignore
      }
    }

    // Status filter (single or multiple)
    if (queryParams.status) {
      filter.status = queryParams.status;
    } else if (queryParams.statuses) {
      try {
        const statuses = JSON.parse(queryParams.statuses);
        if (Array.isArray(statuses) && statuses.length > 0) {
          filter.status = { $in: statuses };
        }
      } catch (e) {
        // Invalid format, ignore
      }
    }

    // Price range filter
    if (queryParams.minPrice || queryParams.maxPrice) {
      const priceField = queryParams.priceField || 'retail';
      const pricePath = `pricing.${priceField}`;

      if (queryParams.minPrice && queryParams.maxPrice) {
        filter[pricePath] = {
          $gte: parseFloat(queryParams.minPrice),
          $lte: parseFloat(queryParams.maxPrice)
        };
      } else if (queryParams.minPrice) {
        filter[pricePath] = { $gte: parseFloat(queryParams.minPrice) };
      } else if (queryParams.maxPrice) {
        filter[pricePath] = { $lte: parseFloat(queryParams.maxPrice) };
      }
    }

    // Stock level filter
    if (queryParams.minStock || queryParams.maxStock) {
      if (queryParams.minStock && queryParams.maxStock) {
        filter['inventory.currentStock'] = {
          $gte: parseInt(queryParams.minStock),
          $lte: parseInt(queryParams.maxStock)
        };
      } else if (queryParams.minStock) {
        filter['inventory.currentStock'] = { $gte: parseInt(queryParams.minStock) };
      } else if (queryParams.maxStock) {
        filter['inventory.currentStock'] = { $lte: parseInt(queryParams.maxStock) };
      }
    }

    // Date range filter
    if (queryParams.dateFrom || queryParams.dateTo) {
      const dateField = queryParams.dateField || 'createdAt';

      if (queryParams.dateFrom && queryParams.dateTo) {
        filter[dateField] = {
          $gte: new Date(queryParams.dateFrom),
          $lte: new Date(queryParams.dateTo)
        };
      } else if (queryParams.dateFrom) {
        filter[dateField] = { $gte: new Date(queryParams.dateFrom) };
      } else if (queryParams.dateTo) {
        filter[dateField] = { $lte: new Date(queryParams.dateTo) };
      }
    }

    // Brand filter
    if (queryParams.brand) {
      filter.brand = { $regex: queryParams.brand, $options: 'i' };
    }

    // Low stock filter
    if (queryParams.lowStock === 'true') {
      filter.$expr = { $lte: ['$inventory.currentStock', '$inventory.reorderPoint'] };
    }

    // Stock status filter
    if (queryParams.stockStatus) {
      switch (queryParams.stockStatus) {
        case 'lowStock':
          filter.$expr = { $lte: ['$inventory.currentStock', '$inventory.reorderPoint'] };
          break;
        case 'outOfStock':
          filter['inventory.currentStock'] = 0;
          break;
        case 'inStock':
          filter['inventory.currentStock'] = { $gt: 0 };
          break;
      }
    }

    return filter;
  }

  /**
   * Transform product names to uppercase
   * @param {Product|object} product - Product to transform
   * @returns {object} - Transformed product
   */
  transformProductToUppercase(product) {
    if (!product) return product;
    if (product.toObject) product = product.toObject();
    // Handle both products and variants
    if (product.displayName) {
      product.displayName = product.displayName.toUpperCase();
    }
    if (product.variantName) {
      product.variantName = product.variantName.toUpperCase();
    }
    if (product.name) product.name = product.name.toUpperCase();
    if (product.description) product.description = product.description.toUpperCase();
    if (product.category && product.category.name) product.category.name = product.category.name.toUpperCase();
    return product;
  }

  /**
   * Get products with filtering and pagination
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getProducts(queryParams) {
    const getAllProducts = queryParams.all === 'true' || queryParams.all === true ||
                          (queryParams.limit && parseInt(queryParams.limit) >= 999999);

    const page = getAllProducts ? 1 : (parseInt(queryParams.page) || 1);
    const limit = getAllProducts ? 999999 : (parseInt(queryParams.limit) || 20);

    const filter = this.buildFilter(queryParams);

    const result = await productRepository.findWithPagination(filter, {
      page,
      limit,
      getAll: getAllProducts,
      populate: [
        { path: 'category', select: 'name' },
        { path: 'investors.investor', select: 'name email' }
      ],
      sort: { createdAt: -1 }
    });

    // Transform product names to uppercase
    result.products = result.products.map(p => this.transformProductToUppercase(p));

    // Merge inventory data from Inventory repository (source of truth) into products
    const productIds = result.products.map(p => p._id || p.id).filter(Boolean);
    if (productIds.length > 0) {
      const inventoryRecords = await inventoryRepository.findByProductIds(productIds);
      const inventoryMap = new Map();
      inventoryRecords.forEach(inv => {
        const pid = (inv.product_id || inv.productId || inv.product)?.toString?.() || inv.product_id;
        if (pid) inventoryMap.set(pid, inv);
      });

      result.products = result.products.map(product => {
        const productId = (product._id || product.id)?.toString?.();
        const inventoryRecord = productId ? inventoryMap.get(productId) : null;
        if (inventoryRecord) {
          const cur = inventoryRecord.current_stock ?? inventoryRecord.currentStock ?? 0;
          const reorder = inventoryRecord.reorder_point ?? inventoryRecord.reorderPoint ?? 0;
          product.inventory = {
            ...product.inventory,
            currentStock: cur,
            reorderPoint: reorder,
            minStock: reorder,
            maxStock: inventoryRecord.max_stock ?? inventoryRecord.maxStock ?? product.inventory?.maxStock,
            availableStock: inventoryRecord.available_stock ?? inventoryRecord.availableStock ?? cur,
            reservedStock: inventoryRecord.reserved_stock ?? inventoryRecord.reservedStock ?? 0
          };
        }
        return product;
      });
    }

    return result;
  }

  /**
   * Get single product by ID
   * @param {string} id - Product ID
   * @returns {Promise<Product>}
   */
  async getProductById(id) {
    const product = await productRepository.findById(id, {
      populate: [
        { path: 'category', select: 'name' },
        { path: 'investors.investor', select: 'name email' }
      ]
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const transformedProduct = this.transformProductToUppercase(product);

    // Merge inventory data from Inventory repository (source of truth)
    const inventoryRecord = await inventoryRepository.findOne({ product: id, productId: id });
    if (inventoryRecord) {
      const cur = inventoryRecord.current_stock ?? inventoryRecord.currentStock ?? 0;
      const reorder = inventoryRecord.reorder_point ?? inventoryRecord.reorderPoint ?? 0;
      transformedProduct.inventory = {
        ...transformedProduct.inventory,
        currentStock: cur,
        reorderPoint: reorder,
        minStock: reorder,
        maxStock: inventoryRecord.max_stock ?? inventoryRecord.maxStock ?? transformedProduct.inventory?.maxStock,
        availableStock: inventoryRecord.available_stock ?? inventoryRecord.availableStock ?? cur,
        reservedStock: inventoryRecord.reserved_stock ?? inventoryRecord.reservedStock ?? 0
      };
    }

    return transformedProduct;
  }

  /**
   * Create new product
   * @param {object} productData - Product data
   * @param {string} userId - User ID creating the product
   * @param {object} req - Express request object (for audit logging)
   * @returns {Promise<{product: Product, message: string}>}
   */
  async createProduct(productData, userId, req = null) {
    // Validate pricing fields exist and are valid
    if (!productData.pricing) {
      throw new Error('Pricing information is required');
    }
    
    const { cost, wholesale, retail } = productData.pricing;
    
    if (cost === undefined || cost === null || cost < 0) {
      throw new Error('Cost price is required and must be non-negative');
    }
    if (retail === undefined || retail === null || retail < 0) {
      throw new Error('Retail price is required and must be non-negative');
    }
    if (wholesale === undefined || wholesale === null || wholesale < 0) {
      throw new Error('Wholesale price is required and must be non-negative');
    }
    
    // Validate price hierarchy: cost <= wholesale <= retail
    if (cost > wholesale) {
      throw new Error('Cost price cannot be greater than wholesale price');
    }
    if (wholesale > retail) {
      throw new Error('Wholesale price cannot be greater than retail price');
    }
    if (cost > retail) {
      throw new Error('Cost price cannot be greater than retail price');
    }
    
    // Check if product name already exists
    if (productData.name) {
      const nameExists = await productRepository.nameExists(productData.name);
      if (nameExists) {
        throw new Error('A product with this name already exists. Please choose a different name.');
      }
    }

    // Check if SKU already exists
    if (productData.sku) {
      const skuExists = await productRepository.skuExists(productData.sku);
      if (skuExists) {
        throw new Error('A product with this SKU already exists.');
      }
    }

    // Check if barcode already exists
    if (productData.barcode) {
      const barcodeExists = await productRepository.barcodeExists(productData.barcode);
      if (barcodeExists) {
        throw new Error('A product with this barcode already exists.');
      }
    }

    // Set default costing method if not provided
    if (!productData.costingMethod) {
      productData.costingMethod = 'standard';
    }

    const dataWithUser = {
      ...productData,
      createdBy: userId,
      lastModifiedBy: userId,
      version: 0 // Initialize version for optimistic locking
    };

    const product = await productRepository.create(dataWithUser);

    // Automatically create inventory record for the new product
    try {
      const productId = product.id ?? product._id;
      await inventoryRepository.create({
        productId,
        product: productId,
        productModel: 'Product',
        currentStock: product.inventory?.currentStock ?? 0,
        reorderPoint: product.inventory?.reorderPoint ?? 10,
        reorderQuantity: product.inventory?.reorderQuantity ?? 50,
        status: 'active',
        location: { warehouse: 'Main Warehouse', aisle: 'A1', shelf: 'S1' }
      });
    } catch (inventoryError) {
      // Don't fail the product creation if inventory creation fails
      // Log error but continue
      console.error('Inventory creation error:', inventoryError);
    }

    // Log audit trail
    try {
      if (req) {
        await auditLogService.logProductCreation(product, { _id: userId }, req);
      }
    } catch (auditError) {
      // Don't fail product creation if audit logging fails
      console.error('Audit logging error:', auditError);
    }

    return {
      product,
      message: 'Product created successfully'
    };
  }

  /**
   * Update product with optimistic locking
   * @param {string} id - Product ID
   * @param {object} updateData - Data to update
   * @param {string} userId - User ID updating the product
   * @param {object} req - Express request object (for audit logging)
   * @returns {Promise<{product: Product, message: string}>}
   */
  async updateProduct(id, updateData, userId, req = null) {
    // Get current product for optimistic locking check
    const currentProduct = await productRepository.findById(id);
    if (!currentProduct) {
      throw new Error('Product not found');
    }

    // Check version for optimistic locking
    if (updateData.version !== undefined && updateData.version !== currentProduct.__v) {
      throw new Error('Product was modified by another user. Please refresh and try again.');
    }

    // Validate pricing if being updated
    if (updateData.pricing) {
      const { cost, wholesale, retail } = updateData.pricing;
      const currentCost = cost !== undefined ? cost : currentProduct.pricing?.cost;
      const currentWholesale = wholesale !== undefined ? wholesale : currentProduct.pricing?.wholesale;
      const currentRetail = retail !== undefined ? retail : currentProduct.pricing?.retail;
      
      // Validate price hierarchy: cost <= wholesale <= retail
      if (currentCost !== undefined && currentWholesale !== undefined && currentCost > currentWholesale) {
        throw new Error('Cost price cannot be greater than wholesale price');
      }
      if (currentWholesale !== undefined && currentRetail !== undefined && currentWholesale > currentRetail) {
        throw new Error('Wholesale price cannot be greater than retail price');
      }
      if (currentCost !== undefined && currentRetail !== undefined && currentCost > currentRetail) {
        throw new Error('Cost price cannot be greater than retail price');
      }
      
      // Ensure all prices are non-negative
      if (currentCost !== undefined && currentCost < 0) {
        throw new Error('Cost price must be non-negative');
      }
      if (currentWholesale !== undefined && currentWholesale < 0) {
        throw new Error('Wholesale price must be non-negative');
      }
      if (currentRetail !== undefined && currentRetail < 0) {
        throw new Error('Retail price must be non-negative');
      }
    }

    // Check if product name already exists (excluding current product)
    if (updateData.name) {
      const nameExists = await productRepository.nameExists(updateData.name, id);
      if (nameExists) {
        throw new Error('A product with this name already exists. Please choose a different name.');
      }
    }

    // Check if SKU already exists (excluding current product)
    if (updateData.sku) {
      const skuExists = await productRepository.skuExists(updateData.sku, id);
      if (skuExists) {
        throw new Error('A product with this SKU already exists.');
      }
    }

    // Check if barcode already exists (excluding current product)
    if (updateData.barcode) {
      const barcodeExists = await productRepository.barcodeExists(updateData.barcode, id);
      if (barcodeExists) {
        throw new Error('A product with this barcode already exists.');
      }
    }

    // Remove version from updateData (Mongoose handles __v automatically)
    const { version, ...dataToUpdate } = updateData;

    const dataWithUser = {
      ...dataToUpdate,
      lastModifiedBy: userId
    };

    // Use findOneAndUpdate with version check for atomic update
    const updatedProduct = await productRepository.Model.findOneAndUpdate(
      { _id: id, __v: currentProduct.__v }, // Include version in filter
      { $set: dataWithUser, $inc: { __v: 1 } }, // Increment version
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      throw new Error('Product was modified by another user. Please refresh and try again.');
    }

    // Sync inventory fields to Inventory collection (source of truth for list/detail views)
    if (updateData.inventory) {
      const inventoryUpdate = {};
      if (typeof updateData.inventory.reorderPoint === 'number') {
        inventoryUpdate.reorderPoint = updateData.inventory.reorderPoint;
      }
      if (typeof updateData.inventory.currentStock === 'number') {
        inventoryUpdate.currentStock = updateData.inventory.currentStock;
      }
      if (typeof updateData.inventory.maxStock === 'number') {
        inventoryUpdate.maxStock = updateData.inventory.maxStock;
      }
      if (Object.keys(inventoryUpdate).length > 0) {
        try {
          const existingInv = await inventoryRepository.findOne({ product: id, productId: id });
          const payload = {};
          if (typeof inventoryUpdate.currentStock === 'number') payload.currentStock = inventoryUpdate.currentStock;
          if (typeof inventoryUpdate.reorderPoint === 'number') payload.reorderPoint = inventoryUpdate.reorderPoint;
          if (typeof inventoryUpdate.maxStock === 'number') payload.maxStock = inventoryUpdate.maxStock;
          if (existingInv) {
            await inventoryRepository.updateByProductId(id, payload);
          } else {
            const currentStock = inventoryUpdate.currentStock ?? updatedProduct.inventory?.currentStock ?? 0;
            const reorderPoint = inventoryUpdate.reorderPoint ?? updatedProduct.inventory?.reorderPoint ?? 10;
            await inventoryRepository.create({
              productId: id,
              product: id,
              productModel: 'Product',
              currentStock,
              reorderPoint,
              reorderQuantity: 50,
              maxStock: inventoryUpdate.maxStock ?? null,
              status: 'active'
            });
          }
        } catch (invErr) {
          console.error('Inventory sync on product update:', invErr);
          // Don't fail the product update if inventory sync fails
        }
      }
    }

    // Log audit trail
    try {
      if (req) {
        const reason = updateData.reason || 'Product updated';
        await auditLogService.logProductUpdate(
          currentProduct,
          updatedProduct,
          { _id: userId },
          req,
          reason
        );
      }
    } catch (auditError) {
      // Don't fail update if audit logging fails
      console.error('Audit logging error:', auditError);
    }

    return {
      product: updatedProduct,
      message: 'Product updated successfully'
    };
  }

  /**
   * Delete product (soft delete)
   * @param {string} id - Product ID
   * @param {object} req - Express request object (for audit logging)
   * @returns {Promise<{message: string}>}
   */
  async deleteProduct(id, req = null) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new Error('Product not found');
    }

    // Check if product has been sold in any sales invoice
    const salesWithProduct = await salesRepository.findByProducts([id], {
      lean: true,
      limit: 1
    });

    if (salesWithProduct && salesWithProduct.length > 0) {
      const productName = product.name || 'Product';
      throw new Error(
        `Cannot delete "${productName}". This product has been sold through sale invoice(s). ` +
        `Deleting products that have been sold would affect historical sales records and data integrity. ` +
        `If you need to discontinue this product, consider marking it as inactive instead.`
      );
    }

    await productRepository.softDelete(id);

    // Log audit trail
    try {
      if (req) {
        await auditLogService.logProductDeletion(product, { _id: req.user?._id }, req);
      }
    } catch (auditError) {
      console.error('Audit logging error:', auditError);
    }

    return {
      message: 'Product deleted successfully'
    };
  }

  /**
   * Bulk update products
   * @param {Array} productIds - Array of product IDs
   * @param {object} updates - Updates to apply
   * @returns {Promise<{message: string, updated: number}>}
   */
  async bulkUpdateProducts(productIds, updates) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new Error('Product IDs are required');
    }

    const result = await productRepository.bulkUpdate(productIds, updates);

    return {
      message: 'Products updated successfully',
      updated: result.modifiedCount || 0
    };
  }

  /**
   * Bulk delete products (soft delete)
   * @param {Array} productIds - Array of product IDs
   * @returns {Promise<{message: string, deleted: number}>}
   */
  async bulkDeleteProducts(productIds) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new Error('Product IDs are required');
    }

    // Check which products have been sold
    const salesWithProducts = await salesRepository.findByProducts(productIds, {
      lean: true
    });

    if (salesWithProducts && salesWithProducts.length > 0) {
      // Get unique product IDs that have been sold
      const soldProductIds = new Set();
      const productIdStrings = productIds.map(id => id.toString());
      
      salesWithProducts.forEach(sale => {
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach(item => {
            if (item.product) {
              // Handle both populated and non-populated product references
              const productId = item.product._id 
                ? item.product._id.toString() 
                : item.product.toString();
              
              // Check if this product ID is in our list to delete
              if (productIdStrings.includes(productId)) {
                soldProductIds.add(productId);
              }
            }
          });
        }
      });

      if (soldProductIds.size > 0) {
        // Convert Set to Array and get product names for better error message
        const soldProductIdsArray = Array.from(soldProductIds);
        const soldProducts = await productRepository.findAll({
          _id: { $in: soldProductIdsArray }
        }, {
          select: 'name',
          lean: true
        });

        const productNames = soldProducts.map(p => p.name).join(', ');
        const count = soldProductIds.size;
        throw new Error(
          `Cannot delete ${count} product(s): ${productNames}. ` +
          `These products have been sold through sale invoice(s). ` +
          `Deleting products that have been sold would affect historical sales records and data integrity. ` +
          `If you need to discontinue these products, consider marking them as inactive instead.`
        );
      }
    }

    const result = await productRepository.bulkDelete(productIds);

    return {
      message: 'Products deleted successfully',
      deleted: result.modifiedCount || 0
    };
  }

  /**
   * Bulk update products with complex logic (price adjustments, stock adjustments, etc.)
   * @param {Array} productIds - Array of product IDs
   * @param {object} updates - Updates to apply
   * @returns {Promise<{message: string, updated: number}>}
   */
  async bulkUpdateProductsAdvanced(productIds, updates) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new Error('Product IDs are required');
    }

    // Get all products first for complex calculations
    const products = await productRepository.findByIds(productIds);

    // Handle price updates with different methods
    if (updates.priceType && updates.priceValue !== undefined) {
      const priceField = `pricing.${updates.priceType}`;
      const updateMethod = updates.updateMethod || 'set';

      const bulkOps = products.map(product => {
        let newValue = updates.priceValue;

        if (updateMethod === 'increase') {
          newValue = (product.pricing?.[updates.priceType] || 0) + updates.priceValue;
        } else if (updateMethod === 'decrease') {
          newValue = Math.max(0, (product.pricing?.[updates.priceType] || 0) - updates.priceValue);
        } else if (updateMethod === 'percentage') {
          newValue = (product.pricing?.[updates.priceType] || 0) * (1 + updates.priceValue / 100);
        }
        
        // Ensure non-negative
        newValue = Math.max(0, newValue);

        return {
          updateOne: {
            filter: { _id: product._id },
            update: { $set: { [priceField]: newValue } }
          }
        };
      });

      // Validate price hierarchy after bulk update
      // Note: This is a best-effort check; full validation would require fetching all updated products
      const result = await productRepository.Model.bulkWrite(bulkOps, { ordered: false });
      
      // Post-update validation: Check a sample of updated products for price hierarchy violations
      const sampleSize = Math.min(10, productIds.length);
      const sampleIds = productIds.slice(0, sampleSize);
      const sampleProducts = await productRepository.findByIds(sampleIds);
      
      for (const product of sampleProducts) {
        const { cost, wholesale, retail } = product.pricing || {};
        if (cost !== undefined && wholesale !== undefined && cost > wholesale) {
          console.warn(`Product ${product._id} has cost (${cost}) > wholesale (${wholesale}) after bulk update`);
        }
        if (wholesale !== undefined && retail !== undefined && wholesale > retail) {
          console.warn(`Product ${product._id} has wholesale (${wholesale}) > retail (${retail}) after bulk update`);
        }
      }
    }

    // Handle category update
    if (updates.category) {
      await productRepository.bulkUpdate(productIds, { category: updates.category });
    }

    // Handle status update
    if (updates.status) {
      await productRepository.bulkUpdate(productIds, { status: updates.status });
    }

    // Handle stock adjustment
    if (updates.stockAdjustment !== undefined) {
      const stockMethod = updates.stockMethod || 'set';
      const bulkOps = products.map(product => {
        let newStock = updates.stockAdjustment;

        if (stockMethod === 'increase') {
          newStock = (product.inventory?.currentStock || 0) + updates.stockAdjustment;
        } else if (stockMethod === 'decrease') {
          newStock = Math.max(0, (product.inventory?.currentStock || 0) - updates.stockAdjustment);
        }

        return {
          updateOne: {
            filter: { _id: product._id },
            update: { $set: { 'inventory.currentStock': newStock } }
          }
        };
      });

      await productRepository.Model.bulkWrite(bulkOps);
    }

    return {
      message: `Successfully updated ${productIds.length} products`,
      updated: productIds.length
    };
  }

  /**
   * Get low stock products
   * @returns {Promise<Array>}
   */
  async getLowStockProducts() {
    const products = await productRepository.findLowStock({
      select: 'name inventory pricing',
      sort: { 'inventory.currentStock': 1 },
      populate: null
    });

    return products.map(p => this.transformProductToUppercase(p));
  }

  /**
   * Get products for export (with filters)
   * @param {object} filters - Filter criteria
   * @returns {Promise<Array>}
   */
  async getProductsForExport(filters = {}) {
    const filter = this.buildFilter(filters);
    
    return await productRepository.findAll(filter, {
      populate: { path: 'category', select: 'name' },
      lean: true
    });
  }

  /**
   * Search products by name
   * @param {string} searchTerm - Search term
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>}
   */
  async searchProducts(searchTerm, limit = 10) {
    const products = await productRepository.findAll({
      name: { $regex: searchTerm, $options: 'i' },
      status: 'active'
    }, {
      select: 'name pricing inventory status',
      limit,
      sort: { name: 1 }
    });

    return products.map(p => this.transformProductToUppercase(p));
  }

  /**
   * Get price for product by customer type and quantity
   * @param {string} productId - Product ID
   * @param {string} customerType - Customer type
   * @param {number} quantity - Quantity
   * @returns {Promise<object>}
   */
  async getPriceForCustomerType(productId, customerType, quantity) {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    const price = product.getPriceForCustomerType(customerType, quantity);

    return {
      product: {
        id: product._id,
        name: product.name
      },
      customerType,
      quantity,
      unitPrice: price,
      totalPrice: price * quantity,
      availableStock: product.inventory?.currentStock || 0
    };
  }

  /**
   * Check if product exists by name
   * @param {string} name - Product name
   * @returns {Promise<boolean>}
   */
  async productExistsByName(name) {
    const product = await productRepository.findOne({ name: name.trim() });
    return !!product;
  }

  /**
   * Update product investors
   * @param {string} productId - Product ID
   * @param {Array} investors - Array of investor objects
   * @returns {Promise<Product>}
   */
  async updateProductInvestors(productId, investors) {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    // Validate all investors exist
    for (const inv of investors) {
      const investor = await investorRepository.findById(inv.investor);
      if (!investor) {
        throw new Error(`Investor ${inv.investor} not found`);
      }
    }

    // Update product investors
    const updatedInvestors = investors.map(inv => ({
      investor: inv.investor,
      sharePercentage: inv.sharePercentage || 30,
      addedAt: new Date()
    }));

    product.investors = updatedInvestors;
    product.hasInvestors = product.investors.length > 0;

    await product.save();

    // Populate investors before returning
    await product.populate('investors.investor', 'name email');

    return product;
  }

  /**
   * Remove investor from product
   * @param {string} productId - Product ID
   * @param {string} investorId - Investor ID
   * @returns {Promise<Product>}
   */
  async removeProductInvestor(productId, investorId) {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    product.investors = product.investors.filter(
      inv => inv.investor.toString() !== investorId
    );
    product.hasInvestors = product.investors.length > 0;

    await product.save();

    // Populate investors before returning
    await product.populate('investors.investor', 'name email');

    return product;
  }

  /**
   * Get last purchase price for a product
   * @param {string} productId - Product ID
   * @returns {Promise<object|null>}
   */
  async getLastPurchasePrice(productId) {
    const lastPurchase = await purchaseInvoiceRepository.findLastPurchaseForProduct(
      productId,
      {
        select: 'items invoiceNumber createdAt',
        lean: true
      }
    );

    if (!lastPurchase) {
      return null;
    }

    // Find the item for this product in the invoice
    const productItem = lastPurchase.items.find(
      item => item.product.toString() === productId.toString()
    );

    if (!productItem) {
      return null;
    }

    return {
      lastPurchasePrice: productItem.unitCost,
      invoiceNumber: lastPurchase.invoiceNumber,
      purchaseDate: lastPurchase.createdAt
    };
  }

  /**
   * Get last purchase prices for multiple products
   * @param {Array<string>} productIds - Array of product IDs
   * @returns {Promise<object>}
   */
  async getLastPurchasePrices(productIds) {
    const prices = {};

    // Process all products in parallel for better performance
    const pricePromises = productIds.map(async (productId) => {
      const priceInfo = await this.getLastPurchasePrice(productId);
      if (priceInfo) {
        prices[productId] = {
          productId: productId,
          lastPurchasePrice: priceInfo.lastPurchasePrice,
          invoiceNumber: priceInfo.invoiceNumber,
          purchaseDate: priceInfo.purchaseDate
        };
      }
    });

    await Promise.all(pricePromises);

    return prices;
  }
}

module.exports = new ProductService();

