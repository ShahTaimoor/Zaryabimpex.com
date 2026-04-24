import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTab } from '../contexts/TabContext';
import { getComponentInfo } from '../utils/componentUtils';

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasPermission } = useAuth();
  const { openTab, tabs, switchToTab, triggerTabHighlight, activeTabId } = useTab();
  
  const [config, setConfig] = useState([]);

  const loadConfig = () => {
    const saved = localStorage.getItem('bottomNavConfig');
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse bottomNavConfig', e);
        setDefaultConfig();
      }
    } else {
      setDefaultConfig();
    }
  };

  const setDefaultConfig = () => {
    const defaultConfig = [
      { name: 'Cash Receipts', href: '/cash-receipts', icon: 'Receipt' },
      { name: 'Bank Receipts', href: '/bank-receipts', icon: 'Receipt' },
      { name: 'Cash Payments', href: '/cash-payments', icon: 'CreditCard' },
      { name: 'Bank Payments', href: '/bank-payments', icon: 'CreditCard' }
    ];
    setConfig(defaultConfig);
    localStorage.setItem('bottomNavConfig', JSON.stringify(defaultConfig));
  };

  useEffect(() => {
    loadConfig();
    const handleConfigChange = () => loadConfig();
    window.addEventListener('bottomNavConfigChanged', handleConfigChange);
    return () => window.removeEventListener('bottomNavConfigChanged', handleConfigChange);
  }, []);

  const handleNavigationClick = (item) => {
    const componentInfo = getComponentInfo(item.href);
    if (componentInfo) {
      const existingTab = tabs.find(tab => tab.path === item.href);
      
      const reuseNavigationPaths = new Set([
        '/sales-invoices',
        '/sales-invoices/',
        '/orders',
        '/purchase-invoices',
        '/settings',
        '/settings2'
      ]);

      if (!componentInfo.allowMultiple && existingTab) {
        if (reuseNavigationPaths.has(item.href)) {
          switchToTab(existingTab.id);
          triggerTabHighlight(existingTab.id);
          return;
        }
        switchToTab(existingTab.id);
        triggerTabHighlight(existingTab.id);
        return;
      }

      const tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      openTab({
        title: componentInfo.title,
        path: item.href,
        component: componentInfo.component,
        icon: componentInfo.icon,
        allowMultiple: componentInfo.allowMultiple || false,
        props: { tabId: tabId }
      });
    } else {
      navigate(item.href);
    }
  };

  const isActivePath = (href) => {
    const normalizedPathname = location.pathname.replace(/\/$/, '') || '/';
    const normalizedHref = href.replace(/\/$/, '') || '/';
    
    // Check if path matches component registry
    const componentInfo = getComponentInfo(href);
    if (componentInfo) {
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      const isActiveByTab = activeTab && activeTab.path === href;
      const isActiveByLocation = normalizedPathname === normalizedHref;
      return isActiveByTab || isActiveByLocation;
    }
    
    return normalizedPathname === normalizedHref;
  };

  // Filter items based on permissions
  const visibleItems = config.filter(item => {
    const componentInfo = getComponentInfo(item.href);
    const permission = componentInfo?.permission || item.permission;
    return !permission || user?.role === 'admin' || hasPermission(permission);
  });

  if (visibleItems.length === 0) return null;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 border-t border-gray-200 backdrop-blur-md pb-safe">
      <div className="flex items-center justify-around px-2 py-2 max-w-screen-sm mx-auto h-16">
        {visibleItems.map((item) => {
          const IconComponent = Icons[item.icon] || Icons.Circle;
          const isActive = isActivePath(item.href);
          
          // Determine color based on path (matching the dashboard's emerald/blue theme if possible)
          const isEmerald = item.href.includes('receipt');
          const isBlue = item.href.includes('payment');
          
          let activeClasses = 'bg-gray-100 text-gray-900 ring-2 ring-gray-400/30';
          let inactiveClasses = 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100';

          if (isEmerald) {
            activeClasses = 'bg-emerald-100 text-emerald-700 border-emerald-200 ring-2 ring-emerald-400/60';
            inactiveClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
          } else if (isBlue) {
            activeClasses = 'bg-blue-100 text-blue-700 border-blue-200 ring-2 ring-blue-400/60';
            inactiveClasses = 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
          }

          return (
            <button
              key={item.href}
              onClick={() => handleNavigationClick(item)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 mx-1 rounded-xl transition-all duration-200 active:scale-95 border ${
                isActive ? activeClasses : inactiveClasses
              }`}
            >
              <IconComponent className={`h-5 w-5 ${isActive ? 'mb-0.5' : 'mb-0.5 opacity-80'}`} />
              <span className="text-[10px] font-bold leading-tight w-full text-center break-words">
                {item.name.replace('Receipts', 'Receipt').replace('Payments', 'Payment')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileBottomNav;
