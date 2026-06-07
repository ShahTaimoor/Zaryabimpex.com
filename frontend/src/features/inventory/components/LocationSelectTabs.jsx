import React from 'react';
import { Store, Warehouse } from 'lucide-react';
import { getLocationId } from '../utils/inventoryHelpers';

export default function LocationSelectTabs({
  locations = [],
  selectedId,
  onSelect,
  locationType = 'warehouse',
}) {
  const Icon = locationType === 'shop' ? Store : Warehouse;

  return (
    <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-3">
      {locations.map((location) => {
        const id = getLocationId(location);
        const isSelected = id === selectedId;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              isSelected
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{location.name}</span>
            {location.code ? (
              <span className={`text-xs ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                ({location.code})
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
