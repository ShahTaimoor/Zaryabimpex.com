/**
 * Tax Calculation Service
 * 
 * This service calculates tax liability for P&L reporting:
 * - Sales tax (collected from customers)
 * - Income tax (based on net income)
 * - Supports tax rules and rates
 */

const SalesRepository = require('../repositories/SalesRepository');
const TransactionRepository = require('../repositories/TransactionRepository');
const ChartOfAccountsRepository = require('../repositories/ChartOfAccountsRepository');

class TaxCalculationService {
  constructor() {
    // Default income tax rates (can be configured)
    this.incomeTaxRates = {
      // Progressive tax brackets (example for US)
      brackets: [
        { min: 0, max: 10000, rate: 0.10 },      // 10% for first $10k
        { min: 10000, max: 40000, rate: 0.12 },  // 12% for $10k-$40k
        { min: 40000, max: 85000, rate: 0.22 },  // 22% for $40k-$85k
        { min: 85000, max: 163000, rate: 0.24 }, // 24% for $85k-$163k
        { min: 163000, max: 207000, rate: 0.32 }, // 32% for $163k-$207k
        { min: 207000, max: 518000, rate: 0.35 }, // 35% for $207k-$518k
        { min: 518000, max: Infinity, rate: 0.37 } // 37% for over $518k
      ],
      // Flat rate option (if preferred)
      flatRate: null, // Set to a number (e.g., 0.21 for 21%) to use flat rate instead
    };
  }

  /**
   * Calculate sales tax from actual sales
   * @param {Object} period - Period object with startDate and endDate
   * @returns {Object} - Sales tax data
   */
  async calculateSalesTax(period) {
    // Get sales tax from sales orders
    const salesOrders = await SalesRepository.findAll({
      createdAt: { $gte: period.startDate, $lte: period.endDate },
      status: { $in: ['completed', 'delivered', 'shipped', 'confirmed'] }
    }, {
      select: 'pricing.taxAmount pricing.isTaxExempt pricing.subtotal pricing.discountAmount createdAt',
      lean: true
    });

    let totalSalesTax = 0;
    let taxableSales = 0;
    let taxExemptSales = 0;
    const taxByMonth = {};

    salesOrders.forEach(order => {
      const taxAmount = order.pricing?.taxAmount || 0;
      const isTaxExempt = order.pricing?.isTaxExempt || false;

      if (!isTaxExempt && taxAmount > 0) {
        totalSalesTax += taxAmount;
        taxableSales += (order.pricing?.subtotal || 0) - (order.pricing?.discountAmount || 0);
      } else {
        taxExemptSales += (order.pricing?.subtotal || 0) - (order.pricing?.discountAmount || 0);
      }

      // Group by month for reporting
      const month = order.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!taxByMonth[month]) {
        taxByMonth[month] = 0;
      }
      if (!isTaxExempt) {
        taxByMonth[month] += taxAmount;
      }
    });

    // Also check for sales tax payable account transactions
    const salesTaxPayableAccount = await ChartOfAccountsRepository.findOne({
      accountCode: '2120',
      accountName: { $regex: /sales.*tax.*payable/i },
      isActive: true
    });

    let salesTaxFromTransactions = 0;
    if (salesTaxPayableAccount) {
      const salesTaxTransactions = await TransactionRepository.findAll({
        accountCode: salesTaxPayableAccount.accountCode,
        createdAt: { $gte: period.startDate, $lte: period.endDate },
        status: 'completed',
        creditAmount: { $gt: 0 } // Sales tax payable is a credit
      }, {
        lean: true
      });

      salesTaxTransactions.forEach(transaction => {
        salesTaxFromTransactions += transaction.creditAmount || 0;
      });
    }

    // Use the higher of the two (sales tax from orders or transactions)
    // This handles cases where tax might be recorded differently
    const finalSalesTax = Math.max(totalSalesTax, salesTaxFromTransactions);

