import React, { useState, useEffect } from 'react';
import { useTab } from '../contexts/TabContext';
import { useResponsive } from './ResponsiveContainer';

const TabContent = () => {
  const { tabs, activeTabId, isSplitView, leftTabId, rightTabId } = useTab();
  const { isMobile, isTablet } = useResponsive();
  const [loadedComponents, setLoadedComponents] = useState({});
  
  // Determine if split view should be active (only on desktop)
  const shouldShowSplitView = isSplitView && !isMobile && !isTablet && tabs.length >= 2;
  
  // Load components for all tabs to maintain state
  useEffect(() => {
    tabs.forEach(tab => {
      if (tab.component && typeof tab.component === 'function' && !loadedComponents[tab.id]) {
        const componentLoader = tab.component;
        componentLoader().then(Component => {
          // Handle both default and named exports
          const ComponentToUse = Component.default || Component;
          if (ComponentToUse) {
            setLoadedComponents(prev => ({
              ...prev,
              [tab.id]: ComponentToUse
            }));
          }
        }).catch((error) => {
          // Log error for debugging
          console.error(`Failed to load component for tab ${tab.id}:`, error);
          // Component failed to load - error handled silently
        });
      }
    });
  }, [tabs, loadedComponents]);

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tabs open</h3>
          <p className="text-gray-500">Click on a navigation item to open it in a new tab</p>
        </div>
      </div>
    );
  }

  // Render single tab view
  const renderSingleTab = () => {
    return tabs.map(tab => {
      const TabComponent = loadedComponents[tab.id];
      const isActive = tab.id === activeTabId;
      
      if (!TabComponent) {
        return isActive ? (
          <div key={tab.id} className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="text-blue-400 text-6xl mb-4">⏳</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Loading...</h3>
              <p className="text-gray-500">Loading component for this tab</p>
            </div>
          </div>
        ) : null;
      }

      try {
        return (
          <div
            key={tab.id}
            className={`${isActive ? 'block' : 'hidden'} h-full`}
          >
            <TabComponent {...tab.props} />
          </div>
        );
      } catch (error) {
        console.error(`Error rendering component for tab ${tab.id}:`, error);
        return isActive ? (
          <div key={tab.id} className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="text-red-400 text-6xl mb-4">⚠️</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Component</h3>
              <p className="text-gray-500">{error.message || 'An error occurred while loading this component'}</p>
            </div>
          </div>
        ) : null;
      }
    });
  };

  // Render split view
  const renderSplitView = () => {
    const leftTab = tabs.find(tab => tab.id === leftTabId);
    const rightTab = tabs.find(tab => tab.id === rightTabId);
    
    const LeftComponent = leftTab ? loadedComponents[leftTab.id] : null;
    const RightComponent = rightTab ? loadedComponents[rightTab.id] : null;

    return (
      <div className="flex h-full overflow-hidden">
        {/* Left Panel */}
        <div className="flex-1 border-r border-gray-200 overflow-auto">
          {LeftComponent ? (
            <LeftComponent {...leftTab.props} />
          ) : leftTab ? (
            <div className="flex-1 flex items-center justify-center bg-gray-50 h-full">
              <div className="text-center">
                <div className="text-blue-400 text-6xl mb-4">⏳</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Loading...</h3>
                <p className="text-gray-500">Loading {leftTab.title}</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50 h-full">
              <div className="text-center">
                <p className="text-gray-500">No tab selected</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="flex-1 overflow-auto">
          {RightComponent ? (
            <RightComponent {...rightTab.props} />
          ) : rightTab ? (
            <div className="flex-1 flex items-center justify-center bg-gray-50 h-full">
              <div className="text-center">
                <div className="text-blue-400 text-6xl mb-4">⏳</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Loading...</h3>
                <p className="text-gray-500">Loading {rightTab.title}</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50 h-full">
              <div className="text-center">
                <p className="text-gray-500">No tab selected</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {shouldShowSplitView ? renderSplitView() : (
        <div className="flex-1 overflow-auto">
          {renderSingleTab()}
        </div>
      )}
    </div>
  );
};

export default TabContent;
