const { transaction } = require('../config/postgres');
const InvestorRepository = require('../repositories/InvestorRepository');
const ProductRepository = require('../repositories/ProductRepository');
const profitDistributionService = require('../services/profitDistributionService');
const productServicePostgres = require('../services/productServicePostgres');
const AccountingService = require('../services/accountingService');

/** PostgreSQL rows use `id`; frontend expects `_id` (Mongo-style). */
function withMongoId(row) {
  if (!row) return row;
  const id = row.id || row._id;
  return { ...row, _id: id, id };
}

/** Map Postgres `snake_case` columns to API `camelCase` for the frontend. */
function toApiInvestor(row) {
  if (!row) return row;
  const base = withMongoId(row);
  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const out = {
    ...base,
    totalInvestment: num(row.total_investment ?? row.totalInvestment),
    totalEarnedProfit: num(row.total_earned_profit ?? row.totalEarnedProfit),
    totalPaidOut: num(row.total_paid_out ?? row.totalPaidOut),
    currentBalance: num(row.current_balance ?? row.currentBalance),
    defaultProfitSharePercentage: num(
      row.default_profit_share_percentage ?? row.defaultProfitSharePercentage ?? 30
    ) || 30,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt
  };
  const lp = row.lastPayoutAt ?? row.last_payout_at;
  if (lp != null) {
    out.lastPayoutAt = lp instanceof Date ? lp.toISOString() : lp;
  }
  return out;
}

class InvestorService {
  /**
   * Get investors with filters
   * @param {object} queryParams - Query parameters
   * @returns {Promise<Array>}
   */
  async getInvestors(queryParams) {
    const filter = {};
    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.search) {
      filter.search = queryParams.search;
    }
    const rows = await InvestorRepository.findWithFilters(filter, {
      sort: { createdAt: -1 }
    });
    const ids = rows.map((r) => r.id).filter(Boolean);
    const lastMap = await InvestorRepository.getLastPayoutAtByInvestorIds(ids);
    return rows.map((row) => {
      const api = toApiInvestor(row);
      const at = lastMap.get(row.id);
      if (at) {
        api.lastPayoutAt = at instanceof Date ? at.toISOString() : at;
      }
      return api;
    });
  }

  /**
   * Get single investor by ID
   * @param {string} id - Investor ID
   * @returns {Promise<object>}
   */
  async getInvestorById(id) {
    const investor = await InvestorRepository.findById(id);
    if (!investor) {
      throw new Error('Investor not found');
    }

    // Get profit shares for this investor
    const profitShares = await profitDistributionService.getProfitSharesForInvestor(id);

    return {
      investor: toApiInvestor(investor),
      profitShares
    };
  }

  /**
   * Create investor
   * @param {object} investorData - Investor data
   * @param {string} userId - User ID
   * @returns {Promise<object>}
   */
  async createInvestor(investorData, userId) {
    // Check if email already exists
    const existingInvestor = await InvestorRepository.findByEmail(investorData.email);
    if (existingInvestor) {
      throw new Error('Investor with this email already exists');
    }

    const newInvestor = await InvestorRepository.create({
      ...investorData,
      createdBy: userId
    });

    return toApiInvestor(newInvestor);
  }

  /**
   * Update investor
   * @param {string} id - Investor ID
   * @param {object} updateData - Update data
   * @param {string} userId - User ID
   * @returns {Promise<object>}
   */
  async updateInvestor(id, updateData, userId) {
    const investor = await InvestorRepository.findById(id);
    if (!investor) {
      throw new Error('Investor not found');
    }

    // Check if email is being updated and if it already exists
    if (updateData.email && updateData.email !== investor.email) {
      const emailExists = await InvestorRepository.emailExists(updateData.email, id);
      if (emailExists) {
        throw new Error('Investor with this email already exists');
      }
    }

    const updatedInvestor = await InvestorRepository.updateById(id, {
      ...updateData,
      updatedBy: userId
    });

    return toApiInvestor(updatedInvestor);
  }

  /**
   * Record a payout: investor balances + investor_payouts row + double-entry ledger (atomic).
   * Dr equity/liability (default 3100), Cr 1000 cash or 1001 bank.
   * @param {string} id - Investor ID
   * @param {number} amount - Payout amount
   * @param {string|null} createdBy - User UUID
   * @param {object} [options]
   * @param {'cash'|'bank'} [options.paymentMethod]
   * @param {string} [options.debitAccountCode] - Chart code (equity or liability), default env or 3100
   * @returns {Promise<object>}
   */
  async recordPayout(id, amount, createdBy, options = {}) {
    const paymentMethod = options.paymentMethod === 'bank' ? 'bank' : 'cash';
    const debitAccountCode = String(
      options.debitAccountCode ||
        process.env.INVESTOR_PAYOUT_DEBIT_ACCOUNT ||
        '3100'
    ).toUpperCase();

    return await transaction(async (client) => {
      const { investor, payout } = await InvestorRepository.applyPayoutInTransaction(
        client,
        id,
        amount,
        createdBy,
        { paymentMethod, debitAccountCode }
      );

      const ledgerResult = await AccountingService.recordInvestorPayout(
        {
          investorPayoutId: payout.id,
          investorId: id,
          investorName: investor.name,
          amount: parseFloat(amount),
          paymentMethod,
          debitAccountCode,
          transactionDate: new Date(),
          createdBy: createdBy || null
        },
        client
      );

      await client.query(
        'UPDATE investor_payouts SET ledger_transaction_id = $1 WHERE id = $2',
        [ledgerResult.transactionId, payout.id]
      );

      return toApiInvestor(investor);
    });
  }

  /**
   * Payout history (date + amount per payout).
   */
  async getPayoutHistory(investorId) {
    const inv = await InvestorRepository.findById(investorId);
    if (!inv) {
      throw new Error('Investor not found');
    }
    const rows = await InvestorRepository.findPayoutsByInvestorId(investorId);
    return rows.map((r) => {
      const pm = r.payment_method === 'bank' ? 'bank' : 'cash';
      return {
        id: r.id,
        investorId: r.investor_id,
        amount: parseFloat(r.amount) || 0,
        paidAt: r.paid_at,
        createdAt: r.created_at,
        paymentMethod: pm,
        debitAccountCode: r.debit_account_code || null,
        creditAccountCode: pm === 'bank' ? '1001' : '1000',
        ledgerTransactionId: r.ledger_transaction_id || null
      };
    });
  }

  /**
   * Record new investment (capital received from investor).
   * @param {string} id - Investor ID
   * @param {number} amount - Investment amount
   * @returns {Promise<object>}
   */
  async recordInvestment(id, amount) {
    const row = await InvestorRepository.recordInvestment(id, amount);
    if (!row) throw new Error('Investor not found');
    return toApiInvestor(row);
  }

  /**
   * Delete investor
   * @param {string} id - Investor ID
   * @returns {Promise<object>}
   */
  async deleteInvestor(id) {
    const investor = await InvestorRepository.findById(id);
    if (!investor) {
      throw new Error('Investor not found');
    }

    const linkedCount = await ProductRepository.countProductsByInvestor(id);
    if (linkedCount > 0) {
      throw new Error(`Cannot delete investor. They are linked to ${linkedCount} product(s).`);
    }

    await InvestorRepository.softDelete(id);
    return { message: 'Investor deleted successfully' };
  }

  /**
   * Get products linked to investor
   * @param {string} investorId - Investor ID
   * @returns {Promise<Array>}
   */
  async getProductsForInvestor(investorId) {
    return productServicePostgres.getProductsLinkedToInvestor(investorId);
  }
}

module.exports = new InvestorService();

