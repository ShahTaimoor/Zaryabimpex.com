/**
 * Migration Script: Add Soft Delete Fields to Existing Records
 * 
 * This script adds `isDeleted` and `deletedAt` fields to all existing documents
 * in models that support soft delete functionality.
 * 
 * Usage:
 *   node backend/migrations/addSoftDeleteFields.js
 * 
 * Or run via MongoDB shell:
 *   mongo your-database-name backend/migrations/addSoftDeleteFields.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import all models that now support soft delete
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Sales = require('../models/Sales');
const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const Return = require('../models/Return');
const Transaction = require('../models/Transaction');
const Inventory = require('../models/Inventory');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Category = require('../models/Category');
const Warehouse = require('../models/Warehouse');
const Bank = require('../models/Bank');
const Investor = require('../models/Investor');

// Models to migrate
const modelsToMigrate = [
  { name: 'Product', model: Product },
  { name: 'Customer', model: Customer },
  { name: 'Supplier', model: Supplier },
  { name: 'Sales', model: Sales },
  { name: 'PurchaseOrder', model: PurchaseOrder },
  { name: 'PurchaseInvoice', model: PurchaseInvoice },
  { name: 'Return', model: Return },
  { name: 'Transaction', model: Transaction },
  { name: 'Inventory', model: Inventory },
  { name: 'Employee', model: Employee },
  { name: 'User', model: User },
  { name: 'Category', model: Category },
  { name: 'Warehouse', model: Warehouse },
  { name: 'Bank', model: Bank },
  { name: 'Investor', model: Investor }
];

/**
 * Add soft delete fields to documents that don't have them
 */
