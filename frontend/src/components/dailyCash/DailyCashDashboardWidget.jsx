import React, { useState } from 'react';
import { Wallet, Eye, ArrowDownCircle, ArrowUpCircle, Lock, Unlock } from 'lucide-react';
import BaseModal from '../BaseModal';
import { LoadingInline } from '../LoadingSpinner';
import { useGetDailyCashDashboardQuery, useGetTodayCashSummaryQuery } from '../../store/services/dailyCashApi';
import { useCompanyInfo } from '../../hooks/useCompanyInfo';
import { isDailyCashClosingEnabled } from '../../utils/dailyCashSettings';
import { MOVEMENT_TYPE_LABELS } from '../../utils/cashCalculations';
import { getCurrentDatePakistan, getDateDaysAgo } from '../../utils/dateUtils';

function formatMoney(value) {
  const n = Number(value) || 0;
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatTile({ label, value, tone = 'default' }) {
  const toneClasses = {
    default: 'text-gray-900',
    in: 'text-green-700',
    out: 'text-red-700',
    muted: 'text-gray-600',
  };
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-center min-w-0">
      <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
      <p className={`text-sm sm:text-base font-bold mt-0.5 truncate ${toneClasses[tone] || toneClasses.default}`}>
        {value}
      </p>
    </div>
  );
}

export default function DailyCashDashboardWidget() {
  const { companyInfo } = useCompanyInfo();
  const dailyCashEnabled = isDailyCashClosingEnabled(companyInfo?.orderSettings);
  const [showModal, setShowModal] = useState(false);
  const fromDate = getDateDaysAgo(30);
  const toDate = getCurrentDatePakistan();

  const { data, isLoading } = useGetDailyCashDashboardQuery(
    { fromDate, toDate },
    { pollingInterval: 30000, skipPollingIfUnfocused: true, skip: !dailyCashEnabled }
  );

  const { data: todayRes, isLoading: todayLoading } = useGetTodayCashSummaryQuery(
    { date: toDate },
    { skip: !dailyCashEnabled || !showModal, pollingInterval: showModal ? 15000 : undefined }
  );

  if (!dailyCashEnabled) {
    return null;
  }

  const stats = data?.data || {};
  const today = stats.today || {};
  const summary = todayRes?.data;
  const isClosed = summary?.status === 'closed';
  const expectedCash = summary?.expectedCash ?? today.expectedCash ?? 0;
  const movements = summary?.movements || [];

  const varianceTone = summary?.varianceType === 'short'
    ? 'text-red-700 bg-red-50 border-red-100'
    : summary?.varianceType === 'over'
      ? 'text-amber-800 bg-amber-50 border-amber-100'
      : 'text-green-800 bg-green-50 border-green-100';

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setShowModal(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setShowModal(true);
          }
        }}
        className="text-center p-2 sm:p-2.5 xl:p-3 2xl:p-4 border border-gray-200 bg-white rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors relative group shadow-sm min-w-0"
      >
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Eye className="h-2.5 w-2.5 xl:h-3 xl:w-3 2xl:h-4 2xl:w-4 text-gray-600" />
        </div>
        <div className="flex justify-center mb-1 sm:mb-1.5 xl:mb-2">
          <div className="p-1.5 sm:p-2 xl:p-2.5 2xl:p-3 bg-slate-100 rounded-full">
            <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6 text-slate-700" />
          </div>
        </div>
        <p className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Daily Cash</p>
        {isLoading ? (
          <p className="text-sm text-gray-500">...</p>
        ) : (
          <>
            <p className="text-sm sm:text-base xl:text-lg 2xl:text-xl font-bold text-gray-900 break-words">
              {formatMoney(today.expectedCash)}
            </p>
            <p className="text-[9px] sm:text-[10px] xl:text-xs text-gray-500 mt-0.5 hidden sm:block">
              Today expected · {today.status === 'closed' ? 'Closed' : 'Open'} · {stats.closed_days ?? 0} days closed (30d)
            </p>
          </>
        )}
      </div>

      <BaseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Daily Cash Summary"
        subtitle={toDate}
        maxWidth="md"
        variant="centered"
        headerExtra={
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
            isClosed ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-800'
          }`}>
            {isClosed ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            {isClosed ? 'Closed' : 'Open'}
          </span>
        }
        contentClassName="p-4 sm:p-5"
      >
        {todayLoading && !summary ? (
          <div className="py-8 flex justify-center">
            <LoadingInline />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Expected cash hero */}
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Expected Cash in Drawer</p>
              <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{formatMoney(expectedCash)}</p>
              <p className="text-xs text-gray-500 mt-2">
                Opening {formatMoney(summary?.openingCash)}
                {' + '}
                <span className="text-green-700">In {formatMoney(summary?.cashIn)}</span>
                {' − '}
                <span className="text-red-700">Out {formatMoney(summary?.cashOut)}</span>
              </p>
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatTile label="Opening" value={formatMoney(summary?.openingCash)} />
              <StatTile label="Cash In" value={formatMoney(summary?.cashIn)} tone="in" />
              <StatTile label="Cash Out" value={formatMoney(summary?.cashOut)} tone="out" />
              <StatTile label="Movements" value={summary?.movementCount ?? 0} tone="muted" />
            </div>

            {/* Closing reconciliation */}
            {isClosed && (
              <div className={`rounded-lg border px-4 py-3 grid grid-cols-3 gap-3 text-center ${varianceTone}`}>
                <div>
                  <p className="text-[10px] font-medium uppercase opacity-80">Actual</p>
                  <p className="text-sm font-bold mt-0.5 tabular-nums">{formatMoney(summary?.actualCash)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase opacity-80">Expected</p>
                  <p className="text-sm font-bold mt-0.5 tabular-nums">{formatMoney(expectedCash)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase opacity-80">Difference</p>
                  <p className="text-sm font-bold mt-0.5 tabular-nums capitalize">
                    {formatMoney(summary?.difference)} · {summary?.varianceType || 'exact'}
                  </p>
                </div>
              </div>
            )}

            {/* Movements */}
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Today&apos;s Movements</p>
                <span className="text-xs text-gray-500">{movements.length} record{movements.length === 1 ? '' : 's'}</span>
              </div>

              {movements.length > 0 ? (
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white border-b border-gray-100">
                      <tr className="text-left text-[11px] text-gray-500 uppercase">
                        <th className="px-3 py-2 font-medium">Time</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...movements].reverse().map((m) => (
                        <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80">
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap text-xs">
                            {formatDateTime(m.created_at || m.createdAt)}
                          </td>
                          <td className="px-3 py-2 text-gray-800 text-xs">
                            <span className="inline-flex items-center gap-1">
                              {m.direction === 'in' ? (
                                <ArrowUpCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                              ) : (
                                <ArrowDownCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                              )}
                              {MOVEMENT_TYPE_LABELS[m.movement_type] || m.movement_type}
                            </span>
                          </td>
                          <td className={`px-3 py-2 text-right font-semibold tabular-nums text-xs ${
                            m.direction === 'in' ? 'text-green-700' : 'text-red-700'
                          }`}>
                            {m.direction === 'in' ? '+' : '−'}{formatMoney(m.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <Wallet className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No cash movements recorded today.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </BaseModal>
    </>
  );
}
