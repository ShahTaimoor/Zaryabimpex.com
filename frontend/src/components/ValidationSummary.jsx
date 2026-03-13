/**
 * Validation Summary Component
 * Displays a summary of all form validation errors
 */

import React from 'react';
import { AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';

export const ValidationSummary = ({
  errors = {},
  title = 'Please fix the following errors:',
  showCount = true,
  collapsible = true,
  className = '',
  onFieldClick = null
}) => {
  const [isExpanded, setIsExpanded] = React.useState(true);
  
  const errorEntries = Object.entries(errors).filter(([_, error]) => error !== null && error !== undefined);
  const errorCount = errorEntries.length;

  if (errorCount === 0) {
    return null;
  }

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5 mr-3" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-red-800">
              {title}
              {showCount && (
                <span className="ml-2 text-red-600">
                  ({errorCount} {errorCount === 1 ? 'error' : 'errors'})
                </span>
              )}
            </h3>
            {collapsible && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-red-600 hover:text-red-800"
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          {isExpanded && (
            <ul className="list-disc list-inside space-y-1">
              {errorEntries.map(([fieldName, error]) => (
                <li
                  key={fieldName}
                  className={`text-sm text-red-700 ${
                    onFieldClick ? 'cursor-pointer hover:text-red-900 hover:underline' : ''
                  }`}
                  onClick={() => onFieldClick?.(fieldName)}
                >
                  <span className="font-medium capitalize">{fieldName.replace(/([A-Z])/g, ' $1').trim()}:</span>{' '}
                  {error}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ValidationSummary;

