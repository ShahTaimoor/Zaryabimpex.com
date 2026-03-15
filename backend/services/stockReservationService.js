const Inventory = require('../models/Inventory');

class StockReservationService {
  /**
   * Reserve stock with expiration
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to reserve
   * @param {Object} options - Reservation options
   * @returns {Promise<Object>}
   */
  async reserveStock(productId, quantity, options = {}) {
    const {
      userId,
      expiresInMinutes = 15, // Default 15 minutes for cart reservations
      referenceType = 'cart',
      referenceId = null,
      reservationId = null
    } = options;

    const inventory = await Inventory.findOne({ product: productId });
    if (!inventory) {
      throw new Error('Inventory record not found');
    }

    // Calculate available stock (current - reserved)
    const totalReserved = inventory.reservations
      .filter(r => new Date(r.expiresAt) > new Date())
      .reduce((sum, r) => sum + r.quantity, 0);
    
    const availableStock = inventory.currentStock - totalReserved;

    if (availableStock < quantity) {
      throw new Error(`Insufficient available stock. Available: ${availableStock}, Requested: ${quantity}`);
    }

    // Generate reservation ID if not provided
    const resId = reservationId || `RES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    // Add reservation
    inventory.reservations.push({
      reservationId: resId,
      quantity,
      expiresAt,
      reservedBy: userId,
      referenceType,
      referenceId,
      createdAt: new Date()
    });

    // Update reserved stock
    inventory.reservedStock = totalReserved + quantity;
    inventory.availableStock = Math.max(0, inventory.currentStock - inventory.reservedStock);

    await inventory.save();

    return {
      reservationId: resId,
      quantity,
      expiresAt,
      productId,
      availableStock: inventory.availableStock
    };
  }

  /**
   * Release reserved stock
   * @param {string} productId - Product ID
   * @param {string} reservationId - Reservation ID
   * @returns {Promise<Object>}
   */
  async releaseReservation(productId, reservationId) {
    const inventory = await Inventory.findOne({ product: productId });
    if (!inventory) {
      throw new Error('Inventory record not found');
    }

    const reservationIndex = inventory.reservations.findIndex(
      r => r.reservationId === reservationId
    );

    if (reservationIndex === -1) {
      throw new Error('Reservation not found');
    }

    const reservation = inventory.reservations[reservationIndex];
    inventory.reservations.splice(reservationIndex, 1);

    // Recalculate reserved stock
    const totalReserved = inventory.reservations
      .filter(r => new Date(r.expiresAt) > new Date())
      .reduce((sum, r) => sum + r.quantity, 0);

    inventory.reservedStock = totalReserved;
    inventory.availableStock = Math.max(0, inventory.currentStock - inventory.reservedStock);

    await inventory.save();

    return {
      released: true,
      reservationId,
      availableStock: inventory.availableStock
    };
  }

  /**
   * Release all expired reservations
   * @returns {Promise<Object>}
   */
  async releaseExpiredReservations() {
    const now = new Date();
    const inventories = await Inventory.find({
      'reservations.expiresAt': { $lt: now }
    });

    const results = {
      inventoriesProcessed: 0,
      reservationsReleased: 0,
      totalQuantityReleased: 0
    };

    for (const inventory of inventories) {
      const initialCount = inventory.reservations.length;
      
      // Remove expired reservations
      inventory.reservations = inventory.reservations.filter(
        r => new Date(r.expiresAt) >= now
      );

      const removedCount = initialCount - inventory.reservations.length;

      if (removedCount > 0) {
        // Recalculate reserved stock
        const totalReserved = inventory.reservations
          .filter(r => new Date(r.expiresAt) > new Date())
          .reduce((sum, r) => sum + r.quantity, 0);

        inventory.reservedStock = totalReserved;
        inventory.availableStock = Math.max(0, inventory.currentStock - inventory.reservedStock);

        await inventory.save();

        results.inventoriesProcessed++;
        results.reservationsReleased += removedCount;
      }
    }

    return results;
  }

  /**
   * Extend reservation expiration
   * @param {string} productId - Product ID
   * @param {string} reservationId - Reservation ID
   * @param {number} additionalMinutes - Minutes to add
   * @returns {Promise<Object>}
   */
  async extendReservation(productId, reservationId, additionalMinutes) {
    const inventory = await Inventory.findOne({ product: productId });
    if (!inventory) {
      throw new Error('Inventory record not found');
    }

    const reservation = inventory.reservations.find(
      r => r.reservationId === reservationId
    );

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    // Extend expiration
    const newExpiresAt = new Date(reservation.expiresAt);
    newExpiresAt.setMinutes(newExpiresAt.getMinutes() + additionalMinutes);
    reservation.expiresAt = newExpiresAt;

    await inventory.save();

    return {
      reservationId,
      newExpiresAt,
      productId
    };
  }

  /**
   * Get active reservations for a product
   * @param {string} productId - Product ID
   * @returns {Promise<Array>}
   */
  async getActiveReservations(productId) {
    const inventory = await Inventory.findOne({ product: productId });
    if (!inventory) {
      return [];
    }

    const now = new Date();
    return inventory.reservations.filter(r => new Date(r.expiresAt) > now);
  }
}

module.exports = new StockReservationService();

