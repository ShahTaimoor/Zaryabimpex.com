const { splitSearchTokens } = require('./searchTokens');
const {
  expandTokenVariants,
  compactSearchPhrase,
  SQL_PRODUCT_NAME_COMPACT,
  SQL_VARIANT_DISPLAY_COMPACT,
} = require('./searchNormalize');

const NUMERIC_TOKEN_RE = /^[0-9]+$/;

function isNumericToken(token) {
  return NUMERIC_TOKEN_RE.test(String(token ?? '').trim());
}

/**
 * ORDER BY fragment: numeric codes as numbers (01,02,05,09,10), then text.
 */
function sqlNaturalCodeOrder(skuCol = 'sku', barcodeCol = 'barcode', nameCol = 'name') {
  const code = `COALESCE(NULLIF(TRIM(${skuCol}), ''), NULLIF(TRIM(${barcodeCol}), ''))`;
  return `CASE WHEN ${code} ~ '^[0-9]+$' THEN (${code})::numeric END ASC NULLS LAST,
    LENGTH(${code}) ASC NULLS LAST,
    LOWER(${code}) ASC NULLS LAST,
    LOWER(TRIM(COALESCE(${nameCol}, ''))) ASC`;
}

function sqlProductSearchRank(rank) {
  const { exactIdx, prefixIdx, containsIdx } = rank;
  return `CASE
    WHEN LOWER(TRIM(COALESCE(sku, ''))) = LOWER($${exactIdx}) THEN 0
    WHEN LOWER(TRIM(COALESCE(barcode, ''))) = LOWER($${exactIdx}) THEN 1
    WHEN sku ILIKE $${prefixIdx} THEN 2
    WHEN barcode ILIKE $${prefixIdx} THEN 3
    WHEN name ILIKE $${prefixIdx} THEN 4
    WHEN sku ILIKE $${containsIdx} OR barcode ILIKE $${containsIdx} THEN 5
    WHEN name ILIKE $${containsIdx}
      OR hs_code ILIKE $${containsIdx}
      OR import_ref_no ILIKE $${containsIdx}
      OR gd_number ILIKE $${containsIdx}
      OR invoice_ref ILIKE $${containsIdx} THEN 6
    ELSE 7
  END ASC`;
}

function sqlVariantSearchRank(rank) {
  const { exactIdx, prefixIdx, containsIdx } = rank;
  return `CASE
    WHEN LOWER(TRIM(COALESCE(sku, ''))) = LOWER($${exactIdx}) THEN 0
    WHEN LOWER(TRIM(COALESCE(barcode, ''))) = LOWER($${exactIdx}) THEN 1
    WHEN LOWER(TRIM(COALESCE(variant_value, ''))) = LOWER($${exactIdx}) THEN 2
    WHEN sku ILIKE $${prefixIdx} THEN 3
    WHEN barcode ILIKE $${prefixIdx} THEN 4
    WHEN variant_value ILIKE $${prefixIdx} THEN 5
    WHEN display_name ILIKE $${prefixIdx} OR variant_name ILIKE $${prefixIdx} THEN 6
    WHEN sku ILIKE $${containsIdx} OR barcode ILIKE $${containsIdx}
      OR variant_value ILIKE $${containsIdx}
      OR display_name ILIKE $${containsIdx}
      OR variant_name ILIKE $${containsIdx} THEN 7
    ELSE 8
  END ASC`;
}

function buildNumericTokenWhere(cols, token, paramIndex) {
  const parts = [];
  for (const col of cols.code) {
    parts.push(`LOWER(TRIM(COALESCE(${col}, ''))) = LOWER($${paramIndex})`);
    parts.push(`${col} ILIKE $${paramIndex + 1}`);
  }
  for (const col of cols.text) {
    parts.push(`${col} ILIKE $${paramIndex + 2}`);
  }
  return {
    clause: ` AND (${parts.join(' OR ')})`,
    params: [token, `${token}%`, `%${token}%`],
    nextParamIndex: paramIndex + 3,
    rank: { exactIdx: paramIndex, prefixIdx: paramIndex + 1, containsIdx: paramIndex + 2 },
    isNumeric: true,
  };
}

