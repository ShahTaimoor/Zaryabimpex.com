import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { canAccessRoute } from '../config/routeAccess';
import { useTab } from '../contexts/TabContext';
import { getComponentInfo } from '../utils/componentUtils';
import TabBar from './TabBar';
import TabContent from './TabContent';
import ErrorBoundary from './ErrorBoundary';
import MobileNavigation from './MobileNavigation';
import MobileBottomNav from './MobileBottomNav';
import { useResponsive } from './ResponsiveContainer';
import { useGetAlertSummaryQuery } from '../store/services/inventoryAlertsApi';
import { POLLING_INTERVALS } from '../config/polling';
import { Button } from '@/components/ui/button';
import PresenceHeartbeat from './PresenceHeartbeat';
import { loadTopBarConfig, TOP_BAR_CONFIG_CHANGED } from '../config/topBarConfig';
import { TopBarUserCluster } from './layout/TopBarUserCluster';
import {
  navigation,
  loadSidebarConfig,
  isSidebarNavItemVisible,
  getHeaderColors,
  defaultOpenSections,
} from '../config/navigation';
import { TopBarActionButtonsDesktop, TopBarActionButtonsMobile } from './TopBarActionButtons';
import { useCompanyInfo } from '../hooks/useCompanyInfo';

// Re-export for backward compatibility
export { navigation, loadSidebarConfig, loadBottomNavConfig, migrateSidebarConfig } from '../config/navigation';
const isItemPermitted = (item, user, hasPermission) => {
  if (!item) return false;
  if (item.href) {
    return canAccessRoute(item.href, user, hasPermission);
  }
  if (user?.role === 'admin') return true;
  if (item.role && user?.role !== item.role) return false;
  if (item.permissionAny?.length) {
    return item.permissionAny.some((permissionKey) => hasPermission(permissionKey));
  }
  if (!item.permission) return true;
  return hasPermission(item.permission);
};