async function addSoftDeleteFields() {
  try {
    console.log('🚀 Starting soft delete fields migration...\n');

    const results = {
      total: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    for (const { name, model } of modelsToMigrate) {
      try {
        console.log(`📝 Processing ${name}...`);

        // Find all documents that don't have isDeleted field
        const documentsWithoutField = await model.find({
          $or: [
            { isDeleted: { $exists: false } },
            { deletedAt: { $exists: false } }
          ]
        });

        if (documentsWithoutField.length === 0) {
          console.log(`   ✅ ${name}: No documents need updating\n`);
          results.skipped++;
          continue;
        }

        // Update all documents to add soft delete fields
        const updateResult = await model.updateMany(
          {
            $or: [
              { isDeleted: { $exists: false } },
              { deletedAt: { $exists: false } }
            ]
          },
          {
            $set: {
              isDeleted: false,
              deletedAt: null
            }
          }
        );

        results.total += documentsWithoutField.length;
        results.updated += updateResult.modifiedCount;

        console.log(`   ✅ ${name}: Updated ${updateResult.modifiedCount} documents\n`);
      } catch (error) {
        console.error(`   ❌ ${name}: Error - ${error.message}\n`);
        results.errors.push({ model: name, error: error.message });
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary');
    console.log('='.repeat(50));
    console.log(`Total documents processed: ${results.total}`);
    console.log(`Documents updated: ${results.updated}`);
    console.log(`Models skipped (already migrated): ${results.skipped}`);
    console.log(`Errors: ${results.errors.length}`);

    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      results.errors.forEach(({ model, error }) => {
        console.log(`   - ${model}: ${error}`);
      });
    }

    console.log('\n✅ Migration completed!');
    return results;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Update unique indexes to handle soft deletes
 * Makes unique indexes sparse or adds partial filter for isDeleted: false
 */
async function updateUniqueIndexes() {
  try {
    console.log('\n🔧 Updating unique indexes for soft delete support...\n');

    const indexUpdates = [];

    // Product - name should be unique only for non-deleted products
    try {
      await Product.collection.dropIndex('name_1').catch(() => {});
      await Product.collection.createIndex(
        { name: 1 },
        { 
          unique: true, 
          partialFilterExpression: { isDeleted: false } 
        }
      );
      console.log('✅ Product.name index updated');
      indexUpdates.push('Product.name');
    } catch (error) {
      console.log(`⚠️  Product.name index: ${error.message}`);
    }

    // Customer - businessName should be unique only for non-deleted customers
    try {
      await Customer.collection.dropIndex('businessName_1').catch(() => {});
      await Customer.collection.createIndex(
        { businessName: 1 },
        { 
          unique: true, 
          partialFilterExpression: { isDeleted: false } 
        }
      );
      console.log('✅ Customer.businessName index updated');
      indexUpdates.push('Customer.businessName');
    } catch (error) {
      console.log(`⚠️  Customer.businessName index: ${error.message}`);
    }

    // Customer - email should be unique only for non-deleted customers
    try {
      await Customer.collection.dropIndex('email_1').catch(() => {});
      await Customer.collection.createIndex(
        { email: 1 },
        { 
          unique: true, 
          partialFilterExpression: { isDeleted: false, email: { $exists: true, $ne: null } } 
        }
      );
      console.log('✅ Customer.email index updated');
      indexUpdates.push('Customer.email');
    } catch (error) {
      console.log(`⚠️  Customer.email index: ${error.message}`);
    }

    // Supplier - companyName should be unique only for non-deleted suppliers
    try {
      await Supplier.collection.dropIndex('companyName_1').catch(() => {});
      await Supplier.collection.createIndex(
        { companyName: 1 },
        { 
          unique: true, 
          partialFilterExpression: { isDeleted: false } 
        }
      );
      console.log('✅ Supplier.companyName index updated');
      indexUpdates.push('Supplier.companyName');
    } catch (error) {
      console.log(`⚠️  Supplier.companyName index: ${error.message}`);
    }

    // User - email should be unique only for non-deleted users
    try {
      await User.collection.dropIndex('email_1').catch(() => {});
      await User.collection.createIndex(
        { email: 1 },
        { 
          unique: true, 
          partialFilterExpression: { isDeleted: false } 
        }
      );
      console.log('✅ User.email index updated');
      indexUpdates.push('User.email');
    } catch (error) {
      console.log(`⚠️  User.email index: ${error.message}`);
    }

    // Warehouse - code should be unique only for non-deleted warehouses
    try {
      await Warehouse.collection.dropIndex('code_1').catch(() => {});
      await Warehouse.collection.createIndex(
        { code: 1 },
        { 
          unique: true, 
          partialFilterExpression: { isDeleted: false } 
        }
      );
      console.log('✅ Warehouse.code index updated');
      indexUpdates.push('Warehouse.code');
    } catch (error) {
      console.log(`⚠️  Warehouse.code index: ${error.message}`);
    }

    // Investor - email should be unique only for non-deleted investors
    try {
      await Investor.collection.dropIndex('email_1').catch(() => {});
      await Investor.collection.createIndex(
        { email: 1 },
        { 
          unique: true, 
          partialFilterExpression: { isDeleted: false } 
        }
      );
      console.log('✅ Investor.email index updated');
      indexUpdates.push('Investor.email');
    } catch (error) {
      console.log(`⚠️  Investor.email index: ${error.message}`);
    }

    // Inventory - product should be unique only for non-deleted inventory
    try {
      await Inventory.collection.dropIndex('product_1').catch(() => {});
      await Inventory.collection.createIndex(
        { product: 1 },
        { 
          unique: true, 
          partialFilterExpression: { isDeleted: false } 
        }
      );
      console.log('✅ Inventory.product index updated');
      indexUpdates.push('Inventory.product');
    } catch (error) {
      console.log(`⚠️  Inventory.product index: ${error.message}`);
    }

    console.log(`\n✅ Updated ${indexUpdates.length} unique indexes`);
    return indexUpdates;
  } catch (error) {
    console.error('❌ Index update failed:', error);
    throw error;
  }
}

/**
 * Create indexes for isDeleted field for better query performance
 */
async function createSoftDeleteIndexes() {
  try {
    console.log('\n📇 Creating isDeleted indexes for better performance...\n');

    const indexesCreated = [];

    for (const { name, model } of modelsToMigrate) {
      try {
        // Check if index already exists
        const indexes = await model.collection.getIndexes();
        if (indexes['isDeleted_1']) {
          console.log(`   ⏭️  ${name}: isDeleted index already exists`);
          continue;
        }

        await model.collection.createIndex({ isDeleted: 1 });
        console.log(`   ✅ ${name}: isDeleted index created`);
        indexesCreated.push(name);
      } catch (error) {
        console.log(`   ⚠️  ${name}: ${error.message}`);
      }
    }

    console.log(`\n✅ Created ${indexesCreated.length} isDeleted indexes`);
    return indexesCreated;
  } catch (error) {
    console.error('❌ Index creation failed:', error);
    throw error;
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  const connectionString = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sa-pos';

  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    // Run migrations
    await addSoftDeleteFields();
    await updateUniqueIndexes();
    await createSoftDeleteIndexes();

    console.log('\n' + '='.repeat(50));
    console.log('🎉 All migrations completed successfully!');
    console.log('='.repeat(50));
    console.log('\n📝 Next steps:');
    console.log('   1. Verify data integrity');
    console.log('   2. Test soft delete functionality');
    console.log('   3. Test restore functionality');
    console.log('   4. Monitor application for any issues\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run migration if script is executed directly
if (require.main === module) {
  runMigration().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  addSoftDeleteFields,
  updateUniqueIndexes,
  createSoftDeleteIndexes,
  runMigration
};

