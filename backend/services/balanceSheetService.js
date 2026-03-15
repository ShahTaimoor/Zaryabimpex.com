const balanceSheetRepository = require('../repositories/BalanceSheetRepository');
const balanceSheetCalculationService = require('../services/balanceSheetCalculationService');

class BalanceSheetService {
  /**
   * Generate balance sheet
   * @param {Date} statementDate - Statement date (end date)
   * @param {string} periodType - Period type
   * @param {string} userId - User ID
   * @param {object} dateRange - Optional date range { startDate, endDate }
   * @returns {Promise<object>}
   */
  async generateBalanceSheet(statementDate, periodType, userId, dateRange = {}) {
    return await balanceSheetCalculationService.generateBalanceSheet(
      statementDate, 
      periodType, 
      userId,
      dateRange
    );
  }

  /**
   * Get balance sheets with filters and pagination
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getBalanceSheets(queryParams) {
    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 10;

    const filter = {};

    // Apply filters
    if (queryParams.status) filter.status = queryParams.status;
    if (queryParams.periodType) filter.periodType = queryParams.periodType;

    // Date range filter
    if (queryParams.startDate || queryParams.endDate) {
      filter.statementDate = {};
      if (queryParams.startDate) filter.statementDate.$gte = queryParams.startDate;
      if (queryParams.endDate) filter.statementDate.$lte = queryParams.endDate;
    }

    // Search filter
    if (queryParams.search) {
      filter.$or = [
        { statementNumber: { $regex: queryParams.search, $options: 'i' } },
        { 'metadata.notes': { $regex: queryParams.search, $options: 'i' } }
      ];
    }

    const result = await balanceSheetRepository.findWithPagination(filter, {
      page,
      limit,
      sort: { statementDate: -1 },
      populate: [
        { path: 'metadata.generatedBy', select: 'firstName lastName email' }
      ]
    });

    return {
      balanceSheets: result.balanceSheets,
      pagination: result.pagination
    };
  }

  /**
   * Get single balance sheet by ID
   * @param {string} balanceSheetId - Balance sheet ID
   * @returns {Promise<object>}
   */
  async getBalanceSheetById(balanceSheetId) {
    const balanceSheet = await balanceSheetRepository.findById(balanceSheetId, [
      { path: 'metadata.generatedBy', select: 'firstName lastName email' },
      { path: 'auditTrail.performedBy', select: 'firstName lastName email' }
    ]);

    if (!balanceSheet) {
      throw new Error('Balance sheet not found');
    }

    return balanceSheet;
  }

  /**
   * Update balance sheet status
   * @param {string} balanceSheetId - Balance sheet ID
   * @param {string} status - New status
   * @param {string} userId - User ID making the change
   * @param {string} notes - Optional notes
   * @returns {Promise<object>}
   */
  async updateStatus(balanceSheetId, status, userId, notes) {
    const balanceSheet = await balanceSheetRepository.findById(balanceSheetId);
    if (!balanceSheet) {
      throw new Error('Balance sheet not found');
    }

    const updateData = { status };

    // Add approval information if finalizing
    if (status === 'final') {
      updateData['metadata.approvedBy'] = userId;
      updateData['metadata.approvedAt'] = new Date();
    }

    // Add audit trail entry
    const auditEntry = {
      action: 'status_change',
      performedBy: userId,
      performedAt: new Date(),
      details: {
        oldStatus: balanceSheet.status,
        newStatus: status,
        notes: notes || ''
      }
    };

    const currentAuditTrail = balanceSheet.auditTrail || [];
    updateData.auditTrail = [...currentAuditTrail, auditEntry];

    const updatedBalanceSheet = await balanceSheetRepository.update(balanceSheetId, updateData);
    return {
      statementNumber: updatedBalanceSheet.statementNumber,
      status: updatedBalanceSheet.status,
      approvedBy: updatedBalanceSheet.metadata?.approvedBy,
      approvedAt: updatedBalanceSheet.metadata?.approvedAt
    };
  }

  /**
   * Update balance sheet metadata
   * @param {string} balanceSheetId - Balance sheet ID
   * @param {object} updates - Update data
   * @param {string} userId - User ID making the change
   * @returns {Promise<object>}
   */
  async updateMetadata(balanceSheetId, updates, userId) {
    const balanceSheet = await balanceSheetRepository.findById(balanceSheetId);
    if (!balanceSheet) {
      throw new Error('Balance sheet not found');
    }

    const updateData = {};
    if (updates.metadata) {
      updateData.metadata = {
        ...balanceSheet.metadata,
        ...updates.metadata
      };
    }

    // Add audit trail entry
    const auditEntry = {
      action: 'metadata_update',
      performedBy: userId,
      performedAt: new Date(),
      details: updates.metadata || {}
    };

    const currentAuditTrail = balanceSheet.auditTrail || [];
    updateData.auditTrail = [...currentAuditTrail, auditEntry];

    const updatedBalanceSheet = await balanceSheetRepository.update(balanceSheetId, updateData);
    return updatedBalanceSheet;
  }

  /**
   * Update balance sheet data
   * @param {string} balanceSheetId - Balance sheet ID
   * @param {object} updateData - Update data
   * @param {string} userId - User ID making the change
   * @returns {Promise<object>}
   */
  async updateBalanceSheet(balanceSheetId, updateData, userId) {
    const balanceSheet = await balanceSheetRepository.findById(balanceSheetId);
    if (!balanceSheet) {
      throw new Error('Balance sheet not found');
    }

    // Only allow updates to draft status balance sheets
    if (balanceSheet.status !== 'draft') {
      throw new Error('Only draft balance sheets can be updated');
    }

    // Remove protected fields
    const cleanedData = { ...updateData };
    delete cleanedData._id;
    delete cleanedData.statementNumber;
    delete cleanedData.statementDate;
    delete cleanedData.metadata;

    // Update balance sheet data
    Object.assign(balanceSheet, cleanedData);

    // Add audit trail entry (addAuditEntry saves internally)
    await balanceSheet.addAuditEntry(
      'updated',
      userId,
      'Balance sheet data updated',
      cleanedData
    );

    // Save again to ensure all updates are persisted
    await balanceSheet.save();

    return balanceSheet;
  }

  /**
   * Delete balance sheet
   * @param {string} balanceSheetId - Balance sheet ID
   * @returns {Promise<object>}
   */
  async deleteBalanceSheet(balanceSheetId) {
    const balanceSheet = await balanceSheetRepository.findById(balanceSheetId);
    if (!balanceSheet) {
      throw new Error('Balance sheet not found');
    }

    // Only allow deletion of draft balance sheets
    if (balanceSheet.status !== 'draft') {
      throw new Error('Only draft balance sheets can be deleted');
    }

    await balanceSheetRepository.softDelete(balanceSheetId);
    return { message: 'Balance sheet deleted successfully' };
  }

  /**
   * Get latest balance sheet by period type
   * @param {string} periodType - Period type
   * @returns {Promise<object|null>}
   */
  async getLatestByPeriodType(periodType) {
    return await balanceSheetRepository.findLatestByPeriodType(periodType, {
      populate: [
        { path: 'metadata.generatedBy', select: 'firstName lastName email' }
      ]
    });
  }
}

module.exports = new BalanceSheetService();

