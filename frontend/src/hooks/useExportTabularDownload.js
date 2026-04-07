import { useCallback } from 'react';
import { runTabularExportDownload, triggerBrowserFileDownload } from '@/utils/exportReportDownload';
import { presentPdfExportBlob } from '@/utils/exportReportPresentation';
import { showErrorToast, showSuccessToast } from '@/utils/errorHandler';

/**
 * Memoized wrapper around runTabularExportDownload using an RTK download mutation trigger.
 * PDF opens in a new tab (with validation); other formats trigger a file download.
 * @param {(filename: string) => { unwrap: () => Promise<unknown> }} downloadMutation - e.g. from useDownloadFileMutation()[0]
 */
export function useExportTabularDownload(downloadMutation) {
  const downloadUnwrap = useCallback(
    (filename) => downloadMutation(filename).unwrap(),
    [downloadMutation]
  );

  return useCallback(
    async (params) => {
      const { format, ...rest } = params;
      const { filename, blob } = await runTabularExportDownload({
        ...rest,
        format,
        downloadUnwrap,
      });
      if (format === 'pdf') {
        presentPdfExportBlob(blob, filename, {
          error: showErrorToast,
          success: showSuccessToast,
        });
      } else {
        triggerBrowserFileDownload(blob, filename, 100);
      }
      return { filename, blob };
    },
    [downloadUnwrap]
  );
}
