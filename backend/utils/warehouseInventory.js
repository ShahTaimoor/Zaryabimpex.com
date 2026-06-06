'use strict';

/**
 * Warehouse / shop split inventory (purchases → warehouse, sales → shop, transfers).
 * Stored in settings.order_settings.warehouseInventoryEnabled; default off.
 */

function isWarehouseInventoryEnabled(settings) {
  return settings?.orderSettings?.warehouseInventoryEnabled === true;
}

async function requireWarehouseInventoryEnabled(req, res, next) {
  try {
    const settingsService = require('../services/settingsService');
    const settings = await settingsService.getCompanySettings();
    if (!isWarehouseInventoryEnabled(settings)) {
      return res.status(403).json({
        success: false,
        message: 'Warehouse inventory is disabled. Enable it in Settings to use this feature.',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  isWarehouseInventoryEnabled,
  requireWarehouseInventoryEnabled,
};
