const InvestorRepository = require('../repositories/InvestorRepository');
const ProductRepository = require('../repositories/ProductRepository');
const profitDistributionService = require('../services/profitDistributionService');

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
      filter.$or = [
        { name: { $regex: queryParams.search, $options: 'i' } },
        { email: { $regex: queryParams.search, $options: 'i' } },
        { phone: { $regex: queryParams.search, $options: 'i' } }
      ];
    }

    return await InvestorRepository.findWithFilters(filter, {
      sort: { createdAt: -1 }
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
      investor,
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

    return newInvestor;
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

    const updatedInvestor = await InvestorRepository.update(id, {
      ...updateData,
      updatedBy: userId
    });

    return updatedInvestor;
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

    // Check if investor is linked to any products
    const productsWithInvestor = await ProductRepository.findAll({
      'investors.investor': id
    });

    if (productsWithInvestor.length > 0) {
      throw new Error(`Cannot delete investor. They are linked to ${productsWithInvestor.length} product(s).`);
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
    const products = await ProductRepository.findAll({
      'investors.investor': investorId
    }, {
      populate: [
        { path: 'category', select: 'name' }
      ]
    });

    return products;
  }
}

module.exports = new InvestorService();

