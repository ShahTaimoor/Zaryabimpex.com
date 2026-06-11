import React from 'react';
import { Navigate } from 'react-router-dom';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { isDailyCashClosingEnabled } from '../utils/dailyCashSettings';
import { LoadingPage } from './LoadingSpinner';

/** Blocks daily-cash routes when the feature is disabled in settings. */
export function DailyCashFeatureRoute({ children }) {
  const { companyInfo, isLoading } = useCompanyInfo();

  if (isLoading) {
    return <LoadingPage message="Loading settings..." />;
  }

  if (!isDailyCashClosingEnabled(companyInfo?.orderSettings)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default DailyCashFeatureRoute;
