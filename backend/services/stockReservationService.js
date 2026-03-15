const inventoryRepository = require('../repositories/InventoryRepository');

function getReservations(inventory) {
  const r = inventory?.reservations;
  return Array.isArray(r) ? r : (typeof r === 'string' ? JSON.parse(r || '[]') : []);
}

function getCurrentStock(inventory) {
  return Number(inventory?.current_stock ?? inventory?.currentStock ?? 0);
}

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
      expiresInMinutes = 15,
      referenceType = 'cart',
      referenceId = null,
      reservationId = null
    } = options;

    const inventory = await inventoryRepository.findOne({ product: productId });
    if (!inventory) {
      throw new Error('Inventory record not found');
    }

    const reservations = getReservations(inventory);
    const now = new Date();
    const totalReserved = reservations
      .filter(r => new Date(r.expiresAt) > now)
      .reduce((sum, r) => sum + r.quantity, 0);
    const currentStock = getCurrentStock(inventory);
    const availableStock = currentStock - totalReserved;

    if (availableStock < quantity) {
      throw new Error(`Insufficient available stock. Available: ${availableStock}, Requested: ${quantity}`);
    }

    const resId = reservationId || `RES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    reservations.push({
      reservationId: resId,
      quantity,
      expiresAt,
      reservedBy: userId,
      referenceType,
      referenceId,
      createdAt: new Date()
    });

    const newReserved = totalReserved + quantity;
    const newAvailable = Math.max(0, currentStock - newReserved);

    await inventoryRepository.updateByProductId(productId, {
      reservations,
      reservedStock: newReserved,
      availableStock: newAvailable
    });

    return {
      reservationId: resId,
      quantity,
      expiresAt,
      productId,
      availableStock: newAvailable
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
    const allRows = await inventoryRepository.findAll({});
    const results = {
      inventoriesProcessed: 0,
      reservationsReleased: 0,
      totalQuantityReleased: 0
    };

    for (const inventory of allRows) {
      const reservations = getReservations(inventory);
      const expiredCount = reservations.filter(r => new Date(r.expiresAt) < now).length;
      if (expiredCount === 0) continue;

      const stillActive = reservations.filter(r => new Date(r.expiresAt) >= now);
      const totalReserved = stillActive
        .filter(r => new Date(r.expiresAt) > now)
        .reduce((sum, r) => sum + r.quantity, 0);
      const currentStock = getCurrentStock(inventory);
      const availableStock = Math.max(0, currentStock - totalReserved);

      await inventoryRepository.updateById(inventory.id, {
        reservations: stillActive,
        reservedStock: totalReserved,
        availableStock
      });

      results.inventoriesProcessed++;
      results.reservationsReleased += expiredCount;
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
    const inventory = await inventoryRepository.findOne({ product: productId });
    if (!inventory) {
      throw new Error('Inventory record not found');
    }

    const reservations = getReservations(inventory);
    const reservation = reservations.find(r => r.reservationId === reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    const newExpiresAt = new Date(reservation.expiresAt);
    newExpiresAt.setMinutes(newExpiresAt.getMinutes() + additionalMinutes);
    reservation.expiresAt = newExpiresAt;

    await inventoryRepository.updateByProductId(productId, { reservations });

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
    const inventory = await inventoryRepository.findOne({ product: productId });
    if (!inventory) {
      return [];
    }
    const now = new Date();
    return getReservations(inventory).filter(r => new Date(r.expiresAt) > now);
  }
}

module.exports = new StockReservationService();

