const CustomerRepository = require('../repositories/CustomerRepository');
const SalesRepository = require('../repositories/SalesRepository');

/**
 * Customer Analytics Service
 * Provides RFM analysis, segmentation, CLV prediction, and churn risk detection
 */
class CustomerAnalyticsService {
  /**
   * Calculate RFM scores for a customer
   * @param {Object} customer - Customer object
   * @param {Date} analysisDate - Date to analyze from (default: today)
   * @returns {Promise<Object>} RFM scores and metrics
   */
  static async calculateRFM(customer, analysisDate = new Date()) {
    try {
      const customerId = customer && customer._id ? customer._id : customer;
      
      // Get sales data for this customer
      // Include orders that are not cancelled/returned and have been paid (or are confirmed/delivered)
      const sales = await SalesRepository.findAll({
        customer: customerId,
        status: { $nin: ['cancelled', 'returned'] }, // Exclude cancelled and returned orders
        $or: [
          { 'payment.status': { $in: ['paid', 'partial'] } }, // Include paid orders
          { status: { $in: ['confirmed', 'delivered'] } } // Include confirmed/delivered orders even if payment status is pending
        ]
      }, {
        sort: { createdAt: -1 },
        lean: true
      });

      if (!sales || sales.length === 0) {
        return {
          recency: 0,
          frequency: 0,
          monetary: 0,
          recencyScore: 1,
          frequencyScore: 1,
          monetaryScore: 1,
          rfmScore: 111,
          lastPurchaseDate: null,
          totalOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0
        };
      }

      // Calculate Recency (days since last purchase)
      const lastPurchaseDate = new Date(sales[0].createdAt);
      const daysSinceLastPurchase = Math.floor(
        (analysisDate - lastPurchaseDate) / (1000 * 60 * 60 * 24)
      );

      // Calculate Frequency (number of orders in last 12 months)
      const oneYearAgo = new Date(analysisDate);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const recentSales = sales.filter(s => new Date(s.createdAt) >= oneYearAgo);
      const frequency = recentSales.length;

      // Calculate Monetary (total revenue in last 12 months)
      const monetary = recentSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
      const averageOrderValue = frequency > 0 ? monetary / frequency : 0;

      // Calculate RFM Scores (1-5 scale)
      const recencyScore = this.calculateRecencyScore(daysSinceLastPurchase);
      const frequencyScore = this.calculateFrequencyScore(frequency);
      const monetaryScore = this.calculateMonetaryScore(monetary);

      // Combined RFM Score (e.g., 555 = best customer, 111 = worst)
      const rfmScore = parseInt(`${recencyScore}${frequencyScore}${monetaryScore}`);

      return {
        recency: daysSinceLastPurchase,
        frequency,
        monetary,
        recencyScore,
        frequencyScore,
        monetaryScore,
        rfmScore,
        lastPurchaseDate,
        totalOrders: sales.length,
        totalRevenue: sales.reduce((sum, sale) => sum + (sale.total || 0), 0),
        averageOrderValue,
        recentOrdersCount: frequency
      };
    } catch (error) {
      console.error('Error calculating RFM:', error);
      throw error;
    }
  }

  /**
   * Calculate Recency Score (1-5)
   * Lower days = higher score
   */
  static calculateRecencyScore(days) {
    if (days <= 30) return 5;      // Very recent (0-30 days)
    if (days <= 60) return 4;       // Recent (31-60 days)
    if (days <= 90) return 3;       // Moderate (61-90 days)
    if (days <= 180) return 2;      // Low (91-180 days)
    return 1;                       // Very low (181+ days)
  }

  /**
   * Calculate Frequency Score (1-5)
   * More orders = higher score
   */
  static calculateFrequencyScore(frequency) {
    if (frequency >= 20) return 5;   // Very frequent (20+ orders)
    if (frequency >= 10) return 4;    // Frequent (10-19 orders)
    if (frequency >= 5) return 3;    // Moderate (5-9 orders)
    if (frequency >= 2) return 2;    // Low (2-4 orders)
    return 1;                         // Very low (0-1 orders)
  }

  /**
   * Calculate Monetary Score (1-5)
   * Higher revenue = higher score
   */
  static calculateMonetaryScore(monetary) {
    // Adjust thresholds based on your business
    if (monetary >= 100000) return 5;    // Very high (100k+)
    if (monetary >= 50000) return 4;      // High (50k-100k)
    if (monetary >= 20000) return 3;      // Moderate (20k-50k)
    if (monetary >= 5000) return 2;       // Low (5k-20k)
    return 1;                             // Very low (<5k)
  }

