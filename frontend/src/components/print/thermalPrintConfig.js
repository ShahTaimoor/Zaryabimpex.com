/**
 * Thermal printer configuration — single source of truth for paper sizing.
 * Used by ThermalReceipt (screen), printStyles.css (via CSS variables on root),
 * and react-to-print iframe pageStyle generation.
 *
 * Supports 58mm and 80mm roll widths; add presets here for new models.
 */

export const THERMAL_PRINTER_PRESETS = {
  '58mm': {
    paperWidth: '58mm',
    contentWidth: '54mm',
    horizontalMargin: '2mm',
    fontSize: '10px',
    tableFontSize: '9px',
    storeNameFontSize: '15px',
    storeDetailsFontSize: '8px',
    totalFontSize: '12px',
    barcodeWidth: '44mm',
    barcodeHeight: '9mm',
  },
  '80mm': {
    paperWidth: '80mm',
    contentWidth: '76mm',
    horizontalMargin: '2mm',
    fontSize: '11px',
    tableFontSize: '10px',
    storeNameFontSize: '19px',
    storeDetailsFontSize: '9px',
    totalFontSize: '13px',
    barcodeWidth: '52mm',
    barcodeHeight: '10mm',
  },
};

/**
 * Resolve thermal preset from print settings.
 * @param {object} [printSettings]
 * @returns {object} config with `preset` key ('58mm' | '80mm')
 */
export function getThermalConfig(printSettings = {}) {
  const raw =
    printSettings.thermalPaperWidth ||
    printSettings.printSize ||
    '80mm';
  const normalized = String(raw).toLowerCase();
  const preset = normalized.includes('58') ? '58mm' : '80mm';
  return { ...THERMAL_PRINTER_PRESETS[preset], preset };
}

/** Inline style object for CSS custom properties on thermal root elements. */
export function getThermalCssVariables(config) {
  return {
    '--thermal-paper-width': config.paperWidth,
    '--thermal-content-width': config.contentWidth,
    '--thermal-horizontal-margin': config.horizontalMargin,
    '--thermal-font-size': config.fontSize,
    '--thermal-table-font-size': config.tableFontSize,
    '--thermal-store-name-font-size': config.storeNameFontSize,
    '--thermal-store-details-font-size': config.storeDetailsFontSize,
    '--thermal-total-font-size': config.totalFontSize,
    '--thermal-barcode-width': config.barcodeWidth,
    '--thermal-barcode-height': config.barcodeHeight,
  };
}

/**
 * Minimal iframe @page + shell rules for react-to-print.
 * Component styles come from thermalReceipt.css + printStyles.css (scoped).
 */
export function buildThermalPrintPageStyle(config = getThermalConfig()) {
  const { paperWidth, contentWidth, horizontalMargin } = config;

  return `
    @page {
      size: ${paperWidth} 297mm;
      margin: 0;
    }
    html, body {
      width: ${paperWidth};
      max-width: ${paperWidth};
      min-width: ${paperWidth};
      height: auto !important;
      min-height: auto !important;
      margin: 0;
      padding: 0;
      background: #fff;
      overflow: visible;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      -webkit-text-size-adjust: 100%;
    }
    * { box-sizing: border-box; }
    .no-print, .btn, button, .print-toolbar { display: none !important; }
    .print-wrapper,
    .print-preview-scale,
    .print-modal-preview,
    .print-thermal-root {
      transform: none;
      width: ${paperWidth};
      max-width: ${paperWidth};
      margin: 0;
      padding: 0;
      box-shadow: none;
      border: none;
      overflow: visible;
    }
    .thermal-receipt {
      width: ${contentWidth};
      max-width: ${contentWidth};
      margin: 0 ${horizontalMargin};
      padding: 1mm 0;
      display: block;
      transform: none;
      overflow: visible;
    }
  `;
}

/** Default 80mm page style (backward compatible export). */
export const THERMAL_PRINT_PAGE_STYLE = buildThermalPrintPageStyle(
  THERMAL_PRINTER_PRESETS['80mm']
);

export function getThermalPrintPageStyle(printSettings) {
  return buildThermalPrintPageStyle(getThermalConfig(printSettings));
}
