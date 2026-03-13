/**
 * Enhanced Expense Categorization Service
 * 
 * This service provides intelligent expense categorization using multiple factors:
 * - Account code mapping (from expenseAccountMapping config)
 * - Account name patterns
 * - Transaction tags/metadata
 * - Description analysis
 * - Learning from previous categorizations
 * - Multi-factor scoring system
 */

const expenseAccountMapping = require('../config/expenseAccountMapping');

class ExpenseCategorizationService {
  constructor() {
    // Category confidence scores (0-1)
    this.confidenceThreshold = 0.6;
    
    // Keyword weights for description analysis
    this.keywordWeights = {
      // Selling expense keywords
      selling: {
        'advertising': { weight: 0.9, category: 'advertising' },
        'advert': { weight: 0.8, category: 'advertising' },
        'marketing': { weight: 0.9, category: 'marketing' },
        'campaign': { weight: 0.8, category: 'marketing' },
        'commission': { weight: 0.9, category: 'sales_commissions' },
        'sales': { weight: 0.7, category: 'marketing' },
        'promo': { weight: 0.8, category: 'promotional' },
        'promotional': { weight: 0.9, category: 'promotional' },
        'travel': { weight: 0.8, category: 'travel_entertainment' },
        'entertainment': { weight: 0.8, category: 'travel_entertainment' },
        'customer service': { weight: 0.9, category: 'customer_service' },
        'delivery': { weight: 0.8, category: 'delivery' },
        'shipping': { weight: 0.8, category: 'delivery' },
        'warehouse': { weight: 0.8, category: 'warehouse' },
      },
      // Administrative expense keywords
      administrative: {
        'office': { weight: 0.7, category: 'office_supplies' },
        'supplies': { weight: 0.8, category: 'office_supplies' },
        'rent': { weight: 0.9, category: 'rent' },
        'lease': { weight: 0.8, category: 'rent' },
        'utilities': { weight: 0.9, category: 'utilities' },
        'electric': { weight: 0.8, category: 'utilities' },
        'water': { weight: 0.8, category: 'utilities' },
        'gas': { weight: 0.8, category: 'utilities' },
        'insurance': { weight: 0.9, category: 'insurance' },
        'legal': { weight: 0.9, category: 'legal' },
        'lawyer': { weight: 0.8, category: 'legal' },
        'accounting': { weight: 0.9, category: 'accounting' },
        'audit': { weight: 0.8, category: 'accounting' },
        'management': { weight: 0.7, category: 'management_salaries' },
        'training': { weight: 0.9, category: 'training' },
        'software': { weight: 0.9, category: 'software' },
        'saas': { weight: 0.8, category: 'software' },
        'subscription': { weight: 0.8, category: 'software' },
        'equipment': { weight: 0.9, category: 'equipment' },
        'maintenance': { weight: 0.9, category: 'maintenance' },
        'repair': { weight: 0.8, category: 'maintenance' },
        'professional': { weight: 0.8, category: 'professional_services' },
        'consulting': { weight: 0.9, category: 'professional_services' },
        'depreciation': { weight: 0.9, category: 'depreciation' },
        'telecom': { weight: 0.8, category: 'telecommunications' },
        'phone': { weight: 0.7, category: 'telecommunications' },
        'internet': { weight: 0.8, category: 'telecommunications' },
        'bank charge': { weight: 0.9, category: 'bank_charges' },
        'banking fee': { weight: 0.9, category: 'bank_charges' },
      }
    };
    
    // Tag-based categorization rules
    this.tagMappings = {
      'advertising': { expenseType: 'selling', category: 'advertising' },
      'marketing': { expenseType: 'selling', category: 'marketing' },
      'sales': { expenseType: 'selling', category: 'marketing' },
      'promo': { expenseType: 'selling', category: 'promotional' },
      'travel': { expenseType: 'selling', category: 'travel_entertainment' },
      'office': { expenseType: 'administrative', category: 'office_supplies' },
      'rent': { expenseType: 'administrative', category: 'rent' },
      'utilities': { expenseType: 'administrative', category: 'utilities' },
      'insurance': { expenseType: 'administrative', category: 'insurance' },
      'legal': { expenseType: 'administrative', category: 'legal' },
      'accounting': { expenseType: 'administrative', category: 'accounting' },
      'training': { expenseType: 'administrative', category: 'training' },
      'software': { expenseType: 'administrative', category: 'software' },
      'equipment': { expenseType: 'administrative', category: 'equipment' },
      'maintenance': { expenseType: 'administrative', category: 'maintenance' },
    };
  }