  /**
   * Segment customer based on RFM scores
   * @param {Object} rfmData - RFM calculation results
   * @returns {Object} Customer segment information
   */
  static segmentCustomer(rfmData) {
    const { recencyScore, frequencyScore, monetaryScore, rfmScore } = rfmData;

    // VIP Customers (High RFM scores)
    if (recencyScore >= 4 && frequencyScore >= 4 && monetaryScore >= 4) {
      return {
        segment: 'VIP',
        segmentName: 'VIP Customer',
        priority: 'high',
        color: 'purple',
        description: 'High-value, frequent, recent customers',
        recommendations: [
          'Offer exclusive products',
          'Provide priority support',
          'Send personalized offers',
          'Invite to loyalty program'
        ]
      };
    }

    // Champions (High frequency and monetary, recent)
    if (frequencyScore >= 4 && monetaryScore >= 4 && recencyScore >= 3) {
      return {
        segment: 'champion',
        segmentName: 'Champion',
        priority: 'high',
        color: 'green',
        description: 'Best customers - frequent and high value',
        recommendations: [
          'Upsell complementary products',
          'Request testimonials',
          'Referral program',
          'Premium support'
        ]
      };
    }

    // Loyal Customers (High frequency, moderate recency)
    if (frequencyScore >= 4 && recencyScore >= 3) {
      return {
        segment: 'loyal',
        segmentName: 'Loyal Customer',
        priority: 'medium-high',
        color: 'blue',
        description: 'Regular customers with good purchase history',
        recommendations: [
          'Reward loyalty',
          'Cross-sell products',
          'Engage regularly',
          'Special discounts'
        ]
      };
    }

    // At-Risk Customers (Low recency, but had good history)
    if (recencyScore <= 2 && (frequencyScore >= 3 || monetaryScore >= 3)) {
      return {
        segment: 'at_risk',
        segmentName: 'At-Risk Customer',
        priority: 'high',
        color: 'orange',
        description: 'Previously active but haven\'t purchased recently',
        recommendations: [
          'Re-engagement campaign',
          'Special comeback offer',
          'Survey to understand why',
          'Personal outreach'
        ],
        churnRisk: 'high'
      };
    }

    // Churned Customers (Very low recency, low activity)
    if (recencyScore <= 1 && frequencyScore <= 2 && monetaryScore <= 2) {
      return {
        segment: 'churned',
        segmentName: 'Churned Customer',
        priority: 'medium',
        color: 'red',
        description: 'Inactive for a long time',
        recommendations: [
          'Win-back campaign',
          'Deep discount offers',
          'Survey for feedback',
          'New product announcements'
        ],
        churnRisk: 'very_high'
      };
    }

    // New Customers (Low frequency but recent)
    if (recencyScore >= 4 && frequencyScore <= 2) {
      return {
        segment: 'new',
        segmentName: 'New Customer',
        priority: 'medium',
        color: 'yellow',
        description: 'Recent first-time customers',
        recommendations: [
          'Welcome series',
          'Onboarding support',
          'First purchase discount',
          'Educational content'
        ]
      };
    }

    // Regular Customers (Moderate scores)
    return {
      segment: 'regular',
      segmentName: 'Regular Customer',
      priority: 'medium',
      color: 'gray',
      description: 'Average customers with moderate activity',
      recommendations: [
        'Regular engagement',
        'Product recommendations',
        'Seasonal promotions',
        'Newsletter updates'
        ]
    };
  }

