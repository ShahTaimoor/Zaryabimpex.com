import { useMemo } from 'react';
import { useGetWarehousesQuery } from '../../../store/services/warehousesApi';
import { useGetShopsQuery } from '../../../store/services/shopsApi';
import { getLocationId, getPrimaryLocation, normalizeLocationList } from '../utils/inventoryHelpers';

export function usePrimaryLocations({ skip = false } = {}) {
  const { data: warehousesData, isLoading: warehousesLoading } = useGetWarehousesQuery(
    { limit: 100, isActive: true },
    { skip }
  );
  const { data: shopsData, isLoading: shopsLoading } = useGetShopsQuery(undefined, { skip });

  const warehouses = useMemo(
    () => normalizeLocationList(warehousesData, 'warehouses'),
    [warehousesData]
  );
  const shops = useMemo(() => normalizeLocationList(shopsData, 'shops'), [shopsData]);

  const primaryWarehouse = useMemo(() => getPrimaryLocation(warehouses), [warehouses]);
  const primaryShop = useMemo(() => getPrimaryLocation(shops), [shops]);

  return {
    isLoading: warehousesLoading || shopsLoading,
    warehouses,
    shops,
    primaryWarehouse,
    primaryShop,
    primaryWarehouseId: getLocationId(primaryWarehouse),
    primaryShopId: getLocationId(primaryShop),
  };
}

export default usePrimaryLocations;
