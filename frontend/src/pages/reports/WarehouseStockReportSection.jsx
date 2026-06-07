import LocationStockReportSection from '../../features/inventory/components/LocationStockReportSection';

/** @deprecated Use LocationStockReportSection with locationType="warehouse" */
export default function WarehouseStockReportSection(props) {
  return <LocationStockReportSection {...props} locationType="warehouse" />;
}
