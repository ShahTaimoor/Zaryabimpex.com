import React, { memo, useState, useEffect } from 'react';
import { Type, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetCompanySettingsQuery,
  useUpdateCompanySettingsMutation,
} from '../../store/services/settingsApi';
import { handleApiError } from '../../utils/errorHandler';
import { formatText } from '../../utils/textFormat';

const MODES = [
  {
    value: 'capitalize',
    label: 'Capitalize Each Word',
    example: 'Shah Auto Store',
  },
  {
    value: 'uppercase',
    label: 'UPPERCASE',
    example: 'SHAH AUTO STORE',
  },
  {
    value: 'lowercase',
    label: 'lowercase',
    example: 'shah auto store',
  },
  {
    value: 'sentence',
    label: 'Sentence case',
    example: 'Shah auto store',
  },
];

const PREVIEW_TEXTS = [
  'zaryab impex trading company',
  'city: karachi, country: pakistan',
  'premium quality led light (grp4040)',
  'customer: shah trading corporation',
  'note: urgent delivery required',
];

export const TextFormatSettingsTab = memo(function TextFormatSettingsTab() {
  const { data: settingsResponse, refetch: refetchSettings } = useGetCompanySettingsQuery();
  const settings = settingsResponse?.data || settingsResponse;
  const [updateCompanySettings] = useUpdateCompanySettingsMutation();

  const [mode, setMode] = useState('capitalize');
  const [isSaving, setIsSaving] = useState(false);
  const hasUnsaved = (settings?.textFormatSettings?.mode || 'capitalize') !== mode;

  // Sync from server on mount / refetch
  useEffect(() => {
    if (settings?.textFormatSettings?.mode) {
      setMode(settings.textFormatSettings.mode);
    }
  }, [settings?.textFormatSettings?.mode]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCompanySettings({
        textFormatSettings: { mode },
      }).unwrap();
      toast.success('Text formatting saved! All text across the system will now use this style.');
      refetchSettings();
    } catch (error) {
      handleApiError(error, 'Save Text Formatting');
    } finally {
      setIsSaving(false);
    }
  };

  // For preview: temporarily apply the selected mode
  const previewFormat = (text) => {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (!trimmed) return trimmed;
    switch (mode) {
      case 'uppercase':
        return trimmed.toUpperCase();
      case 'lowercase':
        return trimmed.toLowerCase();
      case 'sentence': {
        const lowered = trimmed.toLowerCase();
        const m = lowered.match(/^(\s*)(\S)/);
        return m ? m[1] + m[2].toUpperCase() + lowered.slice(m[0].length) : lowered;
      }
      case 'capitalize':
      default:
        return trimmed
          .split(' ')
          .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
          .join(' ');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center space-x-2">
          <Type className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Text Formatting</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Choose how text is displayed throughout the system — products, customers,
          suppliers, invoices, reports, receipts, payments, and all other text fields.
        </p>
      </div>
      <div className="card-content">
        <div className="page-container">
          {/* Mode Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MODES.map((m) => {
              const active = mode === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  className={`
                    relative flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 text-left transition-all duration-150
                    ${active
                      ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500/20'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}
                  `}
                >
                  {/* Radio indicator */}
                  <span className={`
                    flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors
                    ${active ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'}
                  `}>
                    {active && <Check className="w-3 h-3 text-white" />}
                  </span>

                  <span className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-800'}`}>
                    {m.label}
                  </span>
                  <span className={`text-base ${active ? 'text-gray-900' : 'text-gray-500'}`}>
                    {m.example}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Live Preview */}
          <div className="mt-5 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Live Preview</h3>
            <div className="space-y-1.5">
              {PREVIEW_TEXTS.map((text, i) => (
                <div key={i} className="flex items-baseline gap-2 text-sm">
                  <span className="text-gray-400 text-xs w-4 text-right flex-shrink-0">{i + 1}.</span>
                  <span className="text-gray-700">{previewFormat(text)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving || !hasUnsaved}
              className={`
                inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all
                ${isSaving || !hasUnsaved
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'}
              `}
            >
              {isSaving ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                  Saving…
                </>
              ) : (
                'Save Formatting'
              )}
            </button>
            {hasUnsaved && (
              <span className="text-xs text-amber-600 font-medium">You have unsaved changes</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default TextFormatSettingsTab;
