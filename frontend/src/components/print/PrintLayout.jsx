import React from 'react';
import { getThermalCssVariables, getThermalConfig } from './thermalPrintConfig';

/**
 * PrintLayout - Layout wrapper for print content.
 * Supports A4 invoice and thermal receipt formats.
 */
export const PrintLayoutA4 = ({ children, className = '' }) => (
  <div className={`print-layout-a4 print-document ${className}`}>
    {children}
  </div>
);

export const PrintLayoutThermal = ({ children, className = '', printSettings = {} }) => {
  const config = getThermalConfig(printSettings);
  return (
    <div
      className={`print-thermal-root ${className}`}
      style={getThermalCssVariables(config)}
    >
      {children}
    </div>
  );
};

/**
 * Get layout component by format
 */
export const getPrintLayout = (format = 'a4', printSettings = {}) => {
  switch (format) {
    case 'thermal':
    case '58mm':
    case '80mm':
      return ({ children, className }) => (
        <PrintLayoutThermal printSettings={{ ...printSettings, thermalPaperWidth: format }} className={className}>
          {children}
        </PrintLayoutThermal>
      );
    case 'a4':
    default:
      return PrintLayoutA4;
  }
};

export default { PrintLayoutA4, PrintLayoutThermal, getPrintLayout };
