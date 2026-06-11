import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Wallet,
  Lock,
  Unlock,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import BaseModal from '../components/BaseModal';
import DateFilter from '../components/DateFilter';
import { PageHeader } from '../components/layout/PageHeader';
import { PageLayout } from '../components/layout/PageLayout';
import { LoadingPage, LoadingButton } from '../components/LoadingSpinner';
import {
  useGetCurrentTillQuery,
  useGetTillSessionsQuery,
  useGetTillMovementsReportQuery,
  useGetTillDailySummaryQuery,
  useGetTillCashierSummaryQuery,
  useGetTillVarianceReportQuery,
  useOpenTillMutation,
  useCloseTillMutation,
  useWithdrawFromTillMutation,
} from '../store/services/tillsApi';
import { MOVEMENT_TYPE_LABELS, calculateTillDifference } from '../utils/tillCalculations';
import { getCurrentDatePakistan, getDateDaysAgo } from '../utils/dateUtils';

const TABS = [
  { id: 'session', label: 'Current Session' },
  { id: 'history', label: 'Session History' },
  { id: 'movements', label: 'Movements' },
  { id: 'daily', label: 'Daily Summary' },
  { id: 'cashier', label: 'Cashier Report' },
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

export function TillManagement() {
  const [activeTab, setActiveTab] = useState('session');
  const [fromDate, setFromDate] = useState(getDateDaysAgo(7));
  const [toDate, setToDate] = useState(getCurrentDatePakistan());
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [notesOpen, setNotesOpen] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [notesClose, setNotesClose] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawDesc, setWithdrawDesc] = useState('');

  const { data: currentRes, isLoading: currentLoading, refetch: refetchCurrent } = useGetCurrentTillQuery(undefined, {
    pollingInterval: 15000,
    skipPollingIfUnfocused: true,
  });
  const current = currentRes?.data;

  const reportParams = useMemo(() => ({ fromDate, toDate }), [fromDate, toDate]);
  const { data: sessionsRes, isLoading: sessionsLoading } = useGetTillSessionsQuery(
    { ...reportParams, limit: 100 },
    { skip: activeTab !== 'history' }
  );
  const { data: movementsRes, isLoading: movementsLoading } = useGetTillMovementsReportQuery(
    { ...reportParams, limit: 300 },
    { skip: activeTab !== 'movements' }
  );
  const { data: dailyRes, isLoading: dailyLoading } = useGetTillDailySummaryQuery(reportParams, { skip: activeTab !== 'daily' });
  const { data: cashierRes, isLoading: cashierLoading } = useGetTillCashierSummaryQuery(reportParams, { skip: activeTab !== 'cashier' });
  const { data: varianceRes, isLoading: varianceLoading } = useGetTillVarianceReportQuery(reportParams, { skip: activeTab !== 'variance' });

  const [openTill, { isLoading: opening }] = useOpenTillMutation();
  const [closeTill, { isLoading: closing }] = useCloseTillMutation();
  const [withdraw, { isLoading: withdrawing }] = useWithdrawFromTillMutation();

  const closePreview = useMemo(() => {
    if (!current) return null;
    const expected = Number(current.expectedCash ?? current.expectedAmount ?? 0);
    const actual = parseFloat(actualCash) || 0;
    return calculateTillDifference(actual, expected);
  }, [current, actualCash]);

  const handleOpenTill = async (e) => {
    e.preventDefault();
    const amount = parseFloat(openingAmount);
    if (Number.isNaN(amount) || amount < 0) {
      toast.error('Enter a valid opening cash amount');
      return;
    }
    try {
      await openTill({ openingAmount: amount, notesOpen }).unwrap();
      toast.success('Till opened successfully');
      setShowOpenModal(false);
      setOpeningAmount('');
      setNotesOpen('');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to open till');
    }
  };

  const handleCloseTill = async (e) => {
    e.preventDefault();
    const amount = parseFloat(actualCash);
    if (Number.isNaN(amount) || amount < 0) {
      toast.error('Enter the actual cash counted');
      return;
    }
    try {
      const result = await closeTill({ closingDeclaredAmount: amount, notesClose }).unwrap();
      const vType = result?.data?.varianceType;
      if (vType === 'short') toast.warning(`Till closed with shortage of ${formatMoney(result?.data?.varianceAmount)}`);
      else if (vType === 'over') toast.info(`Till closed with overage of ${formatMoney(result?.data?.varianceAmount)}`);
      else toast.success('Till closed — cash balanced exactly');
      setShowCloseModal(false);
      setActualCash('');
      setNotesClose('');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to close till');
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
      await withdraw({ amount, description: withdrawDesc }).unwrap();
      toast.success('Cash withdrawal recorded');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setWithdrawDesc('');
      refetchCurrent();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to record withdrawal');
    }
  };

  if (currentLoading && !current) {
    return <LoadingPage message="Loading till session..." />;
  }

  return (
    <PageLayout>
      <PageHeader
        title="Till Management"
        description="Open and close cashier sessions, track cash movements, and review variances."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchCurrent()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            {!current && (
              <Button size="sm" onClick={() => setShowOpenModal(true)}>
                <Unlock className="h-4 w-4 mr-1" /> Open Till
              </Button>
            )}
            {current && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowWithdrawModal(true)}>
                  <ArrowUpCircle className="h-4 w-4 mr-1" /> Withdraw
                </Button>
                <Button variant="destructive" size="sm" onClick={() => {
                  setActualCash(String(current.expectedCash ?? ''));
                  setShowCloseModal(true);
                }}>
                  <Lock className="h-4 w-4 mr-1" /> Close Till
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

      {(activeTab !== 'session') && (
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

      {activeTab === 'session' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Current Session</h2>
              {current ? (
                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">Open</span>
              ) : (
                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">Closed</span>
              )}
            </div>
            {!current ? (
              <p className="text-muted-foreground text-sm">No till session is open. Open the till with your opening float before processing cash transactions.</p>
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted-foreground">Opened</dt><dd className="font-medium">{formatDateTime(current.openedAt)}</dd></div>
                <div><dt className="text-muted-foreground">Opening Cash</dt><dd className="font-medium">{formatMoney(current.openingAmount)}</dd></div>
                <div><dt className="text-muted-foreground">Cash In</dt><dd className="font-medium text-green-700">{formatMoney(current.cashIn)}</dd></div>
                <div><dt className="text-muted-foreground">Cash Out</dt><dd className="font-medium text-red-700">{formatMoney(current.cashOut)}</dd></div>
                <div className="col-span-2 border-t pt-3">
                  <dt className="text-muted-foreground">Expected Cash in Drawer</dt>
                  <dd className="text-2xl font-bold">{formatMoney(current.expectedCash)}</dd>
                </div>
              </dl>
            )}
          </div>

          {current?.movements?.length > 0 && (
            <div className="rounded-lg border bg-card p-4 shadow-sm overflow-auto max-h-[420px]">
              <h3 className="font-semibold mb-3">Today&apos;s Movements</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-2">Time</th>
                    <th className="pb-2 pr-2">Type</th>
                    <th className="pb-2 pr-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(current.movements || [])].reverse().map((m) => (
                    <tr key={m.id} className="border-b border-muted/50">
                      <td className="py-2 pr-2 whitespace-nowrap">{formatDateTime(m.created_at || m.createdAt)}</td>
                      <td className="py-2 pr-2">{MOVEMENT_TYPE_LABELS[m.movement_type] || m.movement_type}</td>
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

      {activeTab === 'history' && (
        <div className="rounded-lg border overflow-x-auto">
          {sessionsLoading ? <LoadingPage message="Loading sessions..." /> : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">Cashier</th>
                  <th className="p-2 text-left">Opened</th>
                  <th className="p-2 text-left">Closed</th>
                  <th className="p-2 text-right">Opening</th>
                  <th className="p-2 text-right">Expected</th>
                  <th className="p-2 text-right">Actual</th>
                  <th className="p-2 text-center">Variance</th>
                  <th className="p-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {(sessionsRes?.data || []).map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-2">{s.cashierName || '—'}</td>
                    <td className="p-2">{formatDateTime(s.openedAt)}</td>
                    <td className="p-2">{formatDateTime(s.closedAt)}</td>
                    <td className="p-2 text-right">{formatMoney(s.openingAmount)}</td>
                    <td className="p-2 text-right">{formatMoney(s.expectedCash ?? s.expectedAmount)}</td>
                    <td className="p-2 text-right">{formatMoney(s.closingDeclaredAmount)}</td>
                    <td className="p-2 text-center">
                      {s.varianceType && s.varianceType !== 'exact' ? (
                        <span className={s.varianceType === 'short' ? 'text-red-600' : 'text-amber-600'}>
                          {s.varianceType === 'short' ? 'Short' : 'Over'} {formatMoney(s.varianceAmount)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-2 text-center capitalize">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'movements' && (
        <ReportTable
          loading={movementsLoading}
          columns={['Date', 'Cashier', 'Type', 'Direction', 'Amount', 'Reference', 'Description']}
          rows={(movementsRes?.data || []).map((m) => [
            formatDateTime(m.created_at),
            m.cashier_name || '—',
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
          columns={['Date', 'Sessions', 'Open', 'Closed', 'Opening', 'Expected', 'Actual', 'Shortage', 'Overage']}
          rows={(dailyRes?.data || []).map((r) => [
            r.session_date,
            r.session_count,
            r.open_count,
            r.closed_count,
            formatMoney(r.total_opening),
            formatMoney(r.total_expected),
            formatMoney(r.total_actual),
            formatMoney(r.total_shortage),
            formatMoney(r.total_overage),
          ])}
        />
      )}

      {activeTab === 'cashier' && (
        <ReportTable
          loading={cashierLoading}
          columns={['Cashier', 'Sessions', 'Opening', 'Expected', 'Actual', 'Shortage', 'Overage']}
          rows={(cashierRes?.data || []).map((r) => [
            r.cashier_name || r.user_id,
            r.session_count,
            formatMoney(r.total_opening),
            formatMoney(r.total_expected),
            formatMoney(r.total_actual),
            formatMoney(r.total_shortage),
            formatMoney(r.total_overage),
          ])}
        />
      )}

      {activeTab === 'variance' && (
        <ReportTable
          loading={varianceLoading}
          columns={['Cashier', 'Closed', 'Expected', 'Actual', 'Type', 'Amount', 'Notes']}
          rows={(varianceRes?.data || []).map((r) => [
            r.cashierName || r.cashier_name || '—',
            formatDateTime(r.closedAt || r.closed_at),
            formatMoney(r.expectedCash ?? r.expected_amount),
            formatMoney(r.closingDeclaredAmount ?? r.closing_declared_amount),
            r.varianceType || r.variance_type,
            formatMoney(r.varianceAmount ?? r.variance_amount),
            r.notesClose || r.notes_close || '—',
          ])}
        />
      )}

      <BaseModal isOpen={showOpenModal} onClose={() => setShowOpenModal(false)} title="Open Till">
        <form onSubmit={handleOpenTill} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Opening Cash *</label>
            <Input type="number" min="0" step="0.01" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <Textarea value={notesOpen} onChange={(e) => setNotesOpen(e.target.value)} rows={2} />
          </div>
          <LoadingButton type="submit" loading={opening} className="w-full">Open Till Session</LoadingButton>
        </form>
      </BaseModal>

      <BaseModal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title="Close Till">
        <form onSubmit={handleCloseTill} className="space-y-4">
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <p>Opening: <strong>{formatMoney(current?.openingAmount)}</strong></p>
            <p>Cash In: <strong className="text-green-700">{formatMoney(current?.cashIn)}</strong></p>
            <p>Cash Out: <strong className="text-red-700">{formatMoney(current?.cashOut)}</strong></p>
            <p className="border-t pt-2">Expected Cash: <strong className="text-lg">{formatMoney(current?.expectedCash)}</strong></p>
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
            <label className="text-sm font-medium">Closing Notes</label>
            <Textarea value={notesClose} onChange={(e) => setNotesClose(e.target.value)} rows={2} />
          </div>
          <LoadingButton type="submit" loading={closing} className="w-full">Close Till Session</LoadingButton>
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

export default TillManagement;