  /**
   * Categorize expense using multiple factors
   * @param {Object} expenseData - Expense transaction data
   * @param {string} expenseData.accountCode - Account code
   * @param {string} expenseData.accountName - Account name
   * @param {string} expenseData.description - Transaction description
   * @param {Array} expenseData.tags - Transaction tags (from metadata)
   * @param {Object} expenseData.metadata - Transaction metadata
   * @returns {Object} - { expenseType, category, confidence, factors }
   */
  categorizeExpense(expenseData) {
    const {
      accountCode,
      accountName,
      description = '',
      tags = [],
      metadata = {}
    } = expenseData;

    const factors = {
      accountCode: null,
      accountName: null,
      tags: null,
      description: null,
      metadata: null
    };

    const scores = {
      selling: {},
      administrative: {}
    };

    // Factor 1: Account code mapping (highest priority)
    const accountMapping = expenseAccountMapping.getAccountMapping(accountCode);
    if (accountMapping) {
      const category = accountMapping.category;
      const expenseType = accountMapping.expenseType;
      factors.accountCode = { expenseType, category, confidence: 0.95 };
      scores[expenseType][category] = (scores[expenseType][category] || 0) + 0.95;
    }

    // Factor 2: Account name pattern matching
    const nameBased = expenseAccountMapping.getExpenseTypeFromName(accountName, accountCode);
    if (nameBased.expenseType && nameBased.category) {
      factors.accountName = { ...nameBased, confidence: 0.8 };
      scores[nameBased.expenseType][nameBased.category] = 
        (scores[nameBased.expenseType][nameBased.category] || 0) + 0.8;
    }

    // Factor 3: Tag-based categorization
    if (tags && tags.length > 0) {
      const tagResults = this.categorizeByTags(tags);
      if (tagResults) {
        factors.tags = { ...tagResults, confidence: 0.85 };
        scores[tagResults.expenseType][tagResults.category] = 
          (scores[tagResults.expenseType][tagResults.category] || 0) + 0.85;
      }
    }

    // Factor 4: Description keyword analysis
    if (description) {
      const descResults = this.analyzeDescription(description);
      if (descResults) {
        factors.description = descResults;
        descResults.matches.forEach(match => {
          scores[match.expenseType][match.category] = 
            (scores[match.expenseType][match.category] || 0) + match.weight;
        });
      }
    }

    // Factor 5: Metadata analysis (if available)
    if (metadata && Object.keys(metadata).length > 0) {
      const metaResults = this.analyzeMetadata(metadata);
      if (metaResults) {
        factors.metadata = metaResults;
        if (metaResults.expenseType && metaResults.category) {
          scores[metaResults.expenseType][metaResults.category] = 
            (scores[metaResults.expenseType][metaResults.category] || 0) + 0.7;
        }
      }
    }

    // Determine final category based on scores
    const result = this.determineCategory(scores, factors);

    return {
      expenseType: result.expenseType,
      category: result.category,
      confidence: result.confidence,
      factors: factors,
      scores: scores
    };
  }

  /**
   * Categorize by transaction tags
   * @param {Array} tags - Transaction tags
   * @returns {Object|null} - { expenseType, category }
   */
  categorizeByTags(tags) {
    if (!tags || tags.length === 0) return null;

    for (const tag of tags) {
      const normalizedTag = tag.toLowerCase().trim();
      if (this.tagMappings[normalizedTag]) {
        return this.tagMappings[normalizedTag];
      }
    }

    return null;
  }

  /**
   * Analyze description for keywords
   * @param {string} description - Transaction description
   * @returns {Object|null} - { matches: [{ expenseType, category, weight }], confidence }
   */
  analyzeDescription(description) {
    if (!description) return null;

    const desc = description.toLowerCase();
    const matches = [];
    let totalWeight = 0;

    // Check selling expense keywords
    for (const [keyword, data] of Object.entries(this.keywordWeights.selling)) {
      if (desc.includes(keyword)) {
        matches.push({
          expenseType: 'selling',
          category: data.category,
          weight: data.weight
        });
        totalWeight += data.weight;
      }
    }

    // Check administrative expense keywords
    for (const [keyword, data] of Object.entries(this.keywordWeights.administrative)) {
      if (desc.includes(keyword)) {
        matches.push({
          expenseType: 'administrative',
          category: data.category,
          weight: data.weight
        });
        totalWeight += data.weight;
      }
    }

    if (matches.length === 0) return null;

    // Calculate confidence based on total weight and number of matches
    const confidence = Math.min(0.9, totalWeight / matches.length);

    return {
      matches,
      confidence,
      totalWeight
    };
  }

