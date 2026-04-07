import { handleApiError, showErrorToast, showSuccessToast } from './errorHandler';
import { EXPORT_NO_FILENAME } from './exportReportDownload';

/**
 * Runs tabular export + download, handles loading flag, toasts, and optional modal close.
 * Use with {@link useExportTabularDownload} as `runExportDownload`.
 */
export async function confirmTabularExportDownload({
  format,
  runExportDownload,
  exportRunners,
  fallbackFilenames,
  successMessage,
  errorContext,
  setIsExporting,
  onSuccess,
}) {
  setIsExporting(true);
  try {
    await runExportDownload({ format, exportRunners, fallbackFilenames });
    if (format !== 'pdf') {
      showSuccessToast(typeof successMessage === 'function' ? successMessage(format) : successMessage);
    }
    onSuccess?.();
  } catch (error) {
    if (error?.code === EXPORT_NO_FILENAME) {
      showErrorToast('Export failed: No filename received');
    } else {
      handleApiError(error, errorContext);
    }
  } finally {
    setIsExporting(false);
  }
}
