import { useMemo } from 'react';
import { useCompanyInfo } from '../../../hooks/useCompanyInfo';
import { isWarehouseInventoryEnabled } from '../../../utils/warehouseInventory';

export function useWarehouseInventoryMode() {
  const { companyInfo, isLoading } = useCompanyInfo();
  const enabled = isWarehouseInventoryEnabled(companyInfo);

  return useMemo(
    () => ({
      isLoading,
      enabled,
      warehouseMode: enabled,
      shopLabel: 'Main Shop',
      warehouseLabel: 'Warehouse',
    }),
    [enabled, isLoading]
  );
}

export default useWarehouseInventoryMode;
