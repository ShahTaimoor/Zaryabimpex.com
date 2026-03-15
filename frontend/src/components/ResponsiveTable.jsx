import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react';
import { useResponsive } from './ResponsiveContainer';

const ResponsiveTable = ({
  data = [],
  columns = [],
  onRowClick,
  onEdit,
  onDelete,
  onView,
  actions = true,
  searchable = true,
  sortable = true,
  className = '',
  mobileCardComponent,
  emptyMessage = 'No data available'
}) => {
  const [sortField, setSortField] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const { isMobile, isTablet } = useResponsive();

  // Filter data based on search term
  const filteredData = data.filter(item => {
    if (!searchTerm) return true;
    
    return columns.some(column => {
      const value = column.accessor ? 
        (typeof column.accessor === 'function' ? 
          column.accessor(item) : 
          item[column.accessor]
        ) : '';
      
      return String(value).toLowerCase().includes(searchTerm.toLowerCase());
    });
  });

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortField) return 0;

    const aValue = columns.find(col => col.key === sortField)?.accessor ? 
      (typeof columns.find(col => col.key === sortField).accessor === 'function' ? 
        columns.find(col => col.key === sortField).accessor(a) : 
        a[columns.find(col => col.key === sortField).accessor]
      ) : '';
    
    const bValue = columns.find(col => col.key === sortField)?.accessor ? 
      (typeof columns.find(col => col.key === sortField).accessor === 'function' ? 
        columns.find(col => col.key === sortField).accessor(b) : 
        b[columns.find(col => col.key === sortField).accessor]
      ) : '';

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    if (!sortable) return;
    
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleRowExpansion = (index) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  // Mobile card component
  const MobileCard = ({ item, index }) => {
    if (mobileCardComponent) {
      return mobileCardComponent({ item, index });
    }

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        {/* Main content */}
        <div className="space-y-2">
          {columns.slice(0, 3).map((column, colIndex) => {
            const value = column.accessor ? 
              (typeof column.accessor === 'function' ? 
                column.accessor(item) : 
                item[column.accessor]
              ) : '';
            
            return (
              <div key={colIndex} className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">
                  {column.header}:
                </span>
                <span className="text-sm text-gray-900">
                  {column.render ? column.render(value, item) : value}
                </span>
              </div>
            );
          })}
        </div>

        {/* Expandable content */}
        {columns.length > 3 && (
          <div className="mt-3">
            <button
              onClick={() => toggleRowExpansion(index)}
              className="flex items-center text-sm text-primary-600 hover:text-primary-700"
            >
              {expandedRows.has(index) ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show More
                </>
              )}
            </button>

            {expandedRows.has(index) && (
              <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
                {columns.slice(3).map((column, colIndex) => {
                  const value = column.accessor ? 
                    (typeof column.accessor === 'function' ? 
                      column.accessor(item) : 
                      item[column.accessor]
                    ) : '';
                  
                  return (
                    <div key={colIndex} className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500">
                        {column.header}:
                      </span>
                      <span className="text-sm text-gray-900">
                        {column.render ? column.render(value, item) : value}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {actions && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end space-x-2">
            {onView && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onView(item);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Eye className="h-4 w-4" />
              </button>
            )}
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(item);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Edit className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item);
                }}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Desktop table component
  const DesktopTable = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                  sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                }`}
                onClick={() => sortable && handleSort(column.key)}
              >
                <div className="flex items-center space-x-1">
                  <span>{column.header}</span>
                  {sortable && sortField === column.key && (
                    sortDirection === 'asc' ? 
                      <ChevronUp className="h-4 w-4" /> : 
                      <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </th>
            ))}
            {actions && (
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedData.map((item, index) => (
            <tr
              key={index}
              className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={() => onRowClick && onRowClick(item)}
            >
              {columns.map((column) => {
                const value = column.accessor ? 
                  (typeof column.accessor === 'function' ? 
                    column.accessor(item) : 
                    item[column.accessor]
                  ) : '';
                
                return (
                  <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {column.render ? column.render(value, item) : value}
                  </td>
                );
              })}
              {actions && (
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    {onView && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onView(item);
                        }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    {onEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(item);
                        }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item);
                        }}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`bg-white ${className}`}>
      {/* Search */}
      {searchable && (
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      )}

      {/* Table/Cards */}
      <div className="p-4">
        {isMobile ? (
          <div className="space-y-4">
            {sortedData.map((item, index) => (
              <MobileCard key={index} item={item} index={index} />
            ))}
          </div>
        ) : (
          <DesktopTable />
        )}
      </div>
    </div>
  );
};

export default ResponsiveTable;
