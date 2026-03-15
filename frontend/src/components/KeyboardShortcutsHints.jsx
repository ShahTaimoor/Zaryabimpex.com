/**
 * Keyboard Shortcuts Hints Component
 * Displays available keyboard shortcuts
 */

import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { useKeyboardShortcutsContext } from '../contexts/KeyboardShortcutsContext';

export const KeyboardShortcutsHints = () => {
  const { shortcuts, showHints, setShowHints, formatKeyDisplay } = useKeyboardShortcutsContext();

  if (!showHints) return null;

  // Group shortcuts by category
  const groupedShortcuts = Object.entries(shortcuts).reduce((acc, [id, shortcut]) => {
    const category = shortcut.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({ id, ...shortcut });
    return acc;
  }, {});

  const categoryLabels = {
    navigation: 'Navigation',
    actions: 'Actions',
    other: 'Other'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        onClick={() => setShowHints(false)}
      />

      {/* Modal */}
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Keyboard className="h-6 w-6 text-gray-600 mr-2" />
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Keyboard Shortcuts
                </h3>
              </div>
              <button
                onClick={() => setShowHints(false)}
                className="text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Press <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Ctrl+?</kbd> or <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Cmd+?</kbd> to toggle this help
            </p>
          </div>

          {/* Content */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 max-h-96 overflow-y-auto">
            {Object.entries(groupedShortcuts).map(([category, items]) => (
              <div key={category} className="mb-6 last:mb-0">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  {categoryLabels[category] || category}
                </h4>
                <div className="space-y-2">
                  {items.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded"
                    >
                      <span className="text-sm text-gray-700">{shortcut.description}</span>
                      <div className="flex items-center space-x-1">
                        {shortcut.keys.map((key, index) => (
                          <React.Fragment key={index}>
                            <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
                              {formatKeyDisplay(key)}
                            </kbd>
                            {index < shortcut.keys.length - 1 && (
                              <span className="text-gray-400 text-xs">or</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200">
            <button
              onClick={() => setShowHints(false)}
              className="btn btn-primary btn-md w-full sm:w-auto"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsHints;

