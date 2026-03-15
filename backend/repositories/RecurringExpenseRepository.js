const BaseRepository = require('./BaseRepository');
const RecurringExpense = require('../models/RecurringExpense');

class RecurringExpenseRepository extends BaseRepository {
  constructor() {
    super(RecurringExpense);
  }

  /**
   * Find recurring expenses with filtering
   * @param {object} filter - Filter query
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findWithFilter(filter = {}, options = {}) {
    const {
      sort = { nextDueDate: 1, name: 1 },
      populate = [
        { path: 'supplier', select: 'name companyName businessName displayName' },
        { path: 'customer', select: 'name firstName lastName businessName displayName email' },
        { path: 'bank', select: 'bankName accountNumber accountName' },
        { path: 'expenseAccount', select: 'accountName accountCode' }
      ]
    } = options;

    let queryBuilder = this.Model.find(filter);
    
    if (populate && populate.length > 0) {
      populate.forEach(pop => {
        queryBuilder = queryBuilder.populate(pop);
      });
    }
    
    if (sort) {
      queryBuilder = queryBuilder.sort(sort);
    }

    return await queryBuilder;
  }

  /**
   * Find recurring expense by ID with session support (for transactions)
   * @param {string} id - Recurring expense ID
   * @param {object} options - Query options including session
   * @returns {Promise<RecurringExpense|null>}
   */
  async findByIdWithSession(id, options = {}) {
    const { session } = options;
    let queryBuilder = this.Model.findById(id);
    
    if (session) {
      queryBuilder = queryBuilder.session(session);
    }
    
    return await queryBuilder;
  }
}

module.exports = new RecurringExpenseRepository();

