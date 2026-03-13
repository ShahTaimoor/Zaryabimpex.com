import React from 'react';

/**
 * PrintLayout - Layout wrapper for print content.
 * Supports A4 invoice and 80mm thermal formats.
 */
export const PrintLayoutA4 = ({ children, className = '' }) => (
  <div className={`print-layout-a4 print-document ${className}`}>
    {children}
  </div>
);

export const PrintLayoutThermal = ({ children, className = '' }) => (
  <div className={`print-layout-thermal print-document print-document--receipt ${className}`}>
    {children}
  </div>
);

/**
 * Get layout component by format
 */
export const getPrintLayout = (format = 'a4') => {
  switch (format) {
    case 'thermal':
    case '80mm':
      return PrintLayoutThermal;
    case 'a4':
    default:
      return PrintLayoutA4;
  }
};

export default { PrintLayoutA4, PrintLayoutThermal, getPrintLayout };
