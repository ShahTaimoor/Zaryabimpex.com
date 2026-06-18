import { useEffect } from 'react';
import { useGetCompanySettingsQuery } from '../store/services/settingsApi';
import { setFormatMode, normalizeMode, TEXT_FORMAT_DEFAULT } from '../utils/textFormat';

/**
 * Hook that reads the global text-formatting mode from company settings and
 * keeps the in-memory cache in sync. Place once at the App root (or any
 * component that is always mounted) so toTitleCase/formatText always reflects
 * the latest user preference.
 *
 * Returns { mode, isLoading } for UI that needs to display the current mode.
 */
export function useTextFormatMode() {
  const { data: settingsResponse, isLoading } = useGetCompanySettingsQuery();
  const settings = settingsResponse?.data || settingsResponse;
  const mode = normalizeMode(settings?.textFormatSettings?.mode);

  useEffect(() => {
    setFormatMode(mode);
  }, [mode]);

  return { mode, isLoading };
}

export default useTextFormatMode;
