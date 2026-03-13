/**
 * Fuzzy Search Utility
 * Provides smart search with fuzzy matching, typo tolerance, and relevance scoring
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Distance (lower is more similar)
 */
export const levenshteinDistance = (str1, str2) => {
  const s1 = (str1 || '').toLowerCase();
  const s2 = (str2 || '').toLowerCase();
  
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const matrix = [];
  
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[s2.length][s1.length];
};

/**
 * Calculate similarity score between two strings (0-1, higher is more similar)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (0-1)
 */
export const similarityScore = (str1, str2) => {
  if (!str1 || !str2) return 0;
  if (str1.toLowerCase() === str2.toLowerCase()) return 1;
  
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLength);
};

/**
 * Check if search term matches (exact, contains, or fuzzy)
 * @param {string} text - Text to search in
 * @param {string} searchTerm - Search term
 * @param {Object} options - Search options
 * @returns {Object} - Match result with score and matched
 */
export const fuzzyMatch = (text, searchTerm, options = {}) => {
  const {
    threshold = 0.6,        // Minimum similarity score (0-1)
    caseSensitive = false,
    wholeWords = false,
    maxDistance = 3         // Maximum Levenshtein distance
  } = options;

  if (!text || !searchTerm) {
    return { matched: false, score: 0, type: 'none' };
  }

  const searchText = caseSensitive ? text : text.toLowerCase();
  const search = caseSensitive ? searchTerm : searchTerm.toLowerCase();

  // Exact match
  if (searchText === search) {
    return { matched: true, score: 1.0, type: 'exact' };
  }

  // Contains match (substring)
  if (searchText.includes(search)) {
    const score = search.length / searchText.length;
    return { matched: true, score: 0.8 + (score * 0.2), type: 'contains' };
  }

  // Word boundary match
  if (wholeWords) {
    const words = searchText.split(/\s+/);
    for (const word of words) {
      if (word === search || word.startsWith(search)) {
        return { matched: true, score: 0.9, type: 'word' };
      }
    }
  }

  // Fuzzy match using Levenshtein distance
  const distance = levenshteinDistance(text, searchTerm);
  const maxLength = Math.max(text.length, searchTerm.length);
  const similarity = maxLength > 0 ? 1 - (distance / maxLength) : 0;

  if (distance <= maxDistance && similarity >= threshold) {
    return { matched: true, score: similarity, type: 'fuzzy' };
  }

  // Partial word matching (each word in search term)
  const searchWords = search.split(/\s+/).filter(w => w.length > 2);
  if (searchWords.length > 0) {
    let matchedWords = 0;
    let totalScore = 0;
    
    for (const word of searchWords) {
      if (searchText.includes(word)) {
        matchedWords++;
        totalScore += 0.7;
      } else {
        // Try fuzzy match on individual words
        const words = searchText.split(/\s+/);
        for (const textWord of words) {
          const wordDistance = levenshteinDistance(textWord, word);
          if (wordDistance <= 2 && textWord.length >= word.length - 2) {
            matchedWords++;
            totalScore += 0.5;
            break;
          }
        }
      }
    }
    
    if (matchedWords > 0) {
      const score = totalScore / searchWords.length;
      return { matched: true, score, type: 'partial' };
    }
  }

  return { matched: false, score: 0, type: 'none' };
};

/**
 * Search through an array of items with fuzzy matching
 * @param {Array} items - Array of items to search
 * @param {string} searchTerm - Search term
 * @param {Function|string|Array} searchFields - Field(s) to search in
 * @param {Object} options - Search options
 * @returns {Array} - Sorted array of matching items with scores
 */
export const fuzzySearch = (items, searchTerm, searchFields, options = {}) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return [];
  }

  if (!searchTerm || searchTerm.trim().length === 0) {
    return items;
  }

  const {
    threshold = 0.4,
    limit = null,
    minScore = 0.3,
    caseSensitive = false
  } = options;

  const search = searchTerm.trim();
  const results = [];

  // Normalize searchFields to array of functions or field paths
  let fieldAccessors = [];
  if (typeof searchFields === 'string') {
    fieldAccessors = [(item) => getNestedValue(item, searchFields)];
  } else if (Array.isArray(searchFields)) {
    fieldAccessors = searchFields.map(field => 
      typeof field === 'function' ? field : (item) => getNestedValue(item, field)
    );
  } else if (typeof searchFields === 'function') {
    fieldAccessors = [searchFields];
  } else {
    // Default: search in common fields
    fieldAccessors = [
      (item) => item.name || item.title || item.companyName || item.businessName || '',
      (item) => item.description || '',
      (item) => item.email || '',
      (item) => item.phone || '',
      (item) => item.code || item.sku || item.poNumber || item.orderNumber || ''
    ];
  }

  for (const item of items) {
    let bestScore = 0;
    let bestMatch = null;

    // Search in all specified fields
    for (const getField of fieldAccessors) {
      try {
        const fieldValue = getField(item);
        if (fieldValue == null) continue;

        const text = Array.isArray(fieldValue) 
          ? fieldValue.join(' ') 
          : String(fieldValue);

        const match = fuzzyMatch(text, search, { threshold, caseSensitive });
        
        if (match.matched && match.score > bestScore) {
          bestScore = match.score;
          bestMatch = match;
        }
      } catch (error) {
        // Error accessing field in fuzzy search - silent fail
      }
    }

    if (bestMatch && bestScore >= minScore) {
      results.push({
        item,
        score: bestScore,
        matchType: bestMatch.type
      });
    }
  }

  // Sort by score (highest first), then by match type priority
  const typePriority = { exact: 4, contains: 3, word: 2, fuzzy: 1, partial: 0 };
  results.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 0.01) {
      return b.score - a.score;
    }
    return typePriority[b.matchType] - typePriority[a.matchType];
  });

  // Extract items and apply limit
  const matchedItems = results.map(r => r.item);
  return limit ? matchedItems.slice(0, limit) : matchedItems;
};

/**
 * Get nested value from object using dot notation
 * @param {Object} obj - Object to get value from
 * @param {string} path - Dot notation path (e.g., 'user.name')
 * @returns {any} - Value or empty string
 */
const getNestedValue = (obj, path) => {
  if (!obj || !path) return '';
  
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value == null) return '';
    value = value[key];
  }
  
  return value != null ? String(value) : '';
};

/**
 * Highlight matched text in search results
 * @param {string} text - Original text
 * @param {string} searchTerm - Search term
 * @param {string} className - CSS class for highlighting
 * @returns {JSX.Element|string} - Text with highlighted matches
 */
export const highlightMatch = (text, searchTerm, className = 'bg-yellow-200') => {
  if (!text || !searchTerm) return text;

  const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.toLowerCase() === searchTerm.toLowerCase()) {
      return <mark key={index} className={className}>{part}</mark>;
    }
    return part;
  });
};

/**
 * Escape special regex characters
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Quick search helper for common use cases
 * @param {Array} items - Items to search
 * @param {string} searchTerm - Search term
 * @param {Array} fields - Fields to search (default: ['name', 'description'])
 * @returns {Array} - Filtered and sorted results
 */
export const quickSearch = (items, searchTerm, fields = ['name', 'description']) => {
  return fuzzySearch(items, searchTerm, fields, {
    threshold: 0.5,
    minScore: 0.4,
    limit: 50
  });
};