function buildTextTokenWhere(cols, token, paramIndex) {
  const allCols = [...cols.code, ...cols.text];
  const orParts = allCols.map((col) => `${col} ILIKE $${paramIndex}`);
  return {
    clause: ` AND (${orParts.join(' OR ')})`,
    params: [`%${token}%`],
    nextParamIndex: paramIndex + 1,
    rank: { containsIdx: paramIndex },
    isNumeric: false,
  };
}

/**
 * Flexible product-name token match (spacing, x-notation, compact, fuzzy trgm).
 */
function buildFlexibleProductTokenWhere(cols, token, paramIndex, options = {}) {
  const nameCompactSql = options.nameCompactSql || SQL_PRODUCT_NAME_COMPACT;
  const variants = expandTokenVariants(token);
  const orParts = [];
  const params = [];
  let idx = paramIndex;
  let primaryContainsIdx = null;

  for (const variant of variants) {
    const like = `%${variant}%`;
    if (!primaryContainsIdx) primaryContainsIdx = idx;

    for (const col of cols.text) {
      orParts.push(`${col} ILIKE $${idx}`);
      params.push(like);
      idx++;
      if (/^\d+(\.\d+)?$/.test(variant)) {
        orParts.push(`${col} ILIKE $${idx}`);
        params.push(`${variant} %`);
        idx++;
      }
    }

    const similarityCol = options.similarityCol || (cols.text.includes('name') ? 'name' : null);
    if (nameCompactSql) {
      orParts.push(`${nameCompactSql} LIKE $${idx}`);
      params.push(`%${compactSearchPhrase(variant)}%`);
      idx++;

      if (similarityCol && variant.length >= 3) {
        orParts.push(`similarity(${similarityCol}, $${idx}) > 0.12`);
        params.push(variant);
        idx++;
      }
    }

    for (const col of cols.code) {
      orParts.push(`LOWER(TRIM(COALESCE(${col}, ''))) = LOWER($${idx})`);
      params.push(variant);
      idx++;
      orParts.push(`${col} ILIKE $${idx}`);
      params.push(`${variant}%`);
      idx++;
      orParts.push(`${col} ILIKE $${idx}`);
      params.push(like);
      idx++;
    }
  }

  return {
    clause: ` AND (${orParts.join(' OR ')})`,
    params,
    nextParamIndex: idx,
    rank: { containsIdx: primaryContainsIdx || paramIndex },
    isNumeric: /^\d+(\.\d+)?$/.test(String(token).trim()),
  };
}

/**
 * Product list/search WHERE + ORDER BY (reuses bound params in ORDER BY).
 */
function buildProductListSearch(search, startParamIndex = 1) {
  const tokens = splitSearchTokens(search);
  if (!tokens.length) {
    return { whereSql: '', params: [], nextParamIndex: startParamIndex, orderBySql: null };
  }

  const cols = {
    code: ['sku', 'barcode'],
    text: ['name', 'hs_code', 'import_ref_no', 'gd_number', 'invoice_ref'],
  };

  let whereSql = '';
  const params = [];
  let idx = startParamIndex;
  let firstRank = null;

  for (const token of tokens) {
    const built = buildFlexibleProductTokenWhere(cols, token, idx);
    whereSql += built.clause;
    params.push(...built.params);
    idx = built.nextParamIndex;
    if (!firstRank) firstRank = built.rank;
  }

  const whereParams = params;
  const whereNextParamIndex = idx;

  const rankContains = firstRank?.containsIdx ?? startParamIndex;
  const firstToken = tokens[0] || '';
  const compactIdx = whereNextParamIndex;
  const orderByParams = [`%${compactSearchPhrase(firstToken)}%`];
  const similarityIdx = compactIdx + 1;
  orderByParams.push(firstToken);

  const orderBySql = `CASE
    WHEN name ILIKE $${rankContains} THEN 0
    WHEN ${SQL_PRODUCT_NAME_COMPACT} LIKE $${compactIdx} THEN 1
    WHEN similarity(name, $${similarityIdx}) > 0.12 THEN 2
    WHEN sku ILIKE $${rankContains} OR barcode ILIKE $${rankContains} THEN 3
    ELSE 4
  END ASC, ${sqlNaturalCodeOrder()}`;

  return {
    whereSql,
    whereParams,
    whereNextParamIndex,
    orderBySql,
    orderByParams,
    params: [...whereParams, ...orderByParams],
    nextParamIndex: whereNextParamIndex + orderByParams.length,
  };
}

