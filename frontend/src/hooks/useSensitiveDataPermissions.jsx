import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSIONS } from '../config/rbacConfig';

/**
 * Centralized hook for "Advanced" / sensitive-data permissions.
 *
 * Returns a single object with stable boolean flags that can be consumed
 * directly anywhere in the UI (lists, dropdowns, info cards, prints, PDFs).
 *
 * Also exposes helpers:
 *  - getPartyPermissions('customer' | 'supplier') -> { canViewBalance, canViewPhone }
 *  - getPrintPermissions(partyLabel)              -> { canViewBalance, canViewPhone }
 *
 * Why a hook? `hasPermission` already comes from React context (AuthContext),
 * so reading it here keeps every consumer reactive without each page having
 * to write the same `hasPermission('view_xxx')` lines over and over.
 */
export const useSensitiveDataPermissions = () => {
    const { hasPermission } = useAuth();

    return useMemo(() => {
        const canViewCustomerBalance = hasPermission(PERMISSIONS.VIEW_CUSTOMER_BALANCE);
        const canViewSupplierBalance = hasPermission(PERMISSIONS.VIEW_SUPPLIER_BALANCE);
        const canViewCustomerPhone = hasPermission(PERMISSIONS.VIEW_CUSTOMER_PHONE);
        const canViewSupplierPhone = hasPermission(PERMISSIONS.VIEW_SUPPLIER_PHONE);
        const canViewStock = hasPermission(PERMISSIONS.VIEW_STOCK_LEVELS);
        const canViewProductCosts = hasPermission(PERMISSIONS.VIEW_PRODUCT_COSTS);
        const canViewBP = hasPermission(PERMISSIONS.VIEW_BP);
        const canApplyLastPrices = hasPermission(PERMISSIONS.APPLY_LAST_PRICES);

        const isCustomer = (partyType) => {
            if (!partyType) return true;
            return String(partyType).toLowerCase().includes('customer');
        };

        const getPartyPermissions = (partyType) => {
            const customer = isCustomer(partyType);
            return {
                canViewBalance: customer ? canViewCustomerBalance : canViewSupplierBalance,
                canViewPhone: customer ? canViewCustomerPhone : canViewSupplierPhone
            };
        };

        return {
            canViewCustomerBalance,
            canViewSupplierBalance,
            canViewCustomerPhone,
            canViewSupplierPhone,
            canViewStock,
            canViewProductCosts,
            canViewBP,
            canApplyLastPrices,
            getPartyPermissions,
            getPrintPermissions: getPartyPermissions
        };
    }, [hasPermission]);
};

export default useSensitiveDataPermissions;
