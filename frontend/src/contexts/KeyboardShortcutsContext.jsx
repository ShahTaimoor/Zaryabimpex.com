/**
 * Keyboard Shortcuts Context
 * Provides global keyboard shortcuts management
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useKeyboardShortcuts, detectConflicts, DEFAULT_SHORTCUTS } from '../hooks/useKeyboardShortcuts';
import toast from 'react-hot-toast';

const KeyboardShortcutsContext = createContext();

export const useKeyboardShortcutsContext = () => {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcutsContext must be used within KeyboardShortcutsProvider');
  }
  return context;
};

export const KeyboardShortcutsProvider = ({ children, customShortcuts = {} }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Load user preferences from localStorage
  const loadUserShortcuts = useCallback(() => {
    try {
      const saved = localStorage.getItem('keyboardShortcuts');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      // Error loading keyboard shortcuts - silent fail
      return {};
    }
  }, []);

  const [userShortcuts, setUserShortcuts] = useState(loadUserShortcuts);
  const [showHints, setShowHints] = useState(false);
  const [modalStack, setModalStack] = useState([]);

  // Merge default shortcuts with user preferences and custom shortcuts
  const baseShortcuts = useMemo(() => {
    return { ...DEFAULT_SHORTCUTS, ...userShortcuts, ...customShortcuts };
  }, [userShortcuts, customShortcuts]);

  // Register modal for Escape key handling
  const registerModal = useCallback((modalId, onClose) => {
    setModalStack(prev => [...prev, { id: modalId, onClose }]);
  }, []);

  const unregisterModal = useCallback((modalId) => {
    setModalStack(prev => prev.filter(m => m.id !== modalId));
  }, []);

  // Get topmost modal
  const getTopModal = useCallback(() => {
    return modalStack[modalStack.length - 1];
  }, [modalStack]);

  // Shortcut handlers
  const handleQuickSearch = useCallback((event) => {
    // Find search input on current page
    const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search" i], input[placeholder*="search" i]');
    if (searchInput) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    } else {
      toast('No search field found on this page', { icon: '🔍' });
    }
  }, []);

  const handleNewOrder = useCallback(() => {
    if (location.pathname === '/sales') {
      // Trigger new order in sales page - look for buttons with "New" text
      const buttons = Array.from(document.querySelectorAll('button'));
      const newOrderBtn = buttons.find(btn => 
        btn.textContent.toLowerCase().includes('new') && 
        (btn.textContent.toLowerCase().includes('order') || btn.textContent.toLowerCase().includes('sale'))
      );
      if (newOrderBtn) {
        newOrderBtn.click();
      }
    } else {
      navigate('/sales');
    }
  }, [navigate, location]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleSave = useCallback((event) => {
    // Find save button in current form
    const submitButton = document.querySelector('button[type="submit"]');
    if (submitButton && !submitButton.disabled) {
      event.preventDefault();
      submitButton.click();
      return;
    }
    
    // Fallback: look for buttons with Save/Create/Update text
    const buttons = Array.from(document.querySelectorAll('button'));
    const saveButton = buttons.find(btn => {
      const text = btn.textContent.toLowerCase();
      return (text.includes('save') || text.includes('create') || text.includes('update')) && !btn.disabled;
    });
    if (saveButton) {
      event.preventDefault();
      saveButton.click();
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    const topModal = getTopModal();
    if (topModal) {
      topModal.onClose();
    } else {
      // Try to close any open modal - look for close buttons
      const closeButtons = Array.from(document.querySelectorAll('button[aria-label="Close"], button[aria-label*="close" i]'));
      if (closeButtons.length > 0) {
        closeButtons[closeButtons.length - 1].click();
      } else {
        // Look for X icon buttons
        const xButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
          const svg = btn.querySelector('svg');
          return svg && (svg.classList.contains('x') || btn.textContent.trim() === '×' || btn.textContent.trim() === '✕');
        });
        if (xButtons.length > 0) {
          xButtons[xButtons.length - 1].click();
        }
      }
    }
  }, [getTopModal]);

  const handleHelp = useCallback(() => {
    navigate('/help');
  }, [navigate]);

  const handleFocusSearch = useCallback(() => {
    handleQuickSearch();
  }, [handleQuickSearch]);

  const handleNewProduct = useCallback(() => {
    if (location.pathname === '/products') {
      const buttons = Array.from(document.querySelectorAll('button'));
      const newProductBtn = buttons.find(btn => {
        const text = btn.textContent.toLowerCase();
        return (text.includes('new product') || text.includes('add product') || text.includes('create product'));
      });
      if (newProductBtn) {
        newProductBtn.click();
      }
    } else {
      navigate('/products');
      // Wait a bit for page to load, then trigger
      setTimeout(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const newProductBtn = buttons.find(btn => {
          const text = btn.textContent.toLowerCase();
          return (text.includes('new product') || text.includes('add product') || text.includes('create product'));
        });
        if (newProductBtn) {
          newProductBtn.click();
        }
      }, 500);
    }
  }, [navigate, location]);

  const handleNewCustomer = useCallback(() => {
    if (location.pathname === '/customers') {
      const buttons = Array.from(document.querySelectorAll('button'));
      const newCustomerBtn = buttons.find(btn => {
        const text = btn.textContent.toLowerCase();
        return (text.includes('new customer') || text.includes('add customer') || text.includes('create customer'));
      });
      if (newCustomerBtn) {
        newCustomerBtn.click();
      }
    } else {
      navigate('/customers');
      setTimeout(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const newCustomerBtn = buttons.find(btn => {
          const text = btn.textContent.toLowerCase();
          return (text.includes('new customer') || text.includes('add customer') || text.includes('create customer'));
        });
        if (newCustomerBtn) {
          newCustomerBtn.click();
        }
      }, 500);
    }
  }, [navigate, location]);

  // Configure shortcuts with actions
  const configuredShortcuts = {
    'quick-search': {
      ...baseShortcuts['quick-search'],
      action: handleQuickSearch
    },
    'new-order': {
      ...baseShortcuts['new-order'],
      action: handleNewOrder
    },
    'print': {
      ...baseShortcuts['print'],
      action: handlePrint
    },
    'save': {
      ...baseShortcuts['save'],
      action: handleSave
    },
    'close-modal': {
      ...baseShortcuts['close-modal'],
      action: handleCloseModal
    },
    'help': {
      ...baseShortcuts['help'],
      action: handleHelp
    },
    'focus-search': {
      ...baseShortcuts['focus-search'],
      action: handleFocusSearch
    },
    'new-product': {
      ...baseShortcuts['new-product'],
      action: handleNewProduct
    },
    'new-customer': {
      ...baseShortcuts['new-customer'],
      action: handleNewCustomer
    }
  };

  // Use keyboard shortcuts hook
  const { registerShortcut, unregisterShortcut, formatKeyDisplay } = useKeyboardShortcuts(
    configuredShortcuts,
    { enabled: true, preventDefault: true }
  );

  // Check for conflicts
  useEffect(() => {
    const conflicts = detectConflicts(configuredShortcuts);
    if (conflicts.length > 0) {
      // Keyboard shortcut conflicts detected - handled silently
    }
  }, [configuredShortcuts]);

  // Toggle hints with Ctrl/Cmd + ?
  useEffect(() => {
    const handleToggleHints = (event) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? event.metaKey : event.ctrlKey;
      
      if (cmdKey && event.key === '?') {
        event.preventDefault();
        setShowHints(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleToggleHints);
    return () => window.removeEventListener('keydown', handleToggleHints);
  }, []);

  // Update shortcut
  const updateShortcut = useCallback((id, newKeys) => {
    setUserShortcuts(prev => {
      const updated = { ...prev, [id]: { ...prev[id], keys: newKeys } };
      // Save to localStorage
      try {
        localStorage.setItem('keyboardShortcuts', JSON.stringify(updated));
      } catch (error) {
        // Error saving keyboard shortcuts - silent fail
      }
      return updated;
    });
  }, []);

  // Reset shortcuts to default
  const resetShortcuts = useCallback(() => {
    setUserShortcuts({});
    try {
      localStorage.removeItem('keyboardShortcuts');
    } catch (error) {
      // Error resetting keyboard shortcuts - silent fail
    }
  }, []);

  const value = {
    shortcuts: configuredShortcuts,
    showHints,
    setShowHints,
    registerShortcut,
    unregisterShortcut,
    formatKeyDisplay,
    registerModal,
    unregisterModal,
    updateShortcut,
    resetShortcuts,
    userShortcuts
  };

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
};

