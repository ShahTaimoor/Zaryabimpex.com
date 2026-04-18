import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, ChevronDown, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';

const EMPTY_ARRAY = [];

const DEFAULT_INITIAL_LIMIT = 20;
/** Initial estimate before measure; customer rows can be multi-line (name + balance). */
const DROPDOWN_ROW_ESTIMATE = 72;

/** Stable id for list deduping when valueKey may not match (e.g. id vs _id). */
const getItemId = (item, valueKey) => {
  if (!item || typeof item !== 'object') return null;
  const v = item[valueKey];
  if (v != null && v !== '') return v;
  if (item.id != null && item.id !== '') return item.id;
  if (item._id != null && item._id !== '') return item._id;
  return null;
};

export const SearchableDropdown = forwardRef(({
  placeholder = "Search...",
  items = EMPTY_ARRAY,
  onSelect,
  onSearch,
  onKeyDown,
  displayKey = "name",
  valueKey = "_id",
  selectedItem = null,
  loading = false,
  emptyMessage = "No items found",
  className = "",
  disabled = false,
  showSelected = true,
  value = null,
  openOnFocus = false,
  rightContentKey = null, // Function or key to get right-side content (e.g., city)
  /** Max rows when not searching; type to see full filtered list. Set null to show all (legacy). */
  maxInitialItems = DEFAULT_INITIAL_LIMIT
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [filteredItems, setFilteredItems] = useState(items);

  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const listScrollRef = useRef(null);
  const itemRefs = useRef([]);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const rowVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => DROPDOWN_ROW_ESTIMATE,
    overscan: 8,
  });

  const valueToDisplayString = (value) => {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return `${value}`;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';

    if (Array.isArray(value)) {
      const firstNonNull = value.find((item) => item != null);
      return valueToDisplayString(firstNonNull);
    }

    if (typeof value === 'object') {
      if (React.isValidElement(value)) {
        return '';
      }

      const candidateFields = [
        'businessName',
        'business_name',
        'label',
        'name',
        'displayName',
        'display_name',
        'companyName',
        'company_name',
        'accountName',
        'bankName',
        'type',
        'title',
        'code',
        'id',
        '_id'
      ];

      for (const field of candidateFields) {
        if (field in value) {
          const result = valueToDisplayString(value[field]);
          if (result) {
            return result;
          }
        }
      }
    }

    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  };

  const getItemLabel = (item) => {
    if (!item) return '';
    if (typeof displayKey === 'function') {
      const result = displayKey(item);
      if (React.isValidElement(result)) {
        const alternateFields = [
          item.businessName,
          item.business_name,
          item.displayName,
          item.display_name,
          item.name,
          item.companyName,
          item.company_name,
          item.accountName,
          item.bankName,
          item.code,
          item.id,
          item._id
        ].find((field) => field != null && String(field).trim().length > 0);
        return alternateFields || 'Selected item';
      }
      return valueToDisplayString(result);
    }
    return valueToDisplayString(item[displayKey]);
  };

  // Sync internal searchTerm with controlled value
  useEffect(() => {
    if (value !== null) {
      setSearchTerm(value);
      // Close dropdown when value is cleared
      if (value === '') {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    }
  }, [value]);

  // Store displayKey in a ref to avoid unnecessary re-renders when it's a function
  const displayKeyRef = useRef(displayKey);
  useEffect(() => {
    displayKeyRef.current = displayKey;
  }, [displayKey]);

  // Filter items based on search term; cap visible rows when not searching (see maxInitialItems)
  useEffect(() => {
    const rawTerm = value !== null ? value : searchTerm;
    const currentSearchTerm = typeof rawTerm === 'string' ? rawTerm.trim() : '';
    const currentDisplayKey = displayKeyRef.current;

    if (currentSearchTerm) {
      const filtered = items.filter(item => {
        // If displayKey is a function, try to filter by common searchable fields
        if (typeof currentDisplayKey === 'function') {
          const searchableFields = [
            item.businessName,
            item.business_name,
            item.displayName,
            item.display_name,
            item.name,
            item.companyName,
            item.company_name,
            item.email,
            item.phone,
            item.sku,
            item.barcode,
            item.retail_code,
            item.retailCode
          ].filter(Boolean); // Remove null/undefined values

          return searchableFields.some(field =>
            String(field).toLowerCase().includes(currentSearchTerm.toLowerCase())
          );
        }

        // If displayKey is a string, filter normally
        const displayValue = valueToDisplayString(item[currentDisplayKey]);
        if (!displayValue) {
          return false;
        }
        return displayValue.toLowerCase().includes(currentSearchTerm.toLowerCase());
      });
      setFilteredItems(filtered);
      setSelectedIndex(-1);
      return;
    }

    // No search text: show at most maxInitialItems, but always include selectedItem if it exists
    if (maxInitialItems == null || maxInitialItems === false || maxInitialItems <= 0) {
      setFilteredItems(items);
      setSelectedIndex(-1);
      return;
    }

    if (items.length <= maxInitialItems) {
      setFilteredItems(items);
      setSelectedIndex(-1);
      return;
    }

    const seen = new Set();
    const out = [];
    const selId = getItemId(selectedItem, valueKey);
    if (selectedItem && selId != null) {
      out.push(selectedItem);
      seen.add(selId);
    }
    for (let i = 0; i < items.length && out.length < maxInitialItems; i++) {
      const item = items[i];
      const id = getItemId(item, valueKey);
      if (id != null && seen.has(id)) continue;
      if (id != null) seen.add(id);
      out.push(item);
    }
    setFilteredItems(out);
    setSelectedIndex(-1);
  }, [value, searchTerm, items, selectedItem, valueKey, maxInitialItems]); // displayKey via ref

  // Handle search
  const handleSearch = (term) => {
    // Always call onSearch to update parent state
    if (onSearch) {
      onSearch(term);
    }
    // Only update internal state if not controlled
    if (value === null) {
      setSearchTerm(term);
    }
    // Open dropdown when user starts typing
    if (term && !isOpen) {
      setIsOpen(true);
    }
  };

  // Handle item selection
  const handleSelect = (item) => {
    onSelect(item);
    // Only clear search term if showSelected is false
    if (!showSelected) {
      setSearchTerm('');
    }
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    // Call external onKeyDown handler first
    if (onKeyDown) {
      onKeyDown(e);
    }

    // If external handler prevented default, don't process further
    if (e.defaultPrevented) {
      return;
    }

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
        setSelectedIndex(0);
        return;
      }
      if (e.key === 'Tab' && searchTerm && filteredItems.length > 0) {
        // Auto-select the first matching item when Tab is pressed
        handleSelect(filteredItems[0]);
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredItems.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : filteredItems.length - 1
        );
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredItems.length) {
          handleSelect(filteredItems[selectedIndex]);
        }
        break;

      case 'Tab':
        if (selectedIndex >= 0 && selectedIndex < filteredItems.length) {
          handleSelect(filteredItems[selectedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        setSearchTerm('');
        inputRef.current?.blur();
        break;
    }
  };

  // Keep keyboard-selected row visible (virtual list)
  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < filteredItems.length) {
      rowVirtualizer.scrollToIndex(selectedIndex, { align: 'auto' });
    }
  }, [selectedIndex, filteredItems.length, rowVirtualizer]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      const target = event.target;
      const isClickInDropdown = dropdownRef.current?.contains(target);
      const isClickInInput = inputRef.current?.contains(target);

      if (!isClickInDropdown && !isClickInInput) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Calculate dropdown position when it opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const updatePosition = () => {
        if (inputRef.current) {
          const rect = inputRef.current.getBoundingClientRect();
          setDropdownPosition({
            top: rect.bottom + 4, // 4px margin (mt-1 equivalent) - using viewport coordinates for fixed positioning
            left: rect.left,
            width: rect.width
          });
        }
      };

      updatePosition();

      // Update position on scroll or resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  const getDisplayValue = (item) => {
    if (!item) return '';
    if (typeof displayKey === 'function') {
      const result = displayKey(item);
      if (React.isValidElement(result)) {
        return result;
      }
      return valueToDisplayString(result) || '';
    }
    const rawValue = item[displayKey];
    if (React.isValidElement(rawValue)) {
      return rawValue;
    }
    return valueToDisplayString(rawValue) || '';
  };

  // Get right-side content (e.g., city for customers)
  const getRightContent = (item) => {
    if (!item || !rightContentKey) return null;

    if (typeof rightContentKey === 'function') {
      return rightContentKey(item);
    }

    // If rightContentKey is a string, try to get the value
    if (typeof rightContentKey === 'string') {
      // Special handling for customer city
      if (rightContentKey === 'city' && item.addresses && Array.isArray(item.addresses)) {
        const defaultAddress = item.addresses.find(addr => addr.isDefault) || item.addresses[0];
        return defaultAddress?.city || '';
      }
      return valueToDisplayString(item[rightContentKey]) || '';
    }

    return null;
  };

  const getInputValue = () => {
    // If a controlled value is provided, use it (including empty string)
    if (value !== null) {
      return value;
    }

    if (isOpen) {
      return searchTerm;
    }
    if (showSelected && selectedItem) {
      return getItemLabel(selectedItem);
    }
    return '';
  };

  // Extract padding classes from className prop
  const hasCustomPadding = className.includes('pr-');

  const handleInputClick = () => {
    // Open dropdown when clicking on input (if there are items or a search term)
    if (items.length > 0 || searchTerm || value) {
      setIsOpen(true);
    }
  };

  const handleChevronClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div className={`relative ${className.replace(/pr-\d+/g, '').trim()}`} ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
        <Input
          ref={(node) => {
            inputRef.current = node;
            if (ref) {
              if (typeof ref === 'function') {
                ref(node);
              } else {
                ref.current = node;
              }
            }
          }}
          type="text"
          placeholder={placeholder}
          autoComplete="off"
          value={getInputValue()}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          onClick={handleInputClick}
          onFocus={() => {
            // Only open on focus if openOnFocus prop is explicitly set to true
            if (openOnFocus) {
              setIsOpen(true);
            }
          }}
          disabled={disabled}
          className={`pl-10 ${hasCustomPadding ? className.match(/pr-\d+/)?.[0] || 'pr-10' : 'pr-10'} w-full`}
        />
        <ChevronDown
          onClick={handleChevronClick}
          className={`absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 transition-transform z-10 cursor-pointer ${isOpen ? 'rotate-180' : ''
            }`}
        />
      </div>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] max-h-96 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`
          }}
        >
          {loading ? (
            <div className="p-3 text-center text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-sm">Loading...</p>
            </div>
          ) : filteredItems.length > 0 ? (
            <div
              ref={listScrollRef}
              className="max-h-96 overflow-y-auto py-1"
            >
              <div
                className="relative w-full"
                style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const index = virtualRow.index;
                  const item = filteredItems[index];
                  const isSelected = selectedIndex === index;
                  const isItemSelected =
                    selectedItem && getItemId(selectedItem, valueKey) === getItemId(item, valueKey);

                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={(node) => {
                        rowVirtualizer.measureElement(node);
                        itemRefs.current[index] = node;
                      }}
                      className="absolute left-0 top-0 w-full"
                      style={{
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(item)}
                        className={`flex min-h-[44px] w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none ${isSelected ? 'bg-primary-50 text-primary-700' : 'text-gray-900'
                          }`}
                      >
                        <span className="min-w-0 flex-1">{getDisplayValue(item)}</span>
                        <span className="flex shrink-0 items-start gap-2 pt-0.5">
                          {getRightContent(item) && (
                            <span className="text-xs text-gray-500">{getRightContent(item)}</span>
                          )}
                          {isItemSelected && (
                            <Check className="h-4 w-4 shrink-0 text-primary-600" />
                          )}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-3 text-center text-gray-500 text-sm">
              {emptyMessage}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
});

SearchableDropdown.displayName = 'SearchableDropdown';
