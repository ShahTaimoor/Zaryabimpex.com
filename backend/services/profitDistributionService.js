const ProductRepository = require('../repositories/ProductRepository');
const InvestorRepository = require('../repositories/InvestorRepository');
const ProfitShareRepository = require('../repositories/ProfitShareRepository');

class ProfitDistributionService {
  constructor() {
    this.INVESTOR_SHARE_PERCENTAGE = 30;
    this.COMPANY_SHARE_PERCENTAGE = 70;
  }

  /**
   * Calculate and distribute profit for a completed order
   * @param {Object} order - The order document
   * @param {Object} user - The user who processed the order
   * @returns {Promise<Object>} Distribution results
   */
  async distributeProfitForOrder(order, user) {
    try {
      if (!order || order.status !== 'confirmed' && order.payment?.status !== 'paid') {
        throw new Error('Order must be confirmed and paid to distribute profit');
      }

      const distributionResults = {
        orderId: order._id,
        orderNumber: order.orderNumber,
        itemsProcessed: 0,
        profitSharesCreated: [],
        investorsUpdated: [],
        totalInvestorShare: 0,
        totalCompanyShare: 0,
        errors: []
      };

      // Process each item in the order
      for (const item of order.items) {
        try {
          // Get product with investors
          const product = await ProductRepository.findById(item.product, {
            populate: [{ path: 'investors.investor' }]
          });
          
          if (!product) {
            distributionResults.errors.push({
              item: item.product,
              error: 'Product not found'
            });
            continue;
          }

          // Skip if product has no investors
          if (!product.hasInvestors || !product.investors || product.investors.length === 0) {
            continue;
          }

          // Calculate profit for this item
          const saleAmount = item.total || (item.unitPrice * item.quantity);
          const totalCost = product.pricing.cost * item.quantity;
          const totalProfit = saleAmount - totalCost;

          // Skip if no profit or negative profit
          if (totalProfit <= 0) {
            continue;
          }

          // Calculate profit distribution
          // Each product-investor link has its own sharePercentage
          // This represents what % of total profit goes to investors (as a group) for that product
          // If multiple investors on the same product have different sharePercentages, use the average
          // The investor share is then split equally among all investors
          
          // Get average sharePercentage for this product (in case investors have different percentages)
          const totalSharePercentage = product.investors.reduce((sum, inv) => sum + (inv.sharePercentage || 30), 0);
          const averageInvestorSharePercentage = totalSharePercentage / product.investors.length;
          const investorSharePercentage = averageInvestorSharePercentage;
          const companySharePercentage = 100 - investorSharePercentage;

          // Calculate total shares using the average investor share percentage
          const investorShare = (totalProfit * investorSharePercentage) / 100;
          const companyShare = (totalProfit * companySharePercentage) / 100;

          // Prepare investor details
          // Split the investor share equally among all investors for this product
          // Note: Each investor can have different sharePercentages across different products,
          // but on the same product, the investor share is split equally
          const investorDetails = product.investors.map(invLink => {
            // Equal split of investor share among all investors on this product
            const shareAmount = investorShare / product.investors.length;

            return {
              investor: invLink.investor._id || invLink.investor,
              investorName: invLink.investor.name || 'Unknown',
              shareAmount: Math.round(shareAmount * 100) / 100,
              sharePercentage: invLink.sharePercentage || investorSharePercentage // Store each investor's specific percentage for this product
            };
          });

          // Create profit share record for each investor separately
          // This allows tracking individual investor shares with their specific percentages
          for (const invDetail of investorDetails) {
            // Calculate company share per investor (company share is the same, but we record it per investor record)
            const companySharePerInvestor = companyShare / investorDetails.length;
            
            let profitShare;
            try {
              profitShare = await ProfitShareRepository.create({
                order: order._id,
                orderNumber: order.orderNumber,
                orderDate: order.createdAt || new Date(),
                product: product._id,
                productName: product.name,
                quantity: item.quantity,
                saleAmount: Math.round(saleAmount * 100) / 100,
                totalCost: Math.round(totalCost * 100) / 100,
                totalProfit: Math.round(totalProfit * 100) / 100,
                investor: invDetail.investor,
                investorName: invDetail.investorName,
                investorShare: Math.round(invDetail.shareAmount * 100) / 100,
                companyShare: Math.round(companySharePerInvestor * 100) / 100,
                investorSharePercentage: invDetail.sharePercentage,
                companySharePercentage: companySharePercentage,
                status: 'calculated',
                calculatedAt: new Date(),
                calculatedBy: user?._id || null
              });
            } catch (err) {
              if (err.code === 11000) {
                console.log('Duplicate profit share record, skipping:', {
                  order: order.orderNumber,
                  investor: invDetail.investorName
                });
                continue; // Skip this duplicate
              }
              throw err;
            }

            distributionResults.profitSharesCreated.push(profitShare._id);

            // Update investor earnings immediately after creating the record
            try {
              const investor = await InvestorRepository.findById(invDetail.investor);
              if (investor) {
                await investor.addProfit(invDetail.shareAmount);
                distributionResults.investorsUpdated.push({
                  investorId: investor._id,
                  investorName: investor.name,
                  amount: invDetail.shareAmount,
                  productName: product.name,
                  sharePercentage: invDetail.sharePercentage
                });
              }
            } catch (invError) {
              distributionResults.errors.push({
                item: item.product,
                investor: invDetail.investor,
                error: `Failed to update investor: ${invError.message}`
              });
            }

            // Mark profit share as distributed
            profitShare.status = 'distributed';
            await profitShare.save();
          }

          // Track totals for this item
          distributionResults.totalInvestorShare += investorShare;
          distributionResults.totalCompanyShare += companyShare;
          distributionResults.itemsProcessed++;

        } catch (itemError) {
          distributionResults.errors.push({
            item: item.product,
            error: itemError.message
          });
          console.error(`Error processing profit for item ${item.product}:`, itemError);
        }
      }

      // Round totals
      distributionResults.totalInvestorShare = Math.round(distributionResults.totalInvestorShare * 100) / 100;
      distributionResults.totalCompanyShare = Math.round(distributionResults.totalCompanyShare * 100) / 100;

      return distributionResults;
    } catch (error) {
      console.error('Error distributing profit for order:', error);
      throw error;
    }
  }