    return {
      salesTax: finalSalesTax,
      taxableSales: taxableSales,
      taxExemptSales: taxExemptSales,
      taxByMonth: taxByMonth,
      source: totalSalesTax >= salesTaxFromTransactions ? 'sales_orders' : 'transactions'
    };
  }

  /**
   * Calculate income tax based on earnings before tax
   * @param {number} earningsBeforeTax - Earnings before tax (net income before taxes)
   * @param {Object} options - Tax calculation options
   * @returns {Object} - Income tax data
   */
  calculateIncomeTax(earningsBeforeTax, options = {}) {
    if (earningsBeforeTax <= 0) {
      return {
        current: 0,
        deferred: 0,
        total: 0,
        effectiveRate: 0,
        calculation: 'No income tax (loss or zero income)'
      };
    }

    // Use flat rate if configured, otherwise use progressive brackets
    if (this.incomeTaxRates.flatRate !== null && this.incomeTaxRates.flatRate !== undefined) {
      const taxAmount = earningsBeforeTax * this.incomeTaxRates.flatRate;
      return {
        current: taxAmount,
        deferred: 0,
        total: taxAmount,
        effectiveRate: this.incomeTaxRates.flatRate * 100,
        calculation: `Flat rate: ${earningsBeforeTax} × ${(this.incomeTaxRates.flatRate * 100).toFixed(1)}% = ${taxAmount.toFixed(2)}`
      };
    }

    // Progressive tax calculation
    let totalTax = 0;
    let remainingIncome = earningsBeforeTax;
    const bracketDetails = [];

    for (const bracket of this.incomeTaxRates.brackets) {
      if (remainingIncome <= 0) break;

      const taxableInBracket = Math.min(
        remainingIncome,
        bracket.max === Infinity ? remainingIncome : bracket.max - bracket.min
      );

      if (taxableInBracket > 0) {
        const taxInBracket = taxableInBracket * bracket.rate;
        totalTax += taxInBracket;
        remainingIncome -= taxableInBracket;

        bracketDetails.push({
          bracket: `$${bracket.min.toLocaleString()} - ${bracket.max === Infinity ? '∞' : '$' + bracket.max.toLocaleString()}`,
          taxable: taxableInBracket,
          rate: bracket.rate * 100,
          tax: taxInBracket
        });
      }
    }

    const effectiveRate = earningsBeforeTax > 0 ? (totalTax / earningsBeforeTax) * 100 : 0;

    return {
      current: totalTax,
      deferred: 0, // Deferred tax would require more complex accounting
      total: totalTax,
      effectiveRate: effectiveRate,
      calculation: `Progressive tax brackets applied`,
      bracketDetails: bracketDetails
    };
  }

  /**
   * Calculate all taxes for P&L statement
   * @param {Object} period - Period object with startDate and endDate
   * @param {number} earningsBeforeTax - Earnings before tax
   * @returns {Object} - Complete tax data
   */
  async calculateAllTaxes(period, earningsBeforeTax) {
    const salesTaxData = await this.calculateSalesTax(period);
    const incomeTaxData = this.calculateIncomeTax(earningsBeforeTax);

    return {
      salesTax: salesTaxData,
      incomeTax: incomeTaxData,
      totalTax: salesTaxData.salesTax + incomeTaxData.total
    };
  }

  /**
   * Set income tax rate configuration
   * @param {Object} config - Tax configuration
   */
  setTaxRates(config) {
    if (config.flatRate !== undefined) {
      this.incomeTaxRates.flatRate = config.flatRate;
    }
    if (config.brackets) {
      this.incomeTaxRates.brackets = config.brackets;
    }
  }

  /**
   * Get current tax rate configuration
   * @returns {Object} - Current tax configuration
   */
  getTaxRates() {
    return { ...this.incomeTaxRates };
  }
}

module.exports = new TaxCalculationService();

