import React, { useState } from 'react';
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  AlertCircle,
  CheckCircle,
  X,
  HelpCircle
} from 'lucide-react';
import {
  useExportExcelMutation,
  useImportExcelMutation,
  useDownloadTemplateQuery,
  useLazyDownloadExportFileQuery,
} from '../store/services/suppliersApi';
import { LoadingButton } from './LoadingSpinner';
import { handleApiError, showSuccessToast, showErrorToast, showWarningToast } from '../utils/errorHandler';
import toast from 'react-hot-toast';

const SupplierImportExport = ({ onImportComplete, filters = {} }) => {
  const [importFile, setImportFile] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  
  const [exportExcel, { isLoading: isExporting }] = useExportExcelMutation();
  const [importExcel, { isLoading: isImporting }] = useImportExcelMutation();
  const { refetch: downloadTemplate } = useDownloadTemplateQuery(undefined, { skip: true });
  const [downloadExportFile] = useLazyDownloadExportFileQuery();

  const handleExportExcel = async () => {
    try {
      const response = await exportExcel(filters).unwrap();
      
      // Backend returns JSON with downloadUrl, so we need to download the file
      if (response.downloadUrl) {
        const filename = response.filename || 'suppliers.xlsx';
        const fileResponse = await downloadExportFile(filename).unwrap();
        
        // Create blob and download
        const blob = fileResponse instanceof Blob ? fileResponse : new Blob([fileResponse]);
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
      showSuccessToast(`Exported ${response.recordCount || 0} suppliers to Excel`);
    } catch (error) {
      handleApiError(error, 'Excel Export');
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (!validTypes.includes(file.mimetype) && !file.name.match(/\.(xlsx|xls)$/)) {
        showErrorToast('Invalid file type. Only Excel files are allowed.');
        event.target.value = '';
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        showErrorToast('File size exceeds 10MB limit');
        event.target.value = '';
        return;
      }
      
      setImportFile(file);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Please select a file to import');
      return;
    }

    try {
      const response = await importExcel(importFile).unwrap();
      
      setImportResults(response?.results || response);
      
      if (response?.results?.success > 0 || response?.success > 0) {
        const successCount = response?.results?.success || response?.success;
        showSuccessToast(`Successfully imported ${successCount} suppliers`);
        if (onImportComplete) {
          onImportComplete();
        }
      }
      
      const errors = response?.results?.errors || response?.errors || [];
      if (errors.length > 0) {
        showWarningToast(`${errors.length} suppliers failed to import`);
      }
      
    } catch (error) {
      handleApiError(error, 'Supplier Import');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await downloadTemplate();
      
      // Create blob and download
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'supplier_template.xlsx');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showSuccessToast('Template downloaded successfully');
    } catch (error) {
      handleApiError(error, 'Template Download');
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setImportResults(null);
    setShowImportModal(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-3">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Import / Export Suppliers</h3>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="relative group">
            <button
              onClick={handleDownloadTemplate}
              className="btn btn-outline btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Template
            </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
              <div className="text-xs space-y-1">
                <div>• Download Excel template file</div>
                <div>• Pre-formatted with correct columns</div>
                <div>• Shows required and optional fields</div>
                <div>• Use this to prepare import data</div>
              </div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
          <div className="relative group">
            <LoadingButton
              onClick={handleExportExcel}
              isLoading={isExporting}
              className="btn btn-secondary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </LoadingButton>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
              <div className="text-xs space-y-1">
                <div>• Exports all suppliers to Excel file</div>
                <div>• Includes all supplier data and fields</div>
                <div>• File format: Excel (.xlsx)</div>
                <div>• Filtered results based on current search</div>
              </div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
          <div className="relative group">
            <button
              onClick={() => setShowImportModal(true)}
              className="btn btn-primary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Upload className="h-4 w-4" />
              Import Suppliers
            </button>
            <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
              <div className="text-xs space-y-1">
                <div>• Download template for required format</div>
                <div>• Required: Company Name, Contact Person</div>
                <div>• Supported: Excel (.xlsx), Max 10MB</div>
                <div>• Duplicates will be skipped</div>
              </div>
              <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
      </div>


      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Import Suppliers</h3>
              <button
                onClick={resetImport}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {!importResults ? (
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Excel File
                    </label>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      className="input w-full"
                    />
                  </div>

                  {importFile && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <FileSpreadsheet className="h-4 w-4 text-gray-600 mr-2" />
                        <span className="text-sm text-gray-700">{importFile.name}</span>
                        <span className="text-xs text-gray-500 ml-auto">
                          {(importFile.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                    <button
                      onClick={resetImport}
                      className="btn btn-secondary btn-md w-full sm:w-auto"
                    >
                      Cancel
                    </button>
                    <LoadingButton
                      onClick={handleImport}
                      isLoading={isImporting}
                      disabled={!importFile}
                      className="btn btn-primary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                      Import Suppliers
                    </LoadingButton>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-3">Import Results</h4>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
                        <div className="text-lg font-semibold text-green-600">
                          {importResults.success}
                        </div>
                        <div className="text-sm text-green-700">Success</div>
                      </div>
                      
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <AlertCircle className="h-6 w-6 text-red-600 mx-auto mb-1" />
                        <div className="text-lg font-semibold text-red-600">
                          {importResults.errors.length}
                        </div>
                        <div className="text-sm text-red-700">Errors</div>
                      </div>
                    </div>

                    {importResults.errors.length > 0 && (
                      <div className="max-h-40 overflow-y-auto">
                        <h5 className="font-medium text-gray-900 mb-2">Errors:</h5>
                        <div className="space-y-2">
                          {importResults.errors.slice(0, 10).map((error, index) => (
                            <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                              Row {error.row}: {error.error}
                            </div>
                          ))}
                          {importResults.errors.length > 10 && (
                            <div className="text-sm text-gray-500">
                              ... and {importResults.errors.length - 10} more errors
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={resetImport}
                      className="btn btn-primary btn-md w-full sm:w-auto"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierImportExport;

