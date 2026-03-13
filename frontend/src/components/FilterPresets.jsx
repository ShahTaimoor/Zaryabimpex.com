/**
 * Filter Presets Component
 * Save and load filter presets
 */

import React, { useState } from 'react';
import { Save, FolderOpen, Trash2, Plus } from 'lucide-react';

export const FilterPresets = ({
  presets = [],
  currentFilters = {},
  onLoadPreset,
  onSavePreset,
  onDeletePreset,
  className = ''
}) => {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState('');

  const handleSave = () => {
    if (!presetName.trim()) return;
    onSavePreset?.(presetName, currentFilters);
    setPresetName('');
    setShowSaveDialog(false);
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Saved Filters</span>
        <button
          onClick={() => setShowSaveDialog(true)}
          className="flex items-center text-sm text-primary-600 hover:text-primary-700"
          disabled={Object.keys(currentFilters).length === 0}
        >
          <Save className="h-4 w-4 mr-1" />
          Save Current
        </button>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="mb-3 p-3 bg-gray-50 rounded border border-gray-200">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') setShowSaveDialog(false);
            }}
            autoFocus
          />
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
            >
              Save
            </button>
            <button
              onClick={() => {
                setShowSaveDialog(false);
                setPresetName('');
              }}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Presets List */}
      {presets.length > 0 ? (
        <div className="space-y-1">
          {presets.map(preset => (
            <div
              key={preset.id}
              className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer group"
              onClick={() => onLoadPreset?.(preset.id)}
            >
              <div className="flex items-center flex-1">
                <FolderOpen className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-700">{preset.name}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePreset?.(preset.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 text-center py-2">
          No saved filters. Save your current filters to create a preset.
        </p>
      )}
    </div>
  );
};

export default FilterPresets;

