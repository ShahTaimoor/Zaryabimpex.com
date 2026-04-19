import { useState, useEffect, useMemo } from 'react';
import { useLazyGetProductsQuery } from '@/store/services/productsApi';
import { useLazyGetVariantsQuery } from '@/store/services/productVariantsApi';

const SEARCH_DEBOUNCE_MS = 280;
const MIN_SEARCH_CHARS = 2;
const POS_SEARCH_LIMIT = 100;
const VARIANT_SEARCH_LIMIT = 50;

/** Barcode (mostly digits) or compact SKU: exact match on sku OR barcode. */
export function looksLikeExactProductCode(raw) {
  const t = String(raw ?? '').trim();
  if (t.length < 4) return false;
  // Digits only: GTIN-8 or longer barcodes
  if (/^\d+$/.test(t)) return t.length >= 6;
  // Alphanumeric: require 8+ chars to avoid overlapping with common 4-7 char names (e.g. MILK, COCA)
  if (/^[A-Za-z0-9._-]+$/.test(t)) return t.length >= 8;
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
  if (!t) return 'Start typing to search (min 2 characters), or scan barcode/SKU.';
  if (t.length < MIN_SEARCH_CHARS && !looksLikeExactProductCode(t)) {
    return 'Type at least 2 characters, or scan a barcode/SKU.';
  }
  return 'No products found';
}

/**
 * Debounced server-side product + variant search for POS / order lines.
 * @param {string} searchTerm - raw input (e.g. controlled field value)
 * @param {{ dropdownLimit?: number }} [options]
 * @returns {{ items: Array, isLoading: boolean, emptyMessage: string }}
 */
export function useDebouncedPosProductSearch(searchTerm, options = {}) {
  const dropdownLimit = options.dropdownLimit ?? 100;

  const [triggerProducts, { isFetching: productsFetching }] = useLazyGetProductsQuery();
  const [triggerVariants, { isFetching: variantsFetching }] = useLazyGetVariantsQuery();

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [searchItems, setSearchItems] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearchTerm(String(searchTerm ?? '').trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    let cancelled = false;
    const q = debouncedSearchTerm;

    async function load() {
      if (!q) {
        setSearchItems([]);
        return;
      }
      const exact = looksLikeExactProductCode(q);
      if (!exact && q.length < MIN_SEARCH_CHARS) {
        setSearchItems([]);
        return;
      }

      const baseProductParams = { status: 'active', limit: POS_SEARCH_LIMIT };
      if (exact) {
        baseProductParams.code = q;
      } else {
        baseProductParams.search = q;
      }

      const variantParams = {
        status: 'active',
        limit: VARIANT_SEARCH_LIMIT,
        ...(exact ? { code: q } : { search: q }),
      };

      try {
        const [pRes, vRes] = await Promise.all([
          triggerProducts(baseProductParams).unwrap(),
          triggerVariants(variantParams).unwrap(),
        ]);
        if (cancelled) return;

        const rawProducts = pRes?.products ?? pRes?.data?.products ?? [];
        const rawVariants = vRes?.variants ?? vRes?.data?.variants ?? [];

        const productsList = (Array.isArray(rawProducts) ? rawProducts : []).map((p) => ({
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

        setSearchItems([...productsList, ...variantsList].slice(0, dropdownLimit));
      } catch {
        if (!cancelled) setSearchItems([]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearchTerm, triggerProducts, triggerVariants, dropdownLimit]);

  const isLoading = productsFetching || variantsFetching;

  const emptyMessage = useMemo(
    () => getPosProductSearchEmptyMessage(searchTerm),
    [searchTerm]
  );

  return { items: searchItems, isLoading, emptyMessage };
}