  /**
   * Predict Customer Lifetime Value (CLV)
   * @param {Object} customer - Customer object
   * @param {Object} rfmData - RFM calculation results
   * @returns {Promise<Object>} CLV prediction
   */
  static async predictCLV(customer, rfmData) {
    try {
      const { averageOrderValue, frequency, recency, monetary } = rfmData;
      
      // Get customer age (days since first purchase)
      const customerId = customer && customer._id ? customer._id : customer;
      const sales = await SalesRepository.findAll({ customer: customerId }, {
        sort: { createdAt: 1 },
        limit: 1,
        lean: true
      });
      const firstSale = sales.length > 0 ? sales[0] : null;
      
      if (!firstSale) {
        return {
          predictedCLV: 0,
          confidence: 'low',
          method: 'no_history',
          factors: {}
        };
      }

      const customerAge = Math.floor(
        (new Date() - new Date(firstSale.createdAt)) / (1000 * 60 * 60 * 24)
      );

      // Calculate average purchase frequency (purchases per month)
      const monthsActive = Math.max(customerAge / 30, 1);
      const avgMonthlyFrequency = frequency / monthsActive;

      // Predict future purchases based on historical pattern
      // Assuming customer will continue for next 12 months
      const predictedMonths = 12;
      const predictedFuturePurchases = avgMonthlyFrequency * predictedMonths;

      // Adjust for recency (recent customers more likely to continue)
      const recencyFactor = this.calculateRecencyFactor(recency);
      const adjustedFuturePurchases = predictedFuturePurchases * recencyFactor;

      // Calculate predicted CLV
      const predictedCLV = adjustedFuturePurchases * averageOrderValue;

      // Calculate confidence based on data quality
      const confidence = this.calculateCLVConfidence(customerAge, frequency, recency);

      return {
        predictedCLV: Math.round(predictedCLV),
        confidence,
        method: 'rfm_based',
        factors: {
          averageOrderValue,
          predictedFuturePurchases: Math.round(adjustedFuturePurchases * 10) / 10,
          recencyFactor: Math.round(recencyFactor * 100) / 100,
          customerAgeMonths: Math.round(monthsActive * 10) / 10
        },
        timeHorizon: '12_months'
      };
    } catch (error) {
      console.error('Error predicting CLV:', error);
      throw error;
    }
  }

  /**
   * Calculate recency factor for CLV prediction
   * Recent customers more likely to continue purchasing
   */
  static calculateRecencyFactor(recency) {
    if (recency <= 30) return 1.0;      // Very recent - full confidence
    if (recency <= 60) return 0.9;      // Recent - high confidence
    if (recency <= 90) return 0.7;      // Moderate - medium confidence
    if (recency <= 180) return 0.5;     // Low - reduced confidence
    return 0.3;                          // Very low - minimal confidence
  }

  /**
   * Calculate CLV prediction confidence
   */
  static calculateCLVConfidence(customerAge, frequency, recency) {
    let confidence = 'medium';

    // More data = higher confidence
    if (frequency >= 10 && customerAge >= 180) {
      confidence = 'high';
    } else if (frequency >= 5 && customerAge >= 90) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    // Recent activity increases confidence
    if (recency <= 30 && confidence === 'medium') {
      confidence = 'high';
    } else if (recency > 180 && confidence === 'high') {
      confidence = 'medium';
    }

    return confidence;
  }

  /**
   * Calculate churn risk score
   * @param {Object} rfmData - RFM calculation results
   * @param {Object} segment - Customer segment
   * @returns {Object} Churn risk assessment
   */
  static calculateChurnRisk(rfmData, segment) {
    const { recency, frequency, recencyScore, frequencyScore } = rfmData;
    
    let riskScore = 0; // 0-100, higher = more risk
    let riskLevel = 'low';
    let riskFactors = [];

    // Recency factor (most important)
    if (recency > 180) {
      riskScore += 50;
      riskFactors.push('No purchase in last 6 months');
    } else if (recency > 90) {
      riskScore += 30;
      riskFactors.push('No purchase in last 3 months');
    } else if (recency > 60) {
      riskScore += 15;
      riskFactors.push('No purchase in last 2 months');
    }

    // Frequency factor
    if (frequency === 0) {
      riskScore += 30;
      riskFactors.push('No purchases in last year');
    } else if (frequency === 1) {
      riskScore += 20;
      riskFactors.push('Only one purchase in last year');
    } else if (frequency <= 2) {
      riskScore += 10;
      riskFactors.push('Very few purchases');
    }

    // Segment-based risk
    if (segment.segment === 'at_risk' || segment.segment === 'churned') {
      riskScore += 20;
      riskFactors.push('Customer segment indicates risk');
    }

    // Determine risk level
    if (riskScore >= 70) {
      riskLevel = 'very_high';
    } else if (riskScore >= 50) {
      riskLevel = 'high';
    } else if (riskScore >= 30) {
      riskLevel = 'medium';
    } else if (riskScore >= 15) {
      riskLevel = 'low';
    } else {
      riskLevel = 'very_low';
    }

    // Calculate days until likely churn
    const daysUntilChurn = this.predictDaysUntilChurn(recency, frequency);

    return {
      riskScore: Math.min(riskScore, 100),
      riskLevel,
      riskFactors,
      daysUntilChurn,
      recommendedActions: this.getChurnPreventionActions(riskLevel, segment)
    };
  }