/**
 * Product variant list/search WHERE + ORDER BY.
 */
function buildVariantListSearch(search, startParamIndex = 1) {
  const tokens = splitSearchTokens(search);
  if (!tokens.length) {
    return { whereSql: '', params: [], nextParamIndex: startParamIndex, orderBySql: null };
  }

  const cols = {
    code: ['sku', 'barcode', 'variant_value'],
    text: ['variant_name', 'display_name'],
  };

  let whereSql = '';
  const params = [];
  let idx = startParamIndex;
  let firstRank = null;

  for (const token of tokens) {
    const built = buildFlexibleProductTokenWhere(
      { code: cols.code, text: ['display_name', 'variant_name', 'variant_value'] },
      token,
      idx,
      {
        nameCompactSql: SQL_VARIANT_DISPLAY_COMPACT,
        similarityCol: 'display_name',
      }
    );
    whereSql += built.clause;
    params.push(...built.params);
    idx = built.nextParamIndex;
    if (!firstRank) firstRank = built.rank;
  }

  const whereParams = params;
  const whereNextParamIndex = idx;

  const rankContains = firstRank?.containsIdx ?? startParamIndex;
  const firstToken = tokens[0] || '';
  const compactIdx = whereNextParamIndex;
  const orderByParams = [`%${compactSearchPhrase(firstToken)}%`];

  const orderBySql = `CASE
    WHEN display_name ILIKE $${rankContains} OR variant_name ILIKE $${rankContains} THEN 0
    WHEN ${SQL_VARIANT_DISPLAY_COMPACT} LIKE $${compactIdx} THEN 1
    WHEN variant_value ILIKE $${rankContains} THEN 2
    WHEN sku ILIKE $${rankContains} OR barcode ILIKE $${rankContains} THEN 3
    ELSE 4
  END ASC, ${sqlNaturalCodeOrder('sku', 'barcode', 'display_name')}`;

  return {
    whereSql,
    whereParams,
    whereNextParamIndex,
    orderBySql,
    orderByParams,
    params: [...whereParams, ...orderByParams],
    nextParamIndex: whereNextParamIndex + orderByParams.length,
  };
}

/**
 * Customer / supplier party search WHERE + ORDER BY.
 */
function buildPartyListSearch(search, startParamIndex = 1) {
  const tokens = splitSearchTokens(search);
  if (!tokens.length) {
    return { whereSql: '', params: [], nextParamIndex: startParamIndex, orderBySql: null };
  }

  const cols = {
    code: [],
    text: ['business_name', 'name', 'email', 'phone'],
  };

  let whereSql = '';
  const params = [];
  let idx = startParamIndex;
  let firstRank = null;
  let firstNumeric = false;

  for (const token of tokens) {
    const built = isNumericToken(token)
      ? buildNumericTokenWhere({ code: ['phone'], text: ['business_name', 'name', 'email'] }, token, idx)
      : buildTextTokenWhere(cols, token, idx);
    whereSql += built.clause;
    params.push(...built.params);
    idx = built.nextParamIndex;
    if (!firstRank) {
      firstRank = built.rank;
      firstNumeric = built.isNumeric;
    }
  }

  let orderBySql;
  if (firstNumeric) {
    orderBySql = `CASE
      WHEN phone ILIKE $${firstRank.prefixIdx} THEN 0
      WHEN phone ILIKE $${firstRank.containsIdx} THEN 1
      WHEN business_name ILIKE $${firstRank.containsIdx} OR name ILIKE $${firstRank.containsIdx} THEN 2
      ELSE 3
    END ASC,
    LOWER(COALESCE(business_name, name, '')) ASC`;
  } else {
    const c = firstRank.containsIdx;
    orderBySql = `CASE
      WHEN business_name ILIKE $${c} OR name ILIKE $${c} THEN 0
      WHEN email ILIKE $${c} THEN 1
      WHEN phone ILIKE $${c} THEN 2
      ELSE 3
    END ASC,
    LOWER(COALESCE(business_name, name, '')) ASC`;
  }

  return { whereSql, params, nextParamIndex: idx, orderBySql };
}

