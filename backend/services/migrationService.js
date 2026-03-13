const SalesRepository = require('../repositories/SalesRepository');

class MigrationService {
  /**
   * Update invoice prefix from ORD- to SI-
   * @returns {Promise<object>}
   */
  async updateInvoicePrefix() {
    // Find all orders with ORD- prefix
    const ordersToUpdate = await SalesRepository.findAll({
      orderNumber: { $regex: '^ORD-' }
    });

    if (ordersToUpdate.length === 0) {
      return {
        success: true,
        message: 'No orders found with ORD- prefix. Nothing to update.',
        updated: 0,
        total: 0,
        updates: []
      };
    }

    // Update each order
    let updatedCount = 0;
    let skippedCount = 0;
    const updates = [];

    for (const order of ordersToUpdate) {
      const oldOrderNumber = order.orderNumber;
      const newOrderNumber = order.orderNumber.replace('ORD-', 'SI-');

      // Check if the new order number already exists
      const existingOrder = await SalesRepository.findOne({ orderNumber: newOrderNumber });
      if (existingOrder) {
        updates.push({
          oldNumber: oldOrderNumber,
          newNumber: newOrderNumber,
          status: 'skipped',
          reason: 'Order number already exists'
        });
        skippedCount++;
        continue;
      }

      // Update the order number
      await SalesRepository.update(order._id, {
        orderNumber: newOrderNumber
      });

      updates.push({
        oldNumber: oldOrderNumber,
        newNumber: newOrderNumber,
        status: 'updated'
      });
      updatedCount++;
    }

    return {
      success: true,
      message: `Migration completed. Updated ${updatedCount} orders, skipped ${skippedCount} orders.`,
      updated: updatedCount,
      skipped: skippedCount,
      total: ordersToUpdate.length,
      updates
    };
  }
}

module.exports = new MigrationService();

