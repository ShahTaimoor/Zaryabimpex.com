import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Wallet,
  Lock,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import BaseModal from '../components/BaseModal';
import ConfirmationDialog from '../components/ConfirmationDialog';
import DateFilter from '../components/DateFilter';
import { PageHeader } from '../components/layout/PageHeader';
import { PageLayout } from '../components/layout/PageLayout';
import { LoadingPage, LoadingButton } from '../components/LoadingSpinner';
import {
  useGetTodayCashSummaryQuery,
  useGetCashMovementsReportQuery,
  useGetDailyCashSummaryReportQuery,
  useGetDailyCashClosingsReportQuery,
  useGetDailyCashVarianceReportQuery,
  useGetDailyCashUserActivityReportQuery,
  useCloseDailyCashMutation,
  useRecordCashWithdrawalMutation,
  useRecordCashAdjustmentMutation,
  useSetDailyOpeningCashMutation,
} from '../store/services/dailyCashApi';
import { MOVEMENT_TYPE_LABELS, calculateCashDifference } from '../utils/cashCalculations';
import { getCurrentDatePakistan, getDateDaysAgo } from '../utils/dateUtils';

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'closings', label: 'Closing History' },
  { id: 'movements', label: 'Cash Movements' },
  { id: 'daily', label: 'Daily Summary' },
  { id: 'users', label: 'User Activity' },
  { id: 'variance', label: 'Shortage / Overage' },
];

