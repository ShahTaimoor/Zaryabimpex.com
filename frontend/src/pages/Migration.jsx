import React, { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { useUpdateInvoicePrefixMutation } from '../store/services/migrationApi';

const Migration = () => {
  const [migrationResult, setMigrationResult] = useState(null);
  const [updateInvoicePrefix, { isLoading: isRunning }] = useUpdateInvoicePrefixMutation();

  const handleRunMigration = async () => {
    if (window.confirm('Are you sure you want to update all ORD- invoices to SI- format? This action cannot be undone.')) {
      setMigrationResult(null);
      try {
        const data = await updateInvoicePrefix().unwrap();
        setMigrationResult(data);
        if (data.success) {
          showSuccessToast(data.message);
        } else {
          showErrorToast(data.message);
        }
      } catch (error) {
        handleApiError(error, 'Migration');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoice Prefix Migration</h1>
            <p className="text-gray-600">Update existing ORD- invoices to SI- format</p>
          </div>
          <button
            onClick={handleRunMigration}
            disabled={isRunning}
            className="btn btn-primary flex items-center space-x-2"
          >
            {isRunning ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>{isRunning ? 'Running Migration...' : 'Run Migration'}</span>
          </button>
        </div>

        {migrationResult && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2 mb-4">
              {migrationResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <h3 className="font-semibold text-gray-900">Migration Results</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white p-3 rounded border">
                <div className="text-sm text-gray-600">Total Found</div>
                <div className="text-2xl font-bold text-gray-900">{migrationResult.total || 0}</div>
              </div>
              <div className="bg-white p-3 rounded border">
                <div className="text-sm text-gray-600">Updated</div>
                <div className="text-2xl font-bold text-green-600">{migrationResult.updated || 0}</div>
              </div>
              <div className="bg-white p-3 rounded border">
                <div className="text-sm text-gray-600">Skipped</div>
                <div className="text-2xl font-bold text-yellow-600">{migrationResult.skipped || 0}</div>
              </div>
            </div>
            
            <p className="text-sm text-gray-700 mb-4">{migrationResult.message}</p>
            
            {migrationResult.updates && migrationResult.updates.length > 0 && (
              <div className="bg-white rounded border max-h-64 overflow-y-auto">
                <div className="p-3 border-b bg-gray-50">
                  <h4 className="font-medium text-gray-900">Update Details</h4>
                </div>
                <div className="divide-y">
                  {migrationResult.updates.map((update, index) => (
                    <div key={index} className="p-3 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono text-gray-600">{update.oldNumber}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-sm font-mono text-gray-900">{update.newNumber}</span>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        update.status === 'updated' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {update.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">What this migration does:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Finds all existing invoices with ORD- prefix</li>
            <li>• Updates them to use SI- prefix for consistency</li>
            <li>• Example: ORD-20251004-0001 → SI-20251004-0001</li>
            <li>• Skips any invoices that would create duplicates</li>
            <li>• This action cannot be undone</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Migration;
