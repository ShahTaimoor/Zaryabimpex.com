# Database Migrations

This directory contains database migration scripts for the SA-POS system.

## Available Migrations

### 1. Add Soft Delete Fields (`addSoftDeleteFields.js`)

Adds `isDeleted` and `deletedAt` fields to all existing documents in models that support soft delete.

**What it does:**
- Adds `isDeleted: false` and `deletedAt: null` to all existing documents
- Updates unique indexes to handle soft deletes (partial filter expressions)
- Creates `isDeleted` indexes for better query performance

**Models affected:**
- Product, Customer, Supplier
- Sales, PurchaseOrder, PurchaseInvoice, Return
- Transaction, Inventory, Employee, User
- Category, Warehouse, Bank, Investor

**Usage:**
```bash
# From project root
node backend/migrations/addSoftDeleteFields.js
```

**Or using npm script (if added to package.json):**
```bash
npm run migrate:soft-delete
```

## Running Migrations

### Prerequisites
1. Ensure MongoDB is running
2. Set `MONGODB_URI` or `MONGO_URI` in your `.env` file
3. Backup your database before running migrations

### Steps

1. **Backup your database:**
   ```bash
   mongodump --uri="your-connection-string" --out=./backup
   ```

2. **Run the migration:**
   ```bash
   node backend/migrations/addSoftDeleteFields.js
   ```

3. **Verify the migration:**
   - Check that documents have `isDeleted` and `deletedAt` fields
   - Test soft delete functionality
   - Test restore functionality

## Safety

- ✅ **Idempotent**: Can be run multiple times safely
- ✅ **Non-destructive**: Only adds fields, doesn't modify existing data
- ✅ **Reversible**: Can be undone by removing the fields (if needed)

## Rollback

If you need to rollback the migration:

```javascript
// Remove soft delete fields (use with caution)
await Model.updateMany(
  {},
  { $unset: { isDeleted: "", deletedAt: "" } }
);
```

## Notes

- The migration is safe to run on production data
- It only adds fields to documents that don't have them
- Unique indexes are updated to allow soft-deleted records
- The migration can be run multiple times without issues