const SidebarItem = ({ item, isActivePath, sidebarConfig, orderSettings, user, hasPermission, onNavigate, level = 0 }) => {
  const hasChildren = item.children && item.children.length > 0;
  const [isOpen, setIsOpen] = useState(hasChildren && defaultOpenSections.includes(item.name));

  // Auto-expand if child is active (must be before any early returns)
  useEffect(() => {
    if (hasChildren) {
      const childActive = item.children.some(child => isActivePath(child.href));
      if (childActive) setIsOpen(true);
    }
  }, [item, isActivePath, hasChildren]);

  // Check visibility and permission
  if (!isSidebarNavItemVisible(item, sidebarConfig, orderSettings)) return null;
  const isPermitted = isItemPermitted(item, user, hasPermission);
  if (!isPermitted) return null;

  // If group, check if any child is visible/permitted
  if (hasChildren) {
    const hasVisibleChild = item.children.some(child => {
      const childVisible = isSidebarNavItemVisible(child, sidebarConfig, orderSettings);
      const childPermitted = isItemPermitted(child, user, hasPermission);
      return childVisible && childPermitted;
    });
    if (!hasVisibleChild) return null;
  }

  const isActive = !hasChildren && isActivePath(item.href);

  return (
    <div className="mb-1">
      {hasChildren ? (
        <>
          {(() => {
            const colors = getHeaderColors(item.name);
            return (
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${isOpen ? `${colors.text || 'text-white'} ${colors.bg}` : `text-gray-600 hover:bg-gray-100 hover:text-gray-900`
                  }`}
              >
                <div className="flex items-center">
                  {item.icon && <item.icon className={`mr-3 h-4 w-4 ${isOpen ? 'text-white' : 'text-gray-400 group-hover:text-gray-500'}`} />}
                  <span>{item.name}</span>
                </div>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
              </button>
            );
          })()}
          {isOpen && (
            <div className="mt-1 ml-4 space-y-1 border-l-2 border-gray-100 pl-2">
              {item.children.map((child) => (
                <SidebarItem
                  key={child.name}
                  item={child}
                  isActivePath={isActivePath}
                  sidebarConfig={sidebarConfig}
                  orderSettings={orderSettings}
                  user={user}
                  hasPermission={hasPermission}
                  onNavigate={onNavigate}
                  level={level + 1}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <button
          onClick={() => onNavigate(item)}
          className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${isActive
            ? (level === 0 ? 'bg-black text-white' : 'bg-primary-50 text-primary-700')
            : (level === 0 ? 'text-gray-600 hover:bg-black hover:text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')
            }`}
        >
          {item.icon && <item.icon className={`mr-3 h-4 w-4 ${isActive ? (level === 0 ? 'text-white' : 'text-primary-500') : 'text-gray-400 group-hover:text-gray-500'}`} />}
          <span>{item.name}</span>
        </button>
      )}
    </div>
  );
};

export const MultiTabLayout = ({ children }) => {
  const { companyInfo } = useCompanyInfo();
  const orderSettings = companyInfo?.orderSettings || {};
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);
  const mobileSidebarPanelRef = useRef(null);
  const { user, logout, hasPermission, isLoggingOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const { openTab, tabs, switchToTab, triggerTabHighlight, activeTabId } = useTab();

  // Dashboard visibility state
  const [dashboardHidden, setDashboardHidden] = useState(() => {
    const saved = localStorage.getItem('dashboardDataHidden');
    return saved === 'true';
  });

  const toggleDashboardVisibility = () => {
    const next = !dashboardHidden;
    setDashboardHidden(next);
    localStorage.setItem('dashboardDataHidden', String(next));
    // Trigger a custom event to notify Dashboard component
    window.dispatchEvent(new CustomEvent('dashboardVisibilityChanged', { detail: { hidden: next } }));
  };

  // Sidebar and top bar quick actions (independent configs)
  const [sidebarConfig, setSidebarConfig] = useState(() => loadSidebarConfig());
  const [topBarConfig, setTopBarConfig] = useState(() => loadTopBarConfig());
  const [showTopBar, setShowTopBar] = useState(() => {
    const saved = localStorage.getItem('showTopBarUI');
    return saved === null ? true : saved === 'true';
  });

  // Listener for sidebar configuration changes
  useEffect(() => {
    const handleSidebarChange = () => {
      setSidebarConfig(loadSidebarConfig());
    };
    const handleTopBarConfigChange = () => {
      setTopBarConfig(loadTopBarConfig());
    };
    const handleTopBarVisibilityChange = () => {
      const saved = localStorage.getItem('showTopBarUI');
      setShowTopBar(saved === null ? true : saved === 'true');
    };

    window.addEventListener('sidebarConfigChanged', handleSidebarChange);
    window.addEventListener(TOP_BAR_CONFIG_CHANGED, handleTopBarConfigChange);
    window.addEventListener('topBarVisibilityChanged', handleTopBarVisibilityChange);
    return () => {
      window.removeEventListener('sidebarConfigChanged', handleSidebarChange);
      window.removeEventListener(TOP_BAR_CONFIG_CHANGED, handleTopBarConfigChange);
      window.removeEventListener('topBarVisibilityChanged', handleTopBarVisibilityChange);
    };
  }, []);

  // Lock body scroll when mobile sidebar drawer is open
  useEffect(() => {
    if (!sidebarOpen || !isMobile) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen, isMobile]);

  const closeSidebar = useCallback(() => {
    if (mobileSidebarPanelRef.current?.contains(document.activeElement)) {
      mobileMenuButtonRef.current?.focus({ preventScroll: true });
    }
    setSidebarOpen(false);
  }, []);

  const openSidebar = useCallback(() => {
    setSidebarOpen(true);
  }, []);

  // Close drawer on route change when it was left open
  useEffect(() => {
    if (sidebarOpen) {
      closeSidebar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to navigation
  }, [location.pathname]);

  // Get alert summary for mobile bottom navbar
  const { data: summaryData } = useGetAlertSummaryQuery(undefined, {
    pollingInterval: POLLING_INTERVALS.INVENTORY_ALERT_SUMMARY_MS,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    skip: false,
  });
  const summary = summaryData?.data || summaryData || {};
  const criticalCount = summary.critical || 0;
  const outOfStockCount = summary.outOfStock || 0;
  const totalAlerts = summary.total || 0;
  const inventoryAlertCount = criticalCount > 0 ? criticalCount : totalAlerts;
  const showInventoryAlerts =
    sidebarConfig['Inventory Alerts'] !== false &&
    isItemPermitted({ permission: 'view_inventory' }, user, hasPermission);

  // Flatten grouped navigation for redirect logic
  const flattenedNavigation = React.useMemo(() => {
    const flat = [];
    const traverse = (items) => {
      items.forEach(item => {
        flat.push(item);
        if (item.children) {
          traverse(item.children);
        }
      });
    };
    traverse(navigation);
    return flat;
  }, []);

  // Redirect if current page is hidden
  useEffect(() => {
    // Only run if we have a user and navigation items loaded
    if (!user || flattenedNavigation.length === 0) return;

    const currentPath = location.pathname;

    // Don't redirect if we are on settings, login, dashboard tab route, or any other critical page
    if (
      currentPath === '/dashboard' ||
      currentPath === '/settings' ||
      currentPath === '/settings2' ||
      currentPath === '/login' ||
      currentPath === '/profile'
    ) {
      return;
    }

    // Check if the current path is hidden in sidebarConfig
    // Note: This logic might need refinement for nested structure if we hide parent but want to show child, 
    // but usually if parent is hidden, children are hidden in UI. 
    // Here we check individual item config.
    const currentNavItem = flattenedNavigation.find(item => item.href === currentPath);

    if (currentNavItem && currentNavItem.name) {
      const isVisible = sidebarConfig[currentNavItem.name] !== false;
      const isPermitted = isItemPermitted(currentNavItem, user, hasPermission);

      if (!isVisible || !isPermitted) {
        // Find the first visible and permitted page
        const firstVisiblePage = flattenedNavigation.find(item => {
          if (!item.href || !item.name) return false;
          if (item.children && item.children.length > 0) return false; // Skip groups
          const v = sidebarConfig[item.name] !== false;
          const p = isItemPermitted(item, user, hasPermission);
          return v && p;
        });

        if (firstVisiblePage && firstVisiblePage.href !== currentPath) {
          navigate(firstVisiblePage.href);
        }
      }
    }
  }, [location.pathname, sidebarConfig, flattenedNavigation, user, hasPermission, navigate]);


  const handleLogout = async () => {
    await logout();
  };

  const reuseNavigationPaths = new Set([
    '/sales-invoices',
    '/sales-invoices/',
    '/orders',
    '/purchase-invoices',
    '/settings',
    '/settings2'
  ]);

  const openDashboardTab = useCallback(() => {
    if (!hasPermission('view_dashboard')) return null;
    const componentInfo = getComponentInfo('/dashboard');
    if (!componentInfo) return null;

    const existingTab = tabs.find((tab) => tab.path === '/dashboard');
    if (existingTab) {
      switchToTab(existingTab.id);
      return existingTab.id;
    }

    return openTab({
      title: componentInfo.title,
      path: '/dashboard',
      component: componentInfo.component,
      icon: componentInfo.icon,
      allowMultiple: false,
    });
  }, [hasPermission, openTab, switchToTab, tabs]);

  // Dashboard opens as the default tab on login; reopens when all tabs are closed on /dashboard
  useEffect(() => {
    if (!user || !hasPermission('view_dashboard')) return;
    if (location.pathname !== '/dashboard') return;
    if (tabs.length > 0) return;

    openDashboardTab();
  }, [user, location.pathname, tabs.length, hasPermission, openDashboardTab]);

  const handleNavigationClick = (item) => {
    const componentInfo = getComponentInfo(item.href);
    if (componentInfo) {
      const existingTab = tabs.find(tab => tab.path === item.href);

      // If allowMultiple is true, always open a new tab
      // If allowMultiple is false and tab exists, switch to existing tab (or reuse if in reuseNavigationPaths)
      if (!componentInfo.allowMultiple && existingTab) {
        if (reuseNavigationPaths.has(item.href)) {
          switchToTab(existingTab.id);
          triggerTabHighlight(existingTab.id);
          return;
        }
        // For non-reuse paths, still switch to existing tab if not allowMultiple
        switchToTab(existingTab.id);
        triggerTabHighlight(existingTab.id);
        return;
      }

      // Open new tab (either because allowMultiple is true, or no existing tab)
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
      // For routes not in registry (like dashboard, settings), use regular navigation
      navigate(item.href);
    }
  };

  const isActivePath = (href) => {
    const normalizedPathname = location.pathname.replace(/\/$/, '') || '/';
    const normalizedHref = href.replace(/\/$/, '') || '/';
    const componentInfo = getComponentInfo(href);

    if (componentInfo) {
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      const isActiveByTab = activeTab && activeTab.path === href;
      const isActiveByLocation = normalizedPathname === normalizedHref;
      return isActiveByTab || isActiveByLocation;
    }
    return normalizedPathname === normalizedHref;
  };

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {user ? <PresenceHeartbeat /> : null}
      {/* Mobile Navigation */}
      <MobileNavigation user={user} onLogout={handleLogout} isLoggingOut={isLoggingOut} />

      {/* Mobile sidebar drawer */}
      <div
        className={`fixed inset-0 z-[60] lg:hidden transition-opacity duration-200 ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-[1px]"
          onClick={closeSidebar}
          aria-hidden="true"
          tabIndex={-1}
        />
        <aside
          ref={mobileSidebarPanelRef}
          role="dialog"
          aria-modal={sidebarOpen ? true : undefined}
          aria-label="Navigation menu"
          aria-hidden={!sidebarOpen}
          {...(!sidebarOpen ? { inert: '' } : {})}
          className={`fixed inset-y-0 left-0 flex w-[min(16rem,85vw)] max-w-xs flex-col bg-gray-100 shadow-xl transition-transform duration-200 ease-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-14 items-center justify-between px-4 bg-gray-100">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-black font-black text-white">Z</div>
              <h1 className="text-lg font-bold tracking-tight text-gray-900">ZARYAB IMPEX</h1>
            </div>
            <button
              type="button"
              onClick={closeSidebar}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close navigation menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav id="mobile-sidebar-nav" className="flex-1 space-y-1 px-3 py-4 overflow-y-auto max-h-[calc(100dvh-3.5rem)] scrollbar-thin scrollbar-thumb-gray-200">
            {navigation.map((item) => (
              <SidebarItem
                key={item.name}
                item={item}
                isActivePath={isActivePath}
                sidebarConfig={sidebarConfig}
                orderSettings={orderSettings}
                user={user}
                hasPermission={hasPermission}
                onNavigate={(item) => {
                  handleNavigationClick(item);
                  closeSidebar();
                }}
              />
            ))}
          </nav>
        </aside>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-gray-100">
          <div className="flex h-14 items-center px-6 bg-gray-100">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-black font-black text-white">Z</div>
              <h1 className="text-lg font-bold tracking-tight text-gray-900">ZARYAB IMPEX</h1>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto max-h-[calc(100dvh-3.5rem)] scrollbar-thin scrollbar-thumb-gray-200">
            {navigation.map((item) => (
              <SidebarItem
                key={item.name}
                item={item}
                isActivePath={isActivePath}
                sidebarConfig={sidebarConfig}
                orderSettings={orderSettings}
                user={user}
                hasPermission={hasPermission}
                onNavigate={handleNavigationClick}
              />
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar — matches TabBar (bg-gray-100) */}
        {showTopBar && (
          <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center bg-gray-100 pl-3 pr-2 sm:pl-4 sm:pr-2 lg:pl-6 lg:pr-3 overflow-visible">
          {/* Mobile Menu Button */}
          <button
            type="button"
            ref={mobileMenuButtonRef}
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden mr-2"
            onClick={openSidebar}
            aria-label="Open navigation menu"
            aria-expanded={sidebarOpen}
            aria-controls="mobile-sidebar-nav"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Main Navigation Container */}
          <div className="flex flex-1 items-center gap-2 sm:gap-3 lg:gap-4 min-w-0">
            <TopBarActionButtonsMobile
              topBarConfig={topBarConfig}
              user={user}
              hasPermission={hasPermission}
              onNavigate={handleNavigationClick}
            />
            <TopBarActionButtonsDesktop
              topBarConfig={topBarConfig}
              user={user}
              hasPermission={hasPermission}
              onNavigate={handleNavigationClick}
            />


            <PresenceHeartbeat />
            <TopBarUserCluster
              user={user}
              userMenuOpen={userMenuOpen}
              onToggleUserMenu={() => setUserMenuOpen((open) => !open)}
              onNavigateSettings={() => {
                handleNavigationClick({ href: '/settings2', name: 'Settings' });
                setUserMenuOpen(false);
              }}
              onNavigateHelp={() => {
                handleNavigationClick({ href: '/help', name: 'Help' });
                setUserMenuOpen(false);
              }}
              onLogout={() => {
                if (isLoggingOut) return;
                setUserMenuOpen(false);
                handleLogout();
              }}
              isLoggingOut={isLoggingOut}
              canManageSettings={isItemPermitted({ permission: 'manage_users' }, user, hasPermission)}
              alertCount={inventoryAlertCount}
              alertTitle={`${criticalCount} critical, ${outOfStockCount} out of stock`}
              onAlertClick={() =>
                handleNavigationClick({ href: '/inventory-alerts', name: 'Inventory Alerts' })
              }
              showAlerts={showInventoryAlerts}
              showTeamPresence={String(user?.role || '').toLowerCase() === 'admin'}
              userMenuRef={userMenuRef}
            />
          </div>
          </div>
        )}

        {/* Tab Bar */}
        <TabBar />

        {/* Page content */}
        <main className={`${isMobile ? 'py-2 pb-20' : isTablet ? 'py-3 pb-4' : 'py-4'} overflow-x-hidden max-w-full min-w-0`}>
          <div className={`mx-auto max-w-full w-full min-w-0 overflow-x-hidden [&_.card]:min-w-0 [&_table]:max-w-none ${isMobile ? 'px-2' : 'px-2 sm:px-4 lg:px-6'}`}>
            <ErrorBoundary>
              {(() => {
                const pathname = location.pathname;
                const isFormPage = pathname === '/customers/new' ||
                  /^\/customers\/[^/]+\/edit$/.test(pathname);
                const onDashboardRoute = pathname === '/dashboard';
                const showRoutes = (tabs.length === 0 && !onDashboardRoute) || isFormPage;
                return showRoutes ? children : <TabContent />;
              })()}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar - Dynamic based on configuration */}
      <MobileBottomNav />
    </div>
  );
};

