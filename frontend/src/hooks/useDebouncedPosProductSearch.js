import { useState, useEffect, useMemo } from 'react';
import { useLazyGetProductsQuery } from '@/store/services/productsApi';
import { useLazyGetVariantsQuery } from '@/store/services/productVariantsApi';
import {
  PRODUCT_BROWSE_DROPDOWN_LIMIT,
  PRODUCT_SEARCH_DROPDOWN_LIMIT,
} from '@/constants/listPagination';

const SEARCH_DEBOUNCE_MS = 280;
const MIN_SEARCH_CHARS = 2;

/**
 * Barcode / long SKU only — exact match on sku OR barcode.
 * Short numerics (e.g. "125", "12") use flexible server search so they can match product names.
 */
export function looksLikeExactProductCode(raw) {
  const t = String(raw ?? '').trim();
  if (t.length < 2) return false;
  if (/^\d+$/.test(t)) return t.length >= 8;
  if (/^[A-Za-z0-9._-]+$/.test(t)) return t.length >= 12;
  return false;
}

function parseMaybeJson(val, fallback = {}) {
  if (val == null) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function normalizeInventoryFields(source = {}) {
  const inv = parseMaybeJson(source.inventory ?? source.inventory_data, {});
  return {
    currentStock:
      Number(inv.currentStock ?? inv.current_stock ?? source.currentStock ?? source.current_stock ?? 0) || 0,
    reorderPoint:
      Number(inv.reorderPoint ?? inv.reorder_point ?? source.reorderPoint ?? source.reorder_point ?? 0) || 0,
  };
}

function normalizeProductRow(p) {
  if (!p) return null;
  return {
    ...p,
    inventory: normalizeInventoryFields(p),
  };
}

function normalizeVariantRow(v) {
  if (!v) return null;
  const pricing = parseMaybeJson(v.pricing, {});
  const inv = parseMaybeJson(v.inventory ?? v.inventory_data, {});
  const active = v.is_active !== false && v.status !== 'inactive';
  return {
    ...v,
    variantName: v.variantName || v.variant_name,
    variantValue: v.variantValue || v.variant_value,
    variantType: v.variantType || v.variant_type,
    displayName: v.displayName || v.display_name,
    baseProductId: v.baseProductId || v.base_product_id,
    baseProduct: v.baseProduct,
    pricing,
    inventory: {
      currentStock: Number(inv.currentStock ?? inv.current_stock ?? 0) || 0,
      reorderPoint: Number(inv.reorderPoint ?? inv.reorder_point ?? 0) || 0,
    },
    status: active ? 'active' : 'inactive',
  };
}

export function getPosProductSearchEmptyMessage(searchTerm) {
  const t = String(searchTerm ?? '').trim();
  if (!t) return 'Showing first 20 products — type to search or scan barcode/SKU.';
  if (t.length < MIN_SEARCH_CHARS && !looksLikeExactProductCode(t)) {
    return 'Type at least 2 characters, or scan a barcode/SKU.';
  }
  return 'No products found';
}

/**
 * Debounced server-side product + variant search for POS / order lines.
 * @param {string} searchTerm - raw input (e.g. controlled field value)
 * @param {{ dropdownLimit?: number, browseLimit?: number, loadInitialOnEmpty?: boolean, refreshKey?: number }} [options]
 * @returns {{ items: Array, isLoading: boolean, emptyMessage: string }}
 */
export function useDebouncedPosProductSearch(searchTerm, options = {}) {
  const searchDropdownLimit = options.dropdownLimit ?? PRODUCT_SEARCH_DROPDOWN_LIMIT;
  const browseDropdownLimit = options.browseLimit ?? PRODUCT_BROWSE_DROPDOWN_LIMIT;
  const loadInitialOnEmpty = options.loadInitialOnEmpty !== false;
  const refreshKey = options.refreshKey ?? 0;

  const [triggerProducts, { isFetching: productsFetching }] = useLazyGetProductsQuery();
  const [triggerVariants, { isFetching: variantsFetching }] = useLazyGetVariantsQuery();

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [searchItems, setSearchItems] = useState([]);

  useEffect(() => {
    const term = String(searchTerm ?? '').trim();
    const delay = term ? SEARCH_DEBOUNCE_MS : 0;
    const t = setTimeout(() => setDebouncedSearchTerm(term), delay);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    let cancelled = false;
    const q = debouncedSearchTerm;

    async function load() {
      const isEmptyBrowse = !q;

      if (isEmptyBrowse && !loadInitialOnEmpty) {
        setSearchItems([]);
        return;
      }

      const exact = !isEmptyBrowse && looksLikeExactProductCode(q);
      if (!isEmptyBrowse && !exact && q.length < MIN_SEARCH_CHARS) {
        setSearchItems([]);
        return;
      }

      const resultLimit = isEmptyBrowse ? browseDropdownLimit : searchDropdownLimit;

      const baseProductParams = {
        status: 'active',
        limit: resultLimit,
        listMode: 'minimal',
        page: 1,
      };
      if (!isEmptyBrowse) {
        if (exact) {
          baseProductParams.code = q;
        } else {
          baseProductParams.search = q;
        }
      }

      const variantParams = isEmptyBrowse
        ? null
        : {
          status: 'active',
          limit: searchDropdownLimit,
          ...(exact ? { code: q } : { search: q }),
        };

      try {
        // Always bypass RTK cache — POS dropdown must show live stock (e.g. after a sale).
        const pRes = await triggerProducts(baseProductParams, false).unwrap();
        const vRes = variantParams
          ? await triggerVariants(variantParams, false).unwrap()
          : null;
        if (cancelled) return;

        const rawProducts = pRes?.products ?? pRes?.data?.products ?? [];
        const rawVariants = vRes?.variants ?? vRes?.data?.variants ?? [];

        const productsList = (Array.isArray(rawProducts) ? rawProducts : [])
          .map(normalizeProductRow)
          .filter(Boolean)
          .map((p) => ({
            ...p,
            isVariant: false,
          }));

        const variantsList = (Array.isArray(rawVariants) ? rawVariants : [])
          .map(normalizeVariantRow)
          .filter(Boolean)
          .filter((v) => v.status === 'active')
          .map((v) => ({
            ...v,
            isVariant: true,
            name:
              v.displayName ||
              v.variantName ||
              `${v.baseProduct?.name || ''} - ${v.variantValue || ''}`.trim() ||
              'Variant',
            baseProductId: v.baseProductId || v.baseProduct?._id || v.baseProduct,
            baseProductName: v.baseProduct?.name || '',
          }));

        setSearchItems([...productsList, ...variantsList].slice(0, resultLimit));
      } catch {
        if (!cancelled) setSearchItems([]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [
    debouncedSearchTerm,
    triggerProducts,
    triggerVariants,
    searchDropdownLimit,
    browseDropdownLimit,
    loadInitialOnEmpty,
    refreshKey,
  ]);

  const isLoading = productsFetching || variantsFetching;

  const emptyMessage = useMemo(
    () => getPosProductSearchEmptyMessage(searchTerm),
    [searchTerm]
  );

  return { items: searchItems, isLoading, emptyMessage };
}
