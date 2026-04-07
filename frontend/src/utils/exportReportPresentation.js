import { normalizeExportDownloadToBlob } from './exportReportDownload';

/**
 * RTK lazy query download: `{ data, error }` shape (e.g. useLazyDownloadExportFileQuery).
 */
export function interpretLazyQueryDownloadResult(downloadResult) {
  if (downloadResult?.error) {
    const err = downloadResult.error;
    const msg = err?.data?.message || err?.data?.error || err?.message || 'Download failed';
    return { ok: false, errorMessage: typeof msg === 'string' ? msg : 'Download failed' };
  }
  const blob = downloadResult?.data;
  if (!blob) {
    return { ok: false, errorMessage: 'Download failed: No data received from server' };
  }
  return { ok: true, blob };
}

export function unwrapExportDownloadBlob(raw) {
  if (raw instanceof Blob) return raw;
  if (raw?.data instanceof Blob) return raw.data;
  return raw;
}

/**
 * Validate blob and open PDF in a new tab, or fall back to download if the popup is blocked.
 * @param {unknown} blob
 * @param {string} filename
 * @param {{ error: (msg: string) => void, success: (msg: string) => void }} notify
 */
export function presentPdfExportBlob(blob, filename, notify) {
  const { error, success } = notify;

  if (!blob || !(blob instanceof Blob)) {
    if (typeof blob === 'string') {
      error(`Server error: ${blob.substring(0, 100)}`);
    } else if (blob && typeof blob === 'object') {
      let errorMsg = blob.message || blob.error;
      if (!errorMsg) {
        try {
          const stringified = JSON.stringify(blob);
          if (stringified === '{}' || stringified === 'null' || stringified === '') {
            errorMsg = blob.statusText || blob.status || 'Unknown server error';
          } else {
            errorMsg = stringified.substring(0, 150);
          }
        } catch {
          errorMsg = 'Invalid response format';
        }
      }
      error(`Server error: ${errorMsg || 'Unknown error'}`);
    } else {
      error('Invalid PDF file received - expected Blob. Response type: ' + typeof blob);
    }
    return;
  }

  const contentType = blob.type || '';
  if (contentType.includes('application/json') || contentType.includes('text/html')) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      try {
        const errorData = JSON.parse(text);
        error(errorData.message || 'File not found or generation failed');
      } catch {
        error('Server returned error instead of PDF. Please try again.');
      }
    };
    reader.readAsText(blob);
    return;
  }

  if (blob.size === 0) {
    error('PDF file is empty');
    return;
  }

  if (blob.type && !blob.type.includes('pdf') && !blob.type.includes('application/octet-stream')) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      if (text.includes('<!DOCTYPE') || text.includes('{"error"') || text.includes('{"message"')) {
        error('Server returned an error instead of PDF file');
      } else {
        const url = URL.createObjectURL(blob);
        const newWindow = window.open(url, '_blank');
        if (!newWindow) {
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          success('PDF downloaded (popup was blocked)');
        } else {
          success('PDF opened in new tab');
        }
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    };
    reader.readAsText(blob.slice(0, 100));
    return;
  }

  const url = URL.createObjectURL(blob);
  const newWindow = window.open(url, '_blank');
  if (!newWindow) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('PDF downloaded (popup was blocked)');
  } else {
    success('PDF opened in new tab');
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function presentNonPdfExportDownload(raw, format, filename, onSuccess) {
  const blob = normalizeExportDownloadToBlob(raw, format);
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
  onSuccess(`${String(format).toUpperCase()} file downloaded successfully`);
}

/**
 * Axios (`error.response`) and RTK Query `.unwrap()` / FetchBaseQueryError (`error.data`).
 */
export function notifyExportDownloadCatchError(downloadError, notifyError) {
  if (downloadError?.response) {
    if (downloadError.response.data instanceof Blob) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result;
        try {
          const errorData = JSON.parse(text);
          notifyError(errorData.message || 'Download failed');
        } catch {
          notifyError('Download failed: ' + text.substring(0, 100));
        }
      };
      reader.readAsText(downloadError.response.data);
      return;
    }
    notifyError(
      downloadError.response.data?.message || `Download failed: ${downloadError.response.status}`
    );
    return;
  }

  const data = downloadError?.data;
  if (data instanceof Blob) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      try {
        const parsed = JSON.parse(text);
        notifyError(parsed.message || 'Download failed');
      } catch {
        notifyError('Download failed: ' + String(text).substring(0, 100));
      }
    };
    reader.readAsText(data);
    return;
  }
  if (typeof data === 'string' && data.trim()) {
    notifyError(data);
    return;
  }
  if (typeof data === 'object' && data !== null) {
    notifyError(data.message || 'Download failed');
    return;
  }

  notifyError('Download failed: ' + (downloadError?.message || 'Unknown error'));
}
