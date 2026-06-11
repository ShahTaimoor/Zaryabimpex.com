import React from 'react';
import { Link } from 'react-router-dom';
import { Wallet, AlertCircle } from 'lucide-react';
import { useGetCurrentTillQuery } from '../../store/services/tillsApi';
import { useCompanyInfo } from '../../hooks/useCompanyInfo';
import { useAuth } from '../../contexts/AuthContext';
import { isTillRequiredForUser } from '../../utils/tillEnforcement';

export function TillSessionBar() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { companyInfo } = useCompanyInfo();
  const orderSettings = companyInfo?.orderSettings || {};
  const tillRequired = isTillRequiredForUser(orderSettings, user?.role);

  const { data, isLoading } = useGetCurrentTillQuery(undefined, {
    pollingInterval: 15000,
    skipPollingIfUnfocused: true,
    skip: !tillRequired,
  });

  const session = data?.data;

  if (!tillRequired) {
    return null;
  }

  if (isLoading) return null;

  if (!session) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Shop till is not open.</span>
        {isAdmin ? (
          <>
            <Link to="/till" className="font-medium underline ml-1">Open till</Link>
            <span className="text-amber-700">to start cash transactions.</span>
          </>
        ) : (
          <span className="text-amber-700">Ask an administrator to open the till.</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 mb-3 rounded-lg border border-green-200 bg-green-50 text-sm">
      <span className="flex items-center gap-1.5 font-medium text-green-900">
        <Wallet className="h-4 w-4" /> Till Open
      </span>
      <span className="text-green-800">Opening: <strong>{Math.round(session.openingAmount || 0).toLocaleString()}</strong></span>
      <span className="text-green-800">In: <strong>{Math.round(session.cashIn || 0).toLocaleString()}</strong></span>
      <span className="text-green-800">Out: <strong>{Math.round(session.cashOut || 0).toLocaleString()}</strong></span>
      <span className="text-green-900">Expected: <strong className="text-base">{Math.round(session.expectedCash || 0).toLocaleString()}</strong></span>
      {isAdmin && (
        <Link to="/till" className="ml-auto text-green-700 underline text-xs">Manage</Link>
      )}
    </div>
  );
}

export default TillSessionBar;