  /**
   * Predict days until likely churn
   */
  static predictDaysUntilChurn(recency, frequency) {
    // Based on historical pattern: if customer hasn't purchased in X days,
    // and their average purchase interval was Y days, predict churn
    if (frequency === 0) return 0; // Already churned
    
    // Estimate average purchase interval
    const estimatedInterval = recency / Math.max(frequency, 1);
    
    // If current recency exceeds 2x the estimated interval, high churn risk
    if (recency > estimatedInterval * 2) {
      return 0; // Likely already churned
    }
    
    // Predict churn when recency exceeds 1.5x interval
    return Math.max(0, Math.round(estimatedInterval * 1.5 - recency));
  }

  /**
   * Get recommended actions to prevent churn
   */
  static getChurnPreventionActions(riskLevel, segment) {
    const actions = [];

    if (riskLevel === 'very_high' || riskLevel === 'high') {
      actions.push('Immediate re-engagement campaign');
      actions.push('Personal outreach from sales team');
      actions.push('Special discount or offer');
      actions.push('Survey to understand concerns');
    } else if (riskLevel === 'medium') {
      actions.push('Send targeted promotions');
      actions.push('Engage via email/newsletter');
      actions.push('Highlight new products');
    } else {
      actions.push('Maintain regular communication');
      actions.push('Continue providing value');
    }

    return actions;
  }

  /**
   * Analyze all customers and generate segmentation report
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Complete analytics report
   */
  static async analyzeAllCustomers(options = {}) {
    try {
      const {
        includeInactive = false,
        minOrders = 0,
        dateRange = null
      } = options;

      // Build customer query
      const customerQuery = {};
      if (!includeInactive) {
        customerQuery.status = 'active';
      }

      const customers = await CustomerRepository.findAll(customerQuery, { lean: true });

      const analytics = {
        totalCustomers: customers.length,
        segments: {
          VIP: [],
          champion: [],
          loyal: [],
          regular: [],
          new: [],
          at_risk: [],
          churned: []
        },
        summary: {
          totalCLV: 0,
          averageCLV: 0,
          highRiskCount: 0,
          churnedCount: 0
        },
        customers: []
      };

      // Analyze each customer
      for (const customer of customers) {
        try {
          const rfmData = await this.calculateRFM(customer);
          const segment = this.segmentCustomer(rfmData);
          const clv = await this.predictCLV(customer, rfmData);
          const churnRisk = this.calculateChurnRisk(rfmData, segment);

          // Filter by minimum orders if specified
          if (rfmData.totalOrders < minOrders) {
            continue;
          }

          const customerAnalytics = {
            customer: {
              _id: customer._id,
              name: customer.name,
              businessName: customer.businessName,
              email: customer.email,
              phone: customer.phone,
              status: customer.status
            },
            rfm: rfmData,
            segment,
            clv,
            churnRisk
          };

          analytics.customers.push(customerAnalytics);
          analytics.segments[segment.segment].push(customerAnalytics);

          // Update summary
          analytics.summary.totalCLV += clv.predictedCLV;
          if (churnRisk.riskLevel === 'high' || churnRisk.riskLevel === 'very_high') {
            analytics.summary.highRiskCount++;
          }
          if (segment.segment === 'churned') {
            analytics.summary.churnedCount++;
          }
        } catch (error) {
          console.error(`Error analyzing customer ${customer._id}:`, error);
          // Continue with next customer
        }
      }

      // Calculate averages
      if (analytics.customers.length > 0) {
        analytics.summary.averageCLV = Math.round(
          analytics.summary.totalCLV / analytics.customers.length
        );
      }

      // Sort customers by CLV (highest first)
      analytics.customers.sort((a, b) => b.clv.predictedCLV - a.clv.predictedCLV);

      return analytics;
    } catch (error) {
      console.error('Error analyzing all customers:', error);
      throw error;
    }
  }

  /**
   * Get customer analytics for a single customer
   * @param {String} customerId - Customer ID
   * @returns {Promise<Object>} Customer analytics
   */
  static async getCustomerAnalytics(customerId) {
    try {
      const customer = await CustomerRepository.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const rfmData = await this.calculateRFM(customer);
      const segment = this.segmentCustomer(rfmData);
      const clv = await this.predictCLV(customer, rfmData);
      const churnRisk = this.calculateChurnRisk(rfmData, segment);

      return {
        customer: {
          _id: customer._id,
          name: customer.name,
          businessName: customer.businessName,
          email: customer.email,
          phone: customer.phone,
          status: customer.status
        },
        rfm: rfmData,
        segment,
        clv,
        churnRisk
      };
    } catch (error) {
      console.error('Error getting customer analytics:', error);
      throw error;
    }
  }
}

module.exports = CustomerAnalyticsService;