  /**
   * Get profit shares for a specific order
   */
  async getProfitSharesForOrder(orderId) {
    return await ProfitShareRepository.findByOrder(orderId, {
      populate: [
        { path: 'product', select: 'name' },
        { path: 'investor', select: 'name email' },
        { path: 'investors.investor', select: 'name email' }
      ],
      sort: { createdAt: -1 }
    });
  }

  /**
   * Get profit shares for a specific investor
   */
  async getProfitSharesForInvestor(investorId, startDate, endDate) {
    return await ProfitShareRepository.findByInvestor(investorId, {
      startDate,
      endDate,
      populate: [
        { path: 'order', select: 'orderNumber' },
        { path: 'product', select: 'name' },
        { path: 'investor', select: 'name email' }
      ],
      sort: { orderDate: -1 }
    });
  }

  /**
   * Get summary statistics
   */
  async getProfitSummary(startDate, endDate) {
    const shares = await ProfitShareRepository.findByDateRange({
      startDate,
      endDate,
      lean: true
    });
    
    return {
      totalOrders: new Set(shares.map(s => s.order.toString())).size,
      totalItems: shares.length,
      totalProfit: shares.reduce((sum, s) => sum + s.totalProfit, 0),
      totalInvestorShare: shares.reduce((sum, s) => sum + s.investorShare, 0),
      totalCompanyShare: shares.reduce((sum, s) => sum + s.companyShare, 0),
      sharesByInvestor: shares.reduce((acc, share) => {
        // Handle both new schema (single investor) and legacy schema (investors array)
        if (share.investor) {
          const invId = share.investor.toString();
          if (!acc[invId]) {
            acc[invId] = { name: share.investorName || 'Unknown', total: 0 };
          }
          acc[invId].total += share.investorShare || 0;
        } else if (share.investors && share.investors.length > 0) {
          share.investors.forEach(inv => {
            const invId = inv.investor.toString();
            if (!acc[invId]) {
              acc[invId] = { name: inv.investorName, total: 0 };
            }
            acc[invId].total += inv.shareAmount || 0;
          });
        }
        return acc;
      }, {})
    };
  }
}

module.exports = new ProfitDistributionService();

