import React from 'react';
import { X, Plus, Split, Columns } from 'lucide-react';
import { useTab } from '../contexts/TabContext';
import { useResponsive } from './ResponsiveContainer';

const TabBar = () => {
  const { tabs, activeTabId, highlightedTabId, switchToTab, closeTab, closeAllTabs, isSplitView, toggleSplitView, leftTabId, rightTabId, setLeftTab, setRightTab } = useTab();
  const { isMobile, isTablet } = useResponsive();

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm overflow-x-hidden">
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 gap-2 min-w-0">
        {/* Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto flex-1 min-w-0 scrollbar-hide">
          {tabs.map((tab) => {
            const isActive = activeTabId === tab.id;
            const isHighlighted = highlightedTabId === tab.id;
            return (
            <div
              key={tab.id}
              className={`
                flex items-center space-x-2 px-3 py-2 rounded-t-lg cursor-pointer transition-all
                min-w-0 max-w-48
                ${isActive
                  ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }
                ${isHighlighted ? 'ring-2 ring-primary-400 animate-pulse' : ''}
              `}
              onClick={() => switchToTab(tab.id)}
            >
              <span className="truncate text-sm font-medium">
                {tab.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className={`
                  p-1 rounded-full hover:bg-gray-200 transition-colors
                  ${isActive ? 'text-primary-600' : 'text-gray-400'}
                `}
                title="Close tab"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            );
          })}
        </div>

        {/* Tab Actions */}
        <div className="flex items-center space-x-2 ml-4">
          {/* Split View Toggle - Only show on desktop when 2+ tabs */}
          {tabs.length >= 2 && !isMobile && !isTablet && (
            <button
              onClick={toggleSplitView}
              className={`p-2 rounded-lg transition-colors ${
                isSplitView
                  ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              title={isSplitView ? "Disable split view" : "Enable split view (side-by-side)"}
            >
              {isSplitView ? <Columns className="h-4 w-4" /> : <Split className="h-4 w-4" />}
            </button>
          )}
          
          {tabs.length > 1 && (
            <button
              onClick={closeAllTabs}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close all tabs"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {/* Split View Tab Selection */}
        {isSplitView && !isMobile && !isTablet && tabs.length >= 2 && (
          <div className="flex items-center space-x-2 px-4 py-1 bg-gray-50 border-t border-gray-200 text-xs">
            <span className="text-gray-600">Left:</span>
            <select
              value={leftTabId || ''}
              onChange={(e) => setLeftTab(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value="">Select tab...</option>
              {tabs.map(tab => (
                <option key={tab.id} value={tab.id}>
                  {tab.title}
                </option>
              ))}
            </select>
            <span className="text-gray-600 ml-2">Right:</span>
            <select
              value={rightTabId || ''}
              onChange={(e) => setRightTab(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value="">Select tab...</option>
              {tabs.map(tab => (
                <option key={tab.id} value={tab.id}>
                  {tab.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};

export default TabBar;
