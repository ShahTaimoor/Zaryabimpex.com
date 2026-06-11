import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Lock, Unlock, ArrowRight } from 'lucide-react';
import { useGetTillDashboardQuery } from '../../store/services/tillsApi';
import { useAuth } from '../../contexts/AuthContext';

export function TillDashboardWidget({ fromDate, toDate, showWidget = true }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data, isLoading, isFetching } = useGetTillDashboardQuery(
    { fromDate, toDate },
    {
      skip: !showWidget || !isAdmin,
      pollingInterval: 30000,
      skipPollingIfUnfocused: true,
    }
  );

  if (!showWidget || !isAdmin) return null;

  const stats = data?.data || {};
  const current = stats.currentSession;
  const openCount = Number(stats.open_sessions || 0);
  const closedCount = Number(stats.closed_sessions || 0);

  return (
    <div
      className="text-center p-2 sm:p-2.5 xl:p-3 2xl:p-4 border border-gray-200 bg-white rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm min-w-0 col-span-2 sm:col-span-1"
      onClick={() => navigate('/till')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate('/till')}
    >
      <div className="flex justify-center mb-1 sm:mb-1.5 xl:mb-2">
        <div className={`p-1.5 sm:p-2 xl:p-2.5 2xl:p-3 rounded-full ${current ? 'bg-green-100' : 'bg-amber-100'}`}>
          <Wallet className={`h-3.5 w-3.5 sm:h-4 sm:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6 ${current ? 'text-green-700' : 'text-amber-700'}`} />
        </div>
      </div>
      <p className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
        Till Sessions
        {(isLoading || isFetching) && <span className="inline ml-1 text-xs text-gray-400">…</span>}
      </p>
      <div className="flex items-center justify-center gap-3 text-sm font-bold text-gray-900">
        <span className="flex items-center gap-1 text-green-700">
          <Unlock className="h-3.5 w-3.5" /> {openCount}
        </span>
        <span className="flex items-center gap-1 text-gray-600">
          <Lock className="h-3.5 w-3.5" /> {closedCount}
        </span>
      </div>
      <p className="text-[9px] sm:text-[10px] xl:text-xs text-gray-500 mt-1 hidden sm:block">
        {current
          ? `Till open · Expected ${Math.round(current.expectedCash || 0).toLocaleString()}`
          : 'No till open · Click to manage'}
        <ArrowRight className="inline h-3 w-3 ml-0.5" />
      </p>
    </div>
  );
}

export default TillDashboardWidget;
