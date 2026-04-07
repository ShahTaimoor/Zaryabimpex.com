/**
 * Shared export → server filename → download blob.
 * Tabular pages use `useExportTabularDownload`: PDF via `presentPdfExportBlob`, other formats via `triggerBrowserFileDownload`.
 */

export const EXPORT_MIME_BY_FORMAT = {
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  json: 'application/json',
  csv: 'text/csv',
};

export function resolveExportFilename(response, fallbackFilenames, format) {
  const fallback = fallbackFilenames?.[format];
  return response?.filename || response?.data?.filename || fallback;
}

/** Normalize RTK/blob responses to a single Blob */
export function normalizeExportDownloadToBlob(downloadResponse, format) {
  if (downloadResponse instanceof Blob) return downloadResponse;
  if (downloadResponse?.data instanceof Blob) return downloadResponse.data;
  const raw = downloadResponse?.data !== undefined ? downloadResponse.data : downloadResponse;
  const type = EXPORT_MIME_BY_FORMAT[format] || 'application/octet-stream';
  return new Blob([raw], { type });
}

export function triggerBrowserFileDownload(blob, filename, revokeDelayMs = 100) {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), revokeDelayMs);
  }
}

export const EXPORT_NO_FILENAME = 'EXPORT_NO_FILENAME';

/** Default download filenames when the API omits `filename` (per feature area). */
export const TABULAR_EXPORT_FALLBACK_FILENAMES = {
  cashReceipts: {
    excel: 'cash_receipts.xlsx',
    pdf: 'cash_receipts.pdf',
    json: 'cash_receipts.json',
    csv: 'cash_receipts.csv',
  },
  cashPayments: {
    excel: 'cash_payments.xlsx',
    pdf: 'cash_payments.pdf',
    json: 'cash_payments.json',
    csv: 'cash_payments.csv',
  },
  bankReceipts: {
    excel: 'bank_receipts.xlsx',
    pdf: 'bank_receipts.pdf',
    json: 'bank_receipts.json',
    csv: 'bank_receipts.csv',
  },
  bankPayments: {
    excel: 'bank_payments.xlsx',
    pdf: 'bank_payments.pdf',
    json: 'bank_payments.json',
    csv: 'bank_payments.csv',
  },
  purchaseInvoices: {
    excel: 'purchase_invoices.xlsx',
    pdf: 'purchase_invoices.pdf',
    json: 'purchase_invoices.json',
    csv: 'purchase_invoices.csv',
  },
};

/**
 * Build standard excel/pdf/json/csv runners for RTK export mutations (same payload per format).
 * @param {Record<string, unknown>} payload
 * @param {{ exportExcelMutation: Function, exportPDFMutation: Function, exportJSONMutation: Function, exportCSVMutation: Function }} mutations
 */
export function buildTabularExportRunners(payload, mutations) {
  const { exportExcelMutation, exportPDFMutation, exportJSONMutation, exportCSVMutation } = mutations;
  return {
    excel: () => exportExcelMutation(payload).unwrap(),
    pdf: () => exportPDFMutation(payload).unwrap(),
    json: () => exportJSONMutation(payload).unwrap(),
    csv: () => exportCSVMutation(payload).unwrap(),
  };
}

/**
 * @param {Object} opts
 * @param {'excel'|'pdf'|'csv'|'json'} opts.format
 * @param {Record<string, () => Promise<unknown>>} opts.exportRunners — must include opts.format key
 * @param {(filename: string) => Promise<unknown>} opts.downloadUnwrap
 * @param {Record<string, string>} opts.fallbackFilenames
 * @returns {Promise<{ filename: string, blob: Blob }>} — caller presents PDF (new tab) vs download (see useExportTabularDownload).
 */
export async function runTabularExportDownload({
  format,
  exportRunners,
  downloadUnwrap,
  fallbackFilenames,
}) {
  const runner = exportRunners[format];
  if (!runner) {
    throw new Error(`Unsupported export format: ${format}`);
  }
  const response = await runner();
  const filename = resolveExportFilename(response, fallbackFilenames, format);
  if (!filename) {
    const err = new Error('Export did not return a filename');
    err.code = EXPORT_NO_FILENAME;
    throw err;
  }
  if (format === 'pdf') {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const downloadResponse = await downloadUnwrap(filename);
  const blob = normalizeExportDownloadToBlob(downloadResponse, format);
  return { filename, blob };
}
