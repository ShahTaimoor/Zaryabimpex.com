/**
 * Advanced Filter Builder Component
 * Build complex filters with multiple criteria
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Filter, X, Plus, Save, Calendar, TrendingUp, Package, Tag, CheckSquare } from 'lucide-react';

const FILTER_TYPES = {
  dateRange: {
    label: 'Date Range',
    icon: Calendar,
    fields: ['createdAt', 'updatedAt', 'orderDate', 'deliveryDate']
  },
  priceRange: {
    label: 'Price Range',
    icon: TrendingUp,
    fields: ['pricing.retail', 'pricing.wholesale', 'pricing.cost', 'total']
  },
  stockLevel: {
    label: 'Stock Level',
    icon: Package,
    fields: ['inventory.currentStock', 'inventory.reorderPoint']
  },
  category: {
    label: 'Category',
    icon: Tag,
    fields: ['category']
  },
  status: {
    label: 'Status',
    icon: CheckSquare,
    fields: ['status', 'payment.status', 'orderStatus']
  },
  custom: {
    label: 'Custom Field',
    icon: Filter,
    fields: []
  }
};

const DEFAULT_OPERATOR_BY_TYPE = {
  dateRange: 'between',
  priceRange: 'between',
  stockLevel: 'between',
  category: 'equals',
  status: 'equals',
  custom: 'equals'
};

const getOperators = (type) => {
  switch (type) {
    case 'dateRange':
      return [
        { value: 'between', label: 'Between' },
        { value: 'before', label: 'Before' },
        { value: 'after', label: 'After' },
        { value: 'equals', label: 'On Date' }
      ];
    case 'priceRange':
    case 'stockLevel':
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'greaterThan', label: 'Greater Than' },
        { value: 'lessThan', label: 'Less Than' },
        { value: 'between', label: 'Between' }
      ];
    case 'category':
      return [
        { value: 'equals', label: 'Is' },
        { value: 'notEquals', label: 'Is Not' },
        { value: 'in', label: 'Is One Of' }
      ];
    case 'status':
      return [
        { value: 'equals', label: 'Is' },
        { value: 'notEquals', label: 'Is Not' },
        { value: 'in', label: 'Is One Of' }
      ];
    default:
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'contains', label: 'Contains' },
        { value: 'startsWith', label: 'Starts With' },
        { value: 'endsWith', label: 'Ends With' }
      ];
  }
};

const getEmptyValueFor = (type, operator) => {
  if (operator === 'between') {
    return type === 'dateRange'
      ? { from: '', to: '' }
      : { min: '', max: '' };
  }
  return '';
};

const buildNewFilterState = (type, availableFields) => {
  const filteredFields = (FILTER_TYPES[type]?.fields?.length
    ? availableFields.filter((f) => FILTER_TYPES[type].fields.includes(f.value))
    : availableFields);

  const field = filteredFields[0]?.value || '';
  const operator = DEFAULT_OPERATOR_BY_TYPE[type] || 'equals';

  return {
    type,
    field,
    operator,
    value: getEmptyValueFor(type, operator)
  };
};

export const AdvancedFilterBuilder = ({
  filters = [],
  onFiltersChange,
  availableFields = [],
  categories = [],
  statusOptions = [],
  className = ''
}) => {
  const [localFilters, setLocalFilters] = useState(filters);
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [newFilter, setNewFilter] = useState(() => buildNewFilterState('status', availableFields));

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  useEffect(() => {
    // keep newFilter field in sync when available fields change
    if (!newFilter.field) {
      setNewFilter((prev) => ({
        ...prev,
        ...buildNewFilterState(prev.type, availableFields)
      }));
    }
  }, [availableFields, newFilter.field, newFilter.type]);

  const filteredNewFields = useMemo(() => {
    const filterType = FILTER_TYPES[newFilter.type];
    if (!filterType?.fields?.length) return availableFields;
    return availableFields.filter((field) => filterType.fields.includes(field.value));
  }, [availableFields, newFilter.type]);

  const handleAddFilter = () => {
    if (!newFilter.field) return;

    const filter = {
      id: Date.now().toString(),
      ...newFilter
    };

    const updated = [...localFilters, filter];
    setLocalFilters(updated);
    onFiltersChange?.(updated);

    setNewFilter(buildNewFilterState(newFilter.type, availableFields));
    setShowAddFilter(false);
  };

  const handleRemoveFilter = (filterId) => {
    const updated = localFilters.filter((f) => f.id !== filterId);
    setLocalFilters(updated);
    onFiltersChange?.(updated);
  };

  const handleFilterChange = (filterId, updates) => {
    const updated = localFilters.map((f) =>
      f.id === filterId ? { ...f, ...updates } : f
    );
    setLocalFilters(updated);
    onFiltersChange?.(updated);
  };

  const handleNewFilterTypeChange = (type) => {
    setNewFilter(buildNewFilterState(type, availableFields));
  };

  const handleNewFilterOperatorChange = (operator) => {
    setNewFilter((prev) => ({
      ...prev,
      operator,
      value: getEmptyValueFor(prev.type, operator)
    }));
  };

  const renderFilterInput = (filter, isNew = false) => {
    const { type, operator, value } = filter;
    const changeHandler = isNew
      ? (updates) => setNewFilter((prev) => ({ ...prev, ...updates }))
      : (updates) => handleFilterChange(filter.id, updates);

    switch (type) {
      case 'dateRange':
        if (operator === 'between') {
          return (
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={value?.from || ''}
                onChange={(e) => changeHandler({ value: { ...value, from: e.target.value } })}
                className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={value?.to || ''}
                onChange={(e) => changeHandler({ value: { ...value, to: e.target.value } })}
                className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
              />
            </div>
          );
        }
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => changeHandler({ value: e.target.value })}
            className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
          />
        );

      case 'priceRange':
      case 'stockLevel':
        if (operator === 'between') {
          return (
            <div className="flex items-center space-x-2">
              <input
                type="number"
                placeholder="Min"
                value={value?.min || ''}
                onChange={(e) => changeHandler({ value: { ...value, min: e.target.value } })}
                className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                placeholder="Max"
                value={value?.max || ''}
                onChange={(e) => changeHandler({ value: { ...value, max: e.target.value } })}
                className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
              />
            </div>
          );
        }
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => changeHandler({ value: e.target.value })}
            className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
            placeholder="Enter value"
          />
        );

      case 'category':
        if (operator === 'in') {
          return (
            <select
              multiple
              value={Array.isArray(value) ? value : []}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                changeHandler({ value: selected });
              }}
              className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
              size={3}
            >
              {categories.map((cat) => (
                <option key={cat._id || cat.id} value={cat._id || cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          );
        }
        return (
          <select
            value={value || ''}
            onChange={(e) => changeHandler({ value: e.target.value })}
            className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat._id || cat.id} value={cat._id || cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        );

      case 'status':
        if (operator === 'in') {
          return (
            <select
              multiple
              value={Array.isArray(value) ? value : []}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                changeHandler({ value: selected });
              }}
              className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
              size={3}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          );
        }
        return (
          <select
            value={value || ''}
            onChange={(e) => changeHandler({ value: e.target.value })}
            className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="">Select status</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => changeHandler({ value: e.target.value })}
            className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
            placeholder="Enter value"
          />
        );
    }
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Filter className="h-5 w-5 text-gray-600 mr-2" />
          <h3 className="text-sm font-medium text-gray-900">Advanced Filters</h3>
        </div>
        {localFilters.length > 0 && (
          <button
            onClick={() => {
              setLocalFilters([]);
              onFiltersChange?.([]);
            }}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Active Filters */}
      {localFilters.length > 0 && (
        <div className="space-y-2 mb-4">
          {localFilters.map((filter) => {
            const filterType = FILTER_TYPES[filter.type] || FILTER_TYPES.custom;
            const Icon = filterType.icon;
            const fieldLabel =
              availableFields.find((f) => f.value === filter.field)?.label || filter.field;

            return (
              <div
                key={filter.id}
                className="flex items-center space-x-2 p-2 bg-gray-50 rounded border border-gray-200"
              >
                <Icon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 flex-shrink-0">{fieldLabel}</span>
                <select
                  value={filter.operator}
                  onChange={(e) => handleFilterChange(filter.id, {
                    operator: e.target.value,
                    value: getEmptyValueFor(filter.type, e.target.value)
                  })}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  {getOperators(filter.type).map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
                <div className="flex-1">{renderFilterInput(filter)}</div>
                <button
                  onClick={() => handleRemoveFilter(filter.id)}
                  className="text-gray-400 hover:text-red-600 flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Filter */}
      {showAddFilter ? (
        <div className="border border-gray-200 rounded p-3 bg-gray-50">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newFilter.type}
                onChange={(e) => handleNewFilterTypeChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {Object.entries(FILTER_TYPES).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>

              <select
                value={newFilter.field}
                onChange={(e) => setNewFilter({ ...newFilter, field: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">Select field</option>
                {filteredNewFields.map((field) => (
                  <option key={field.value} value={field.value}>
                    {field.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={newFilter.operator}
                onChange={(e) => handleNewFilterOperatorChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {getOperators(newFilter.type).map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>

              {newFilter.field && (
                <>
                  {renderFilterInput(newFilter, true)}
                  <button
                    onClick={handleAddFilter}
                    className="px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowAddFilter(false)}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddFilter(true)}
          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Filter
        </button>
      )}
    </div>
  );
};

export default AdvancedFilterBuilder;