/**
 * Bank account search WHERE + ORDER BY (numeric account numbers sorted numerically when possible).
 */
function buildBankListSearch(search, startParamIndex = 1) {
  const tokens = splitSearchTokens(search);
  if (!tokens.length) {
    return { whereSql: '', params: [], nextParamIndex: startParamIndex, orderBySql: null };
  }

  const cols = {
    code: ['account_number'],
    text: ['bank_name', 'account_name', 'branch_name'],
  };

  let whereSql = '';
  const params = [];
  let idx = startParamIndex;
  let firstRank = null;
  let firstNumeric = false;

  for (const token of tokens) {
    const built = isNumericToken(token)
      ? buildNumericTokenWhere(cols, token, idx)
      : buildTextTokenWhere(cols, token, idx);
    whereSql += built.clause;
    params.push(...built.params);
    idx = built.nextParamIndex;
    if (!firstRank) {
      firstRank = built.rank;
      firstNumeric = built.isNumeric;
    }
  }

  let orderBySql;
  if (firstNumeric) {
    orderBySql = `CASE
      WHEN account_number ILIKE $${firstRank.prefixIdx} THEN 0
      WHEN bank_name ILIKE $${firstRank.prefixIdx} OR account_name ILIKE $${firstRank.prefixIdx} THEN 1
      ELSE 2
    END ASC,
    CASE WHEN account_number ~ '^[0-9]+$' THEN account_number::numeric END ASC NULLS LAST,
    LOWER(bank_name) ASC, LOWER(account_number) ASC`;
  } else {
    const c = firstRank.containsIdx;
    orderBySql = `CASE
      WHEN bank_name ILIKE $${c} OR account_name ILIKE $${c} THEN 0
      WHEN account_number ILIKE $${c} THEN 1
      ELSE 2
    END ASC,
    LOWER(bank_name) ASC`;
  }

  return { whereSql, params, nextParamIndex: idx, orderBySql };
}

/**
 * Supplier list/search (company_name primary).
 */
function buildSupplierListSearch(search, startParamIndex = 1) {
  const tokens = splitSearchTokens(search);
  if (!tokens.length) {
    return { whereSql: '', params: [], nextParamIndex: startParamIndex, orderBySql: null };
  }

  const cols = {
    code: ['phone'],
    text: ['company_name', 'business_name', 'name', 'email', 'contact_person'],
  };

  let whereSql = '';
  const params = [];
  let idx = startParamIndex;
  let firstRank = null;
  let firstNumeric = false;

  for (const token of tokens) {
    const built = isNumericToken(token)
      ? buildNumericTokenWhere(cols, token, idx)
      : buildTextTokenWhere(cols, token, idx);
    whereSql += built.clause;
    params.push(...built.params);
    idx = built.nextParamIndex;
    if (!firstRank) {
      firstRank = built.rank;
      firstNumeric = built.isNumeric;
    }
  }

  let orderBySql;
  if (firstNumeric) {
    orderBySql = `CASE
      WHEN phone ILIKE $${firstRank.prefixIdx} THEN 0
      WHEN company_name ILIKE $${firstRank.prefixIdx} OR business_name ILIKE $${firstRank.prefixIdx} THEN 1
      ELSE 2
    END ASC,
    LOWER(COALESCE(company_name, business_name, name, '')) ASC`;
  } else {
    const c = firstRank.containsIdx;
    orderBySql = `CASE
      WHEN company_name ILIKE $${c} OR business_name ILIKE $${c} OR name ILIKE $${c} THEN 0
      WHEN email ILIKE $${c} OR contact_person ILIKE $${c} THEN 1
      WHEN phone ILIKE $${c} THEN 2
      ELSE 3
    END ASC,
    LOWER(COALESCE(company_name, business_name, name, '')) ASC`;
  }

  return { whereSql, params, nextParamIndex: idx, orderBySql };
}

module.exports = {
  isNumericToken,
  sqlNaturalCodeOrder,
  buildProductListSearch,
  buildVariantListSearch,
  buildPartyListSearch,
  buildSupplierListSearch,
  buildBankListSearch,
};
