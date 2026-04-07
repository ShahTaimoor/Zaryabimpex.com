import React, { useMemo } from 'react';
import { Download } from 'lucide-react';
import BaseModal from '@/components/BaseModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const FORMAT_OPTIONS = [
  { value: 'pdf', title: 'PDF', description: 'Print-ready format' },
  { value: 'excel', title: 'Excel', description: 'Spreadsheet format' },
  { value: 'csv', title: 'CSV', description: 'Comma-separated values' },
  { value: 'json', title: 'JSON', description: 'Data format' },
];

/**
 * Reusable export modal: format radios, optional date range, confirm/cancel.
 */
function ExportReportModal({
  isOpen,
  onClose,
  title = 'Export Report',
  format: selectedFormat,
  onFormatChange,
  dateFrom = '',
  dateTo = '',
  onDateFromChange,
  onDateToChange,
  onResetDates,
  defaultDateRange,
  onConfirm,
  isExporting = false,
  formatOptions = FORMAT_OPTIONS,
  namePrefix = 'export-format',
  /** Hide date fields (format-only export) */
  showDateRange = true,
  /**
   * When boolean, controls reset/clear link visibility. When omitted, link shows if dates differ from defaultDateRange.
   */
  showDateResetLink: showDateResetLinkProp,
  dateResetLinkLabel = 'Reset to default',
}) {
  const showResetFromDefault = useMemo(
    () =>
      Boolean(
        defaultDateRange &&
          (dateFrom !== defaultDateRange.from || dateTo !== defaultDateRange.to)
      ),
    [dateFrom, dateTo, defaultDateRange]
  );

  const showReset =
    typeof showDateResetLinkProp === 'boolean' ? showDateResetLinkProp : showResetFromDefault;

  const handleClose = () => {
    if (isExporting) return;
    onClose?.();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      maxWidth="lg"
      variant="centered"
      closeOnBackdrop={!isExporting}
      closeOnEscape={!isExporting}
      className="rounded-lg shadow-xl max-w-lg w-full"
      contentClassName="p-6"
      footer={
        <div className="flex justify-end space-x-3 w-full">
          <Button type="button" onClick={handleClose} variant="secondary" disabled={isExporting}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} variant="default" disabled={isExporting}>
            {isExporting ? (
              <>
                <LoadingSpinner className="h-4 w-4 mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Export Format</label>
          <div className="grid grid-cols-2 gap-3">
            {formatOptions.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <Input
                  type="radio"
                  name={namePrefix}
                  value={opt.value}
                  checked={selectedFormat === opt.value}
                  onChange={(e) => onFormatChange(e.target.value)}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900">{opt.title}</div>
                  {opt.description && <div className="text-sm text-gray-500">{opt.description}</div>}
                </div>
              </label>
            ))}
          </div>
        </div>

        {showDateRange && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Date Range (Optional)</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">From Date</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange?.(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">To Date</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateToChange?.(e.target.value)}
                  min={dateFrom || undefined}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            {showReset && onResetDates && (
              <button
                type="button"
                onClick={onResetDates}
                className="mt-2 text-sm text-primary-600 hover:text-primary-700"
              >
                {dateResetLinkLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </BaseModal>
  );
}

export default React.memo(ExportReportModal);
