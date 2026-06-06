import React from 'react';
import { canAccessRoute } from '../config/routeAccess';
import {
  TOP_BAR_ACTION_ITEMS,
  isTopBarItemEnabled,
} from '../config/topBarConfig';

function isItemPermitted(item, user, hasPermission) {
  if (!item) return false;
  if (item.href && !canAccessRoute(item.href, user, hasPermission)) return false;
  if (user?.role === 'admin') return true;
  if (item.permissionAny?.length) {
    return item.permissionAny.some((key) => hasPermission(key));
  }
  if (!item.permission) return true;
  return hasPermission(item.permission);
}

function visibleItems(topBarConfig, user, hasPermission) {
  return TOP_BAR_ACTION_ITEMS.filter(
    (item) => isTopBarItemEnabled(topBarConfig, item.name) && isItemPermitted(item, user, hasPermission)
  );
}

export function TopBarActionButtonsMobile({ topBarConfig, user, hasPermission, onNavigate }) {
  const items = visibleItems(topBarConfig, user, hasPermission);
  if (!items.length) return null;

  return (
    <div className="flex-shrink-0 lg:hidden flex items-center gap-2">
      {items.slice(0, 2).map((item) => {
        const Icon = item.icon;
        const isPrimary = item.mobilePrimary;
        return (
          <button
            key={item.name}
            type="button"
            onClick={() => onNavigate({ href: item.href, name: item.name })}
            className={
              isPrimary
                ? 'bg-black hover:bg-gray-800 text-white px-2.5 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-1.5 text-xs font-medium whitespace-nowrap'
                : 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 px-2.5 py-2 rounded-md shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-1.5 text-xs font-medium whitespace-nowrap'
            }
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{item.mobileLabel || item.desktopLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TopBarActionButtonsDesktop({ topBarConfig, user, hasPermission, onNavigate }) {
  const items = visibleItems(topBarConfig, user, hasPermission);
  if (!items.length) return null;

  return (
    <div className="hidden lg:flex items-center gap-1 xl:gap-1.5 2xl:gap-2 overflow-x-auto flex-1 min-w-0 scrollbar-hide overflow-y-visible">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.name}
            type="button"
            onClick={() => onNavigate({ href: item.href, name: item.name })}
            className="bg-white text-gray-900 border border-gray-200 hover:bg-black hover:text-white px-2 py-1.5 xl:px-3 xl:py-2 rounded-md shadow-sm transition-all duration-200 flex items-center gap-1 xl:gap-1.5 text-[10px] xl:text-xs 2xl:text-sm font-medium flex-shrink-0 whitespace-nowrap min-w-0 group/btn"
          >
            <span className="inline-flex items-center justify-center w-5 h-5 xl:w-6 xl:h-6 rounded bg-gray-100 group-hover/btn:bg-gray-800 flex-shrink-0">
              <Icon className="h-2.5 w-2.5 xl:h-3.5 xl:w-3.5 text-gray-900 group-hover/btn:text-white" />
            </span>
            {item.desktopLabelShort ? (
              <>
                <span className="hidden sm:inline">{item.desktopLabel}</span>
                <span className="sm:hidden">{item.desktopLabelShort}</span>
              </>
            ) : (
              <span>{item.desktopLabel}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