  /**
   * Analyze metadata for categorization hints
   * @param {Object} metadata - Transaction metadata
   * @returns {Object|null} - { expenseType, category, confidence }
   */
  analyzeMetadata(metadata) {
    if (!metadata) return null;

    // Check metadata notes for keywords
    if (metadata.notes) {
      const notesResult = this.analyzeDescription(metadata.notes);
      if (notesResult && notesResult.matches.length > 0) {
        // Use the highest weighted match
        const topMatch = notesResult.matches.reduce((prev, current) => 
          (prev.weight > current.weight) ? prev : current
        );
        return {
          expenseType: topMatch.expenseType,
          category: topMatch.category,
          confidence: 0.7
        };
      }
    }

    // Check reference field
    if (metadata.reference) {
      const refResult = this.analyzeDescription(metadata.reference);
      if (refResult && refResult.matches.length > 0) {
        const topMatch = refResult.matches.reduce((prev, current) => 
          (prev.weight > current.weight) ? prev : current
        );
        return {
          expenseType: topMatch.expenseType,
          category: topMatch.category,
          confidence: 0.6
        };
      }
    }

    return null;
  }

  /**
   * Determine final category from scores
   * @param {Object} scores - Category scores
   * @param {Object} factors - Categorization factors
   * @returns {Object} - { expenseType, category, confidence }
   */
  determineCategory(scores, factors) {
    // If account code mapping exists, use it (highest confidence)
    if (factors.accountCode) {
      return {
        expenseType: factors.accountCode.expenseType,
        category: factors.accountCode.category,
        confidence: factors.accountCode.confidence
      };
    }

    // Find highest scoring category
    let maxScore = 0;
    let bestCategory = null;
    let bestExpenseType = null;

    for (const [expenseType, categories] of Object.entries(scores)) {
      for (const [category, score] of Object.entries(categories)) {
        if (score > maxScore) {
          maxScore = score;
          bestCategory = category;
          bestExpenseType = expenseType;
        }
      }
    }

    // If we have a high confidence match, use it
    if (maxScore >= this.confidenceThreshold && bestCategory) {
      return {
        expenseType: bestExpenseType,
        category: bestCategory,
        confidence: Math.min(0.95, maxScore)
      };
    }

    // Fallback to account name or default
    if (factors.accountName) {
      return {
        expenseType: factors.accountName.expenseType,
        category: factors.accountName.category,
        confidence: factors.accountName.confidence
      };
    }

    // Default fallback
    return {
      expenseType: 'administrative',
      category: 'other',
      confidence: 0.5
    };
  }

  /**
   * Learn from manual categorization (for future ML enhancement)
   * @param {Object} expenseData - Original expense data
   * @param {Object} correctCategory - Correct categorization
   */
  learnFromCategorization(expenseData, correctCategory) {
    // This is a placeholder for future ML-based learning
    // Could store patterns in database for future use
    // For now, we'll just log it for analysis
    console.log('Learning from categorization:', {
      accountCode: expenseData.accountCode,
      accountName: expenseData.accountName,
      description: expenseData.description,
      tags: expenseData.tags,
      correctCategory
    });
  }

  /**
   * Get categorization suggestions based on similar expenses
   * @param {Object} expenseData - Expense transaction data
   * @returns {Array} - Array of suggested categories with confidence scores
   */
  getSuggestions(expenseData) {
    const result = this.categorizeExpense(expenseData);
    const suggestions = [];

    // Add primary suggestion
    suggestions.push({
      expenseType: result.expenseType,
      category: result.category,
      confidence: result.confidence,
      reason: this.getReason(result.factors)
    });

    // Add alternative suggestions if confidence is low
    if (result.confidence < this.confidenceThreshold) {
      // Could add logic to suggest alternatives based on similar patterns
      // For now, we'll suggest the account name-based category if different
      if (result.factors.accountName && 
          result.factors.accountName.category !== result.category) {
        suggestions.push({
          expenseType: result.factors.accountName.expenseType,
          category: result.factors.accountName.category,
          confidence: result.factors.accountName.confidence,
          reason: 'Based on account name pattern'
        });
      }
    }

    return suggestions;
  }

  /**
   * Get human-readable reason for categorization
   * @param {Object} factors - Categorization factors
   * @returns {string} - Reason string
   */
  getReason(factors) {
    if (factors.accountCode) {
      return 'Based on account code mapping';
    }
    if (factors.tags) {
      return 'Based on transaction tags';
    }
    if (factors.description && factors.description.matches.length > 0) {
      return 'Based on description keywords';
    }
    if (factors.accountName) {
      return 'Based on account name pattern';
    }
    return 'Default categorization';
  }
}

module.exports = new ExpenseCategorizationService();

