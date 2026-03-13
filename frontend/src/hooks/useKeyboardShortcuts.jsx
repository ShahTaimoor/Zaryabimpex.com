import { useEffect, useCallback } from 'react';

// Default keyboard shortcuts configuration
export const DEFAULT_SHORTCUTS = {
  'quick-search': {
    keys: ['ctrl+k', 'cmd+k'],
    description: 'Quick search',
    category: 'Navigation'
  },
  'new-order': {
    keys: ['ctrl+n', 'cmd+n'],
    description: 'New order',
    category: 'Actions'
  },
  'print': {
    keys: ['ctrl+p', 'cmd+p'],
    description: 'Print',
    category: 'Actions'
  },
  'save': {
    keys: ['ctrl+s', 'cmd+s'],
    description: 'Save',
    category: 'Actions'
  },
  'close-modal': {
    keys: ['escape'],
    description: 'Close modal',
    category: 'Navigation'
  },
  'help': {
    keys: ['f1'],
    description: 'Help',
    category: 'Navigation'
  },
  'focus-search': {
    keys: ['ctrl+f', 'cmd+f'],
    description: 'Focus search',
    category: 'Navigation'
  },
  'new-product': {
    keys: ['ctrl+shift+p', 'cmd+shift+p'],
    description: 'New product',
    category: 'Actions'
  },
  'new-customer': {
    keys: ['ctrl+shift+c', 'cmd+shift+c'],
    description: 'New customer',
    category: 'Actions'
  }
};

// Detect conflicts in keyboard shortcuts
export const detectConflicts = (shortcuts) => {
  const conflicts = [];
  const keyMap = new Map();
  
  Object.entries(shortcuts).forEach(([id, config]) => {
    if (!config || !config.keys) return;
    
    config.keys.forEach(key => {
      const normalizedKey = key.toLowerCase().trim();
      if (keyMap.has(normalizedKey)) {
        conflicts.push({
          key: normalizedKey,
          shortcuts: [keyMap.get(normalizedKey), id]
        });
      } else {
        keyMap.set(normalizedKey, id);
      }
    });
  });
  
  return conflicts;
};

// Format key display for UI
export const formatKeyDisplay = (key) => {
  if (!key) return '';
  
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return key
    .replace(/ctrl/gi, isMac ? '⌘' : 'Ctrl')
    .replace(/cmd/gi, isMac ? '⌘' : 'Cmd')
    .replace(/shift/gi, isMac ? '⇧' : 'Shift')
    .replace(/alt/gi, isMac ? '⌥' : 'Alt')
    .replace(/escape/gi, 'Esc')
    .replace(/enter/gi, 'Enter')
    .replace(/\+/g, ' + ')
    .toUpperCase();
};

export const useKeyboardShortcuts = (shortcuts, options = {}) => {
  const { enabled = true, preventDefault = true } = options;
  
  useEffect(() => {
    if (!enabled || !shortcuts) return;
    
    const handleKeyDown = (event) => {
      if (!event.key) return;
      
      const target = event.target;
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.contentEditable === 'true' ||
                          target.isContentEditable;
      
      if (isInputField) return;
      
      const key = event.key.toLowerCase();
      const ctrlKey = event.ctrlKey;
      const metaKey = event.metaKey;
      const shiftKey = event.shiftKey;
      const altKey = event.altKey;
      
      // Build shortcut key string
      let shortcutKey = '';
      if (metaKey) shortcutKey += 'cmd+';
      else if (ctrlKey) shortcutKey += 'ctrl+';
      if (shiftKey) shortcutKey += 'shift+';
      if (altKey) shortcutKey += 'alt+';
      shortcutKey += key;
      
      // Check if shortcut exists and has an action
      // shortcuts can be either:
      // 1. Object with shortcut IDs as keys (from context)
      // 2. Simple key-value map (direct key -> function)
      let matchedShortcut = null;
      
      if (shortcuts) {
        // Check if it's a context-style shortcuts object
        const shortcutEntries = Object.entries(shortcuts);
        for (const [id, config] of shortcutEntries) {
          if (config && config.keys && Array.isArray(config.keys)) {
            if (config.keys.includes(shortcutKey)) {
              matchedShortcut = config;
              break;
            }
          } else if (typeof config === 'function') {
            // Simple key-value map
            if (id === shortcutKey) {
              matchedShortcut = { action: config };
              break;
            }
          }
        }
      }
      
      if (matchedShortcut && matchedShortcut.action) {
        if (preventDefault) {
          event.preventDefault();
        }
        matchedShortcut.action(event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled, preventDefault]);
  
  // Register shortcut function (for dynamic registration)
  const registerShortcut = useCallback((id, config) => {
    // This would typically update a state or context
    // For now, it's a placeholder
  }, []);
  
  // Unregister shortcut function
  const unregisterShortcut = useCallback((id) => {
    // This would typically update a state or context
    // For now, it's a placeholder
  }, []);
  
  return {
    registerShortcut,
    unregisterShortcut,
    formatKeyDisplay
  };
};
