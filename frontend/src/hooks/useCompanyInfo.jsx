import { useFetchCompanyQuery } from '../store/services/companyApi';
import { useGetCompanySettingsQuery } from '../store/services/settingsApi';

/**
 * Merged company info: Company API (name, phone, address, logo) + Settings (printSettings, email, etc.)
 * Use for invoices, print, dashboard. Logo and profile come from Company API when available.
 */
export const useCompanyInfo = (options = {}) => {
  const companyQuery = useFetchCompanyQuery(undefined, { ...options });
  const settingsQuery = useGetCompanySettingsQuery(undefined, { ...options });

  const companyData = companyQuery.data?.data || {};
  const settingsData = settingsQuery.data?.data || {};

  const companyInfo = {
    ...settingsData,
    ...companyData,
    companyName: companyData.companyName ?? settingsData.companyName,
    address: companyData.address ?? settingsData.address,
    phone: companyData.phone ?? companyData.phone,
    contactNumber: companyData.phone ?? settingsData.contactNumber,
    logo: companyData.logo ?? settingsData.logo,
  };

  const isLoading = companyQuery.isLoading || settingsQuery.isLoading;
  const isFetching = companyQuery.isFetching || settingsQuery.isFetching;
  const refetch = () => {
    companyQuery.refetch();
    settingsQuery.refetch();
  };

  return {
    ...settingsQuery,
    companyInfo,
    isLoading,
    isFetching,
    refetch,
    companyQuery,
    settingsQuery,
  };
};
