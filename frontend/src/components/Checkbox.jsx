/**
 * Checkbox Component
 */

import React from 'react';

export const Checkbox = ({ checked, onChange, disabled = false, className = '', ...props }) => {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange?.(e.target.checked)}
      disabled={disabled}
      className={`h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded ${className}`}
      {...props}
    />
  );
};

export default Checkbox;

