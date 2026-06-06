import React, { useState, useEffect, useRef, memo } from 'react';
import { ChevronDown } from 'lucide-react';
import { SETTINGS_VISIBLE_TAB_COUNT } from './settingsTabs';

export const SettingsTabBar = memo(function SettingsTabBar({ tabs, activeTab, onTabChange }) {
  const visibleTabs = tabs.slice(0, SETTINGS_VISIBLE_TAB_COUNT);
  const overflowTabs = tabs.slice(SETTINGS_VISIBLE_TAB_COUNT);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const handleClickOutside = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreOpen]);

  return (
    <div className="border-b border-gray-200 -mx-4 px-4 md:mx-0 md:px-0 w-full">
      <div className="md:hidden pb-3">
        <label htmlFor="settings-tab-select" className="sr-only">Select settings tab</label>
        <select
          id="settings-tab-select"
          value={activeTab}
          onChange={(e) => onTabChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.name}
            </option>
          ))}
        </select>
      </div>
      <nav className="-mb-px hidden md:flex space-x-4 md:space-x-8 w-full items-center">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`py-2 px-2 md:px-1 border-b-2 font-medium text-sm flex items-center space-x-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">{tab.name}</span>
              <span className="sm:hidden">{tab.shortName}</span>
            </button>
          );
        })}
        {overflowTabs.length > 0 && (
          <div className="relative flex-shrink-0" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={`py-2 px-2 md:px-1 border-b-2 font-medium text-sm flex items-center space-x-1 whitespace-nowrap ${
                overflowTabs.some((t) => t.id === activeTab)
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>More</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
            {moreOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {overflowTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        onTabChange(tab.id);
                        setMoreOpen(false);
                      }}
                      className={`w-full flex items-center space-x-2 px-4 py-2 text-sm ${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span>{tab.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>
    </div>
  );
});

export default SettingsTabBar;