function formatMoney(value) {
  const n = Number(value) || 0;
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function DailyCashClosing() {
  const [activeTab, setActiveTab] = useState('today');
  const [selectedDate, setSelectedDate] = useState(getCurrentDatePakistan());
  const [fromDate, setFromDate] = useState(getDateDaysAgo(7));
  const [toDate, setToDate] = useState(getCurrentDatePakistan());
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [notesClose, setNotesClose] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawDesc, setWithdrawDesc] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDirection, setAdjustDirection] = useState('in');
  const [adjustDesc, setAdjustDesc] = useState('');

  const { data: todayRes, isLoading: todayLoading, refetch: refetchToday } = useGetTodayCashSummaryQuery(
    { date: selectedDate },
    { pollingInterval: 15000, skipPollingIfUnfocused: true }
  );
  const today = todayRes?.data;

  const reportParams = useMemo(() => ({ fromDate, toDate }), [fromDate, toDate]);
  const { data: closingsRes, isLoading: closingsLoading } = useGetDailyCashClosingsReportQuery(
    { ...reportParams, limit: 200 },
    { skip: activeTab !== 'closings' }
  );
  const { data: movementsRes, isLoading: movementsLoading } = useGetCashMovementsReportQuery(
    { ...reportParams, limit: 300 },
    { skip: activeTab !== 'movements' }
  );
  const { data: dailyRes, isLoading: dailyLoading } = useGetDailyCashSummaryReportQuery(reportParams, { skip: activeTab !== 'daily' });
  const { data: usersRes, isLoading: usersLoading } = useGetDailyCashUserActivityReportQuery(reportParams, { skip: activeTab !== 'users' });
  const { data: varianceRes, isLoading: varianceLoading } = useGetDailyCashVarianceReportQuery(reportParams, { skip: activeTab !== 'variance' });

  const [closeDay, { isLoading: closing }] = useCloseDailyCashMutation();
  const [withdraw, { isLoading: withdrawing }] = useRecordCashWithdrawalMutation();
  const [adjust, { isLoading: adjusting }] = useRecordCashAdjustmentMutation();
  const [setOpening, { isLoading: settingOpening }] = useSetDailyOpeningCashMutation();

  const closePreview = useMemo(() => {
    if (!today) return null;
    const expected = Number(today.expectedCash ?? 0);
    const actual = parseFloat(actualCash) || 0;
    return calculateCashDifference(actual, expected);
  }, [today, actualCash]);

  const isDayClosed = today?.status === 'closed';

  const handleSetOpening = async (e) => {
    e.preventDefault();
    const amount = parseFloat(openingCash);
    if (Number.isNaN(amount) || amount < 0) {
      toast.error('Enter a valid opening cash amount');
      return;
    }
    try {
      await setOpening({ businessDate: selectedDate, openingCash: amount }).unwrap();
      toast.success('Opening cash updated');
      setShowOpeningModal(false);
      setOpeningCash('');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to set opening cash');
    }
  };

  const handleCloseDay = async (e) => {
    e.preventDefault();
    const amount = parseFloat(actualCash);
    if (Number.isNaN(amount) || amount < 0) {
      toast.error('Enter the actual cash counted');
      return;
    }
    try {
      const result = await closeDay({
        businessDate: selectedDate,
        actualCash: amount,
        notes: notesClose,
      }).unwrap();
      const vType = result?.data?.varianceType;
      if (vType === 'short') toast.warning(`Day closed with shortage of ${formatMoney(Math.abs(result?.data?.difference))}`);
      else if (vType === 'over') toast.info(`Day closed with overage of ${formatMoney(result?.data?.difference)}`);
      else toast.success('Day closed — cash balanced exactly');
      setShowCloseModal(false);
      setActualCash('');
      setNotesClose('');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to close day');
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid withdrawal amount');
      return;
    }
    try {
      await withdraw({ amount, description: withdrawDesc, businessDate: selectedDate }).unwrap();
      toast.success('Cash withdrawal recorded');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setWithdrawDesc('');
      refetchToday();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to record withdrawal');
    }
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    const amount = parseFloat(adjustAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid adjustment amount');
      return;
    }
    try {
      await adjust({
        amount,
        direction: adjustDirection,
        description: adjustDesc,
        businessDate: selectedDate,
      }).unwrap();
      toast.success('Cash adjustment recorded');
      setShowAdjustModal(false);
      setAdjustAmount('');
      setAdjustDesc('');
      refetchToday();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to record adjustment');
    }
  };

  if (todayLoading && !today) {
    return <LoadingPage message="Loading daily cash summary..." />;
  }

  return (
    <PageLayout>
      <PageHeader
        title="Daily Cash Closing"
        description="Cash transactions are tracked automatically. Reconcile physical cash at end of day."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchToday()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            {!isDayClosed && (
              <>
                <Button variant="outline" size="sm" onClick={() => {
                  setOpeningCash(String(today?.openingCash ?? ''));
                  setShowOpeningModal(true);
                }}>
                  <Wallet className="h-4 w-4 mr-1" /> Set Opening
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAdjustModal(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Adjustment
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowWithdrawModal(true)}>
                  <ArrowUpCircle className="h-4 w-4 mr-1" /> Withdraw
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setShowCloseConfirmModal(true)}>
                  <Lock className="h-4 w-4 mr-1" /> Close Day
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4 border-b pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'today' && (
        <div className="mb-4 max-w-xs">
          <DateFilter mode="single"
            label="Business Date"
            value={selectedDate}
            onChange={setSelectedDate}
          />
        </div>
      )}

      {activeTab !== 'today' && (
        <div className="mb-4 max-w-xl">
          <DateFilter
            startDate={fromDate}
            endDate={toDate}
            onDateChange={(start, end) => {
              setFromDate(start);
              setToDate(end);
            }}
          />
        </div>
      )}

      {activeTab === 'today' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Daily Cash Summary — {selectedDate}</h2>
              <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                isDayClosed ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-800'
              }`}>
                {isDayClosed ? 'Closed' : 'Open'}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Opening Cash</dt><dd className="font-medium">{formatMoney(today?.openingCash)}</dd></div>
              <div><dt className="text-muted-foreground">Movements</dt><dd className="font-medium">{today?.movementCount ?? 0}</dd></div>
              <div><dt className="text-muted-foreground">Cash In</dt><dd className="font-medium text-green-700">{formatMoney(today?.cashIn)}</dd></div>
              <div><dt className="text-muted-foreground">Cash Out</dt><dd className="font-medium text-red-700">{formatMoney(today?.cashOut)}</dd></div>
              <div className="col-span-2 border-t pt-3">
                <dt className="text-muted-foreground">Expected Cash</dt>
                <dd className="text-2xl font-bold">{formatMoney(today?.expectedCash)}</dd>
              </div>
              {isDayClosed && (
                <>
                  <div><dt className="text-muted-foreground">Actual Counted</dt><dd className="font-medium">{formatMoney(today?.actualCash)}</dd></div>
                  <div><dt className="text-muted-foreground">Difference</dt>
                    <dd className={`font-medium ${today?.varianceType === 'short' ? 'text-red-600' : today?.varianceType === 'over' ? 'text-amber-600' : 'text-green-600'}`}>
                      {formatMoney(today?.difference)} ({today?.varianceType})
                    </dd>
                  </div>
                  <div className="col-span-2"><dt className="text-muted-foreground">Closed By</dt><dd>{today?.closedByName || '—'} at {formatDateTime(today?.closedAt)}</dd></div>
                </>
              )}
            </dl>
          </div>

          {today?.movements?.length > 0 && (
            <div className="rounded-lg border bg-card p-4 shadow-sm overflow-auto max-h-[420px]">
              <h3 className="font-semibold mb-3">Cash Movements</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-2">Time</th>
                    <th className="pb-2 pr-2">Type</th>
                    <th className="pb-2 pr-2">Ref</th>
                    <th className="pb-2 pr-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(today.movements || [])].reverse().map((m) => (
                    <tr key={m.id} className="border-b border-muted/50">
                      <td className="py-2 pr-2 whitespace-nowrap">{formatDateTime(m.created_at || m.createdAt)}</td>
                      <td className="py-2 pr-2">{MOVEMENT_TYPE_LABELS[m.movement_type] || m.movement_type}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{m.reference_number || '—'}</td>
                      <td className={`py-2 text-right font-medium ${m.direction === 'in' ? 'text-green-700' : 'text-red-700'}`}>
                        {m.direction === 'in' ? '+' : '-'}{formatMoney(m.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'closings' && (
        <ReportTable
          loading={closingsLoading}
          columns={['Date', 'Opening', 'Cash In', 'Cash Out', 'Expected', 'Actual', 'Variance', 'Status', 'Closed By']}
          rows={(closingsRes?.data || []).map((r) => [
            r.businessDate || r.business_date,
            formatMoney(r.openingCash ?? r.opening_cash),
            formatMoney(r.cashIn ?? r.cash_in),
            formatMoney(r.cashOut ?? r.cash_out),
            formatMoney(r.expectedCash ?? r.expected_cash),
            formatMoney(r.actualCash ?? r.actual_cash),
            r.varianceType ? `${r.varianceType} ${formatMoney(r.difference)}` : '—',
            r.status,
            r.closedByName || '—',
          ])}
        />
      )}

      {activeTab === 'movements' && (
        <ReportTable
          loading={movementsLoading}
          columns={['Date', 'Time', 'User', 'Type', 'Direction', 'Amount', 'Reference', 'Description']}
          rows={(movementsRes?.data || []).map((m) => [
            m.business_date,
            formatDateTime(m.created_at),
            m.created_by_name || '—',
            MOVEMENT_TYPE_LABELS[m.movement_type] || m.movement_type,
            m.direction,
            formatMoney(m.amount),
            m.reference_number || m.reference_id || '—',
            m.description || '—',
          ])}
        />
      )}

      {activeTab === 'daily' && (
        <ReportTable
          loading={dailyLoading}
          columns={['Date', 'Opening', 'Cash In', 'Cash Out', 'Expected', 'Actual', 'Difference', 'Status']}
          rows={(dailyRes?.data || []).map((r) => [
            r.businessDate || r.business_date,
            formatMoney(r.openingCash ?? r.opening_cash),
            formatMoney(r.cashIn ?? r.cash_in),
            formatMoney(r.cashOut ?? r.cash_out),
            formatMoney(r.expectedCash ?? r.expected_cash),
            formatMoney(r.actualCash ?? r.actual_cash),
            formatMoney(r.difference),
            r.status,
          ])}
        />
      )}

      {activeTab === 'users' && (
        <ReportTable
          loading={usersLoading}
          columns={['User', 'Movements', 'Cash In', 'Cash Out']}
          rows={(usersRes?.data || []).map((r) => [
            r.user_name || r.user_id,
            r.movement_count,
            formatMoney(r.cash_in),
            formatMoney(r.cash_out),
          ])}
        />
      )}

      {activeTab === 'variance' && (
        <ReportTable
          loading={varianceLoading}
          columns={['Date', 'Expected', 'Actual', 'Type', 'Difference', 'Notes']}
          rows={(varianceRes?.data || []).map((r) => [
            r.businessDate || r.business_date,
            formatMoney(r.expectedCash ?? r.expected_cash),
            formatMoney(r.actualCash ?? r.actual_cash),
            r.varianceType || r.variance_type,
            formatMoney(r.difference),
            r.notes || '—',
          ])}
        />
      )}

      <ConfirmationDialog
        isOpen={showCloseConfirmModal}
        onClose={() => setShowCloseConfirmModal(false)}
        onConfirm={() => {
          setShowCloseConfirmModal(false);
          setActualCash(String(today?.expectedCash ?? ''));
          setShowCloseModal(true);
        }}
        title="Close Day?"
        message={`Are you sure you want to close cash for ${selectedDate}? After closing, no more cash transactions can be recorded for this day. You will enter the actual cash counted next.`}
        confirmText="Yes"
        cancelText="No"
        type="warning"
      />

      <BaseModal isOpen={showOpeningModal} onClose={() => setShowOpeningModal(false)} title="Set Opening Cash">
        <form onSubmit={handleSetOpening} className="space-y-4">
          <p className="text-sm text-muted-foreground">Opening cash for {selectedDate}. Defaults from previous day&apos;s closing count.</p>
          <div>
            <label className="text-sm font-medium">Opening Cash *</label>
            <Input type="number" min="0" step="0.01" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} required />
          </div>
          <LoadingButton type="submit" loading={settingOpening} className="w-full">Save Opening Cash</LoadingButton>
        </form>
      </BaseModal>

      <BaseModal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title="Close Day">
        <form onSubmit={handleCloseDay} className="space-y-4">
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <p>Date: <strong>{selectedDate}</strong></p>
            <p>Opening: <strong>{formatMoney(today?.openingCash)}</strong></p>
            <p>Cash In: <strong className="text-green-700">{formatMoney(today?.cashIn)}</strong></p>
            <p>Cash Out: <strong className="text-red-700">{formatMoney(today?.cashOut)}</strong></p>
            <p className="border-t pt-2">Expected Cash: <strong className="text-lg">{formatMoney(today?.expectedCash)}</strong></p>
          </div>
          <div>
            <label className="text-sm font-medium">Actual Cash Counted *</label>
            <Input type="number" min="0" step="0.01" value={actualCash} onChange={(e) => setActualCash(e.target.value)} required />
          </div>
          {closePreview && actualCash !== '' && (
            <div className={`flex items-center gap-2 text-sm p-2 rounded ${closePreview.varianceType === 'exact' ? 'bg-green-50 text-green-800' : closePreview.varianceType === 'short' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {closePreview.varianceType === 'exact' && 'Balanced — no variance'}
              {closePreview.varianceType === 'short' && `Shortage: ${formatMoney(closePreview.varianceAmount)}`}
              {closePreview.varianceType === 'over' && `Overage: ${formatMoney(closePreview.varianceAmount)}`}
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Notes</label>
            <Textarea value={notesClose} onChange={(e) => setNotesClose(e.target.value)} rows={2} />
          </div>
          <LoadingButton type="submit" loading={closing} className="w-full">Close Day</LoadingButton>
        </form>
      </BaseModal>

      <BaseModal isOpen={showWithdrawModal} onClose={() => setShowWithdrawModal(false)} title="Cash Withdrawal">
        <form onSubmit={handleWithdraw} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Amount *</label>
            <Input type="number" min="0.01" step="0.01" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input value={withdrawDesc} onChange={(e) => setWithdrawDesc(e.target.value)} placeholder="Safe drop, bank deposit, etc." />
          </div>
          <LoadingButton type="submit" loading={withdrawing} className="w-full">
            <ArrowDownCircle className="h-4 w-4 mr-1" /> Record Withdrawal
          </LoadingButton>
        </form>
      </BaseModal>

      <BaseModal isOpen={showAdjustModal} onClose={() => setShowAdjustModal(false)} title="Manual Cash Adjustment">
        <form onSubmit={handleAdjust} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Direction *</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={adjustDirection}
              onChange={(e) => setAdjustDirection(e.target.value)}
            >
              <option value="in">Cash In (positive adjustment)</option>
              <option value="out">Cash Out (negative adjustment)</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Amount *</label>
            <Input type="number" min="0.01" step="0.01" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input value={adjustDesc} onChange={(e) => setAdjustDesc(e.target.value)} placeholder="Reason for adjustment" />
          </div>
          <LoadingButton type="submit" loading={adjusting} className="w-full">Record Adjustment</LoadingButton>
        </form>
      </BaseModal>
    </PageLayout>
  );
}

function ReportTable({ loading, columns, rows }) {
  if (loading) return <LoadingPage message="Loading report..." />;
  if (!rows.length) return <p className="text-muted-foreground text-sm py-8 text-center">No records for the selected period.</p>;
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>{columns.map((c) => <th key={c} className="p-2 text-left whitespace-nowrap">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t">{row.map((cell, j) => <td key={j} className="p-2 whitespace-nowrap">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DailyCashClosing;
