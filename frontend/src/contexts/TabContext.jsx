import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const TabContext = createContext();

export const useTab = () => {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTab must be used within a TabProvider');
  }
  return context;
};

export const TabProvider = ({ children }) => {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [isSplitView, setIsSplitView] = useState(false);
  const [leftTabId, setLeftTabId] = useState(null);
  const [rightTabId, setRightTabId] = useState(null);
  const [highlightedTabId, setHighlightedTabId] = useState(null);
  const highlightTimeoutRef = useRef(null);

  // Generate unique tab ID
  const generateTabId = useCallback(() => {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const triggerTabHighlight = useCallback((tabId) => {
    if (!tabId) return;
    setHighlightedTabId(tabId);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedTabId(null);
      highlightTimeoutRef.current = null;
    }, 1200);
  }, []);

  // Open a new tab
  const openTab = useCallback((tabData) => {
    const tabId = generateTabId();
    const newTab = {
      id: tabId,
      title: tabData.title,
      path: tabData.path,
      component: tabData.component,
      props: tabData.props || {},
      createdAt: new Date(),
      allowMultiple: tabData.allowMultiple || false,
      ...tabData
    };

    setTabs(prevTabs => {
      // If allowMultiple is false, check if tab with same path already exists
      if (!tabData.allowMultiple) {
        const existingTab = prevTabs.find(tab => tab.path === tabData.path);
        if (existingTab) {
          setActiveTabId(existingTab.id);
          triggerTabHighlight(existingTab.id);
          return prevTabs;
        }
      }
      
      return [...prevTabs, newTab];
    });
    
    setActiveTabId(tabId);
    return tabId;
  }, [generateTabId, triggerTabHighlight]);

  // Close a tab (internal function)
  const closeTabInternal = useCallback((tabId) => {
    setTabs(prevTabs => {
      const newTabs = prevTabs.filter(tab => tab.id !== tabId);
      
      // If closing active tab, switch to another tab
      if (activeTabId === tabId) {
        if (newTabs.length > 0) {
          // Switch to the tab that was opened before the closed one, or the first available tab
          const closedTabIndex = prevTabs.findIndex(tab => tab.id === tabId);
          const newActiveIndex = closedTabIndex > 0 ? closedTabIndex - 1 : 0;
          setActiveTabId(newTabs[newActiveIndex]?.id || null);
        } else {
          setActiveTabId(null);
        }
      }
      
      return newTabs;
    });
  }, [activeTabId]);

  // Close tab handler - also handle split view tabs
  const closeTab = useCallback((tabId) => {
    if (leftTabId === tabId) {
      setLeftTabId(null);
      if (!rightTabId) {
        setIsSplitView(false);
      }
    }
    if (rightTabId === tabId) {
      setRightTabId(null);
      if (!leftTabId) {
        setIsSplitView(false);
      }
    }
    closeTabInternal(tabId);
  }, [leftTabId, rightTabId, closeTabInternal]);

  // Switch to a tab
  const switchToTab = useCallback((tabId) => {
    setActiveTabId(tabId);
  }, []);

  // Close all tabs
  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
  }, []);

  // Get active tab
  const getActiveTab = useCallback(() => {
    return tabs.find(tab => tab.id === activeTabId);
  }, [tabs, activeTabId]);

  // Update tab title
  const updateTabTitle = useCallback((tabId, newTitle) => {
    setTabs(prevTabs => 
      prevTabs.map(tab => 
        tab.id === tabId ? { ...tab, title: newTitle } : tab
      )
    );
  }, []);

  // Update tab props (for passing data to components)
  const updateTabProps = useCallback((tabId, newProps) => {
    setTabs(prevTabs => 
      prevTabs.map(tab => 
        tab.id === tabId ? { ...tab, props: { ...tab.props, ...newProps } } : tab
      )
    );
  }, []);

  // Toggle split view
  const toggleSplitView = useCallback(() => {
    setIsSplitView(prev => {
      const newValue = !prev;
      if (newValue && tabs.length >= 2) {
        // When enabling split view, set left and right tabs
        if (!leftTabId || !rightTabId) {
          // If no tabs are set, use active tab and next available tab
          const activeIndex = tabs.findIndex(tab => tab.id === activeTabId);
          const leftTab = tabs[activeIndex] || tabs[0];
          const rightTab = tabs[activeIndex + 1] || tabs[activeIndex === 0 ? 1 : 0] || tabs[0];
          setLeftTabId(leftTab?.id || null);
          setRightTabId(rightTab?.id || null);
        }
      } else if (!newValue) {
        // When disabling split view, switch to active tab
        setLeftTabId(null);
        setRightTabId(null);
      }
      return newValue;
    });
  }, [tabs, activeTabId, leftTabId, rightTabId]);

  // Set left tab for split view
  const setLeftTab = useCallback((tabId) => {
    setLeftTabId(tabId);
    if (!isSplitView) {
      setIsSplitView(true);
    }
  }, [isSplitView]);

  // Set right tab for split view
  const setRightTab = useCallback((tabId) => {
    setRightTabId(tabId);
    if (!isSplitView) {
      setIsSplitView(true);
    }
  }, [isSplitView]);

  const value = {
    tabs,
    activeTabId,
    highlightedTabId,
    openTab,
    closeTab,
    switchToTab,
    closeAllTabs,
    getActiveTab,
    updateTabTitle,
    updateTabProps,
    isSplitView,
    toggleSplitView,
    leftTabId,
    rightTabId,
    setLeftTab,
    setRightTab,
    triggerTabHighlight
  };

  return (
    <TabContext.Provider value={value}>
      {children}
    </TabContext.Provider>
  );
};
