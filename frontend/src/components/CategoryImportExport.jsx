import React, { useState } from 'react';
import { 
  Download, 
  Upload, 
  FileText, 
  FileSpreadsheet, 
  AlertCircle,
  CheckCircle,
  X,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Database
} from 'lucide-react';
import {
  useExportCategoriesCSVMutation,
  useExportCategoriesExcelMutation,
  useImportCategoriesExcelMutation,
  useImportCategoriesCSVMutation,
  useLazyDownloadCategoryTemplateQuery,
  categoriesApi,
} from '../store/services/categoriesApi';
import { useAppDispatch } from '../store/hooks';
import { LoadingButton } from './LoadingSpinner';
import { handleApiError, showSuccessToast, showErrorToast, showWarningToast } from '../utils/errorHandler';
import toast from 'react-hot-toast';
import { validateFile } from '../utils/validation';

const CategoryImportExport = ({ onImportComplete, filters = {} }) => {
  const dispatch = useAppDispatch();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState('csv');

  const [exportCSV] = useExportCategoriesCSVMutation();
  const [exportExcel] = useExportCategoriesExcelMutation();
  const [importExcel] = useImportCategoriesExcelMutation();
  const [importCSV] = useImportCategoriesCSVMutation();
  
  const [downloadTemplateTrigger] = useLazyDownloadCategoryTemplateQuery();
  
  const downloadTemplate = async () => {
    try {
      const result = await downloadTemplateTrigger().unwrap();
      return result;
    } catch (error) {
      const result = await downloadTemplateTrigger();
      return result.data || result;
    }
  };
  
  const downloadFile = async (filename) => {
    // Note: This assumes a generic download endpoint exists or we handle the blob directly from export mutations
    // For categories, we'll try to handle the blob directly if the API returns it
    return null; 
  };

  const handleExportCSV = async (isAll = false) => {
    try {
      setIsExporting(true);
      const exportFilters = isAll ? {} : filters;
      const response = await exportCSV(exportFilters).unwrap();
      
      const blob = new Blob([response], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const filename = `categories_export_${new Date().getTime()}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showSuccessToast(`Categories exported to CSV`);
    } catch (error) {
      handleApiError(error, 'CSV Export');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async (isAll = false) => {
    try {
      setIsExporting(true);
      const exportFilters = isAll ? {} : filters;
      const response = await exportExcel(exportFilters).unwrap();
      
      const blob = new Blob([response], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const filename = `categories_export_${new Date().getTime()}.xlsx`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showSuccessToast(`Categories exported to Excel`);
    } catch (error) {
      handleApiError(error, 'Excel Export');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      const fileError = validateFile(file, {
        allowedTypes: validTypes,
        maxSizeInMB: 10,
        required: true
      });
      
      if (fileError) {
        showErrorToast(fileError);
        event.target.value = '';
        return;
      }
      
      setImportFile(file);
      setImportType(file.type.includes('csv') ? 'csv' : 'excel');
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Please select a file to import');
      return;
    }

    try {
      setIsImporting(true);
      const response = importType === 'csv' 
        ? await importCSV(importFile).unwrap()
        : await importExcel(importFile).unwrap();
      
      setImportResults(response.results || response.data?.results);
      
      const results = response.results || response.data?.results;
      if (results?.success > 0) {
        showSuccessToast(`Successfully imported ${results.success} categories`);
        if (onImportComplete) {
          onImportComplete();
        }
      }
      
      if (results?.errors?.length > 0) {
        showWarningToast(`${results.errors.length} categories failed to import`);
      }
      
    } catch (error) {
      handleApiError(error, 'Category Import');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await downloadTemplate();
      const blob = new Blob([response], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'category_template.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div 
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <Database className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
          <span className="text-sm sm:text-base font-medium text-gray-900">Import / Export Categories</span>
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowImportModal(true);
            }}
            className="btn btn-primary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import Categories</span>
            <span className="sm:hidden">Import</span>
          </button>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4">
            <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-center mb-2 sm:mb-3">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mr-2" />
                <h4 className="text-sm sm:text-base font-medium text-gray-900">Export to CSV</h4>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mb-3">
                Export categories to a CSV file for backup or analysis.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <LoadingButton
                  onClick={() => handleExportCSV(false)}
                  isLoading={isExporting}
                  className="btn btn-secondary btn-md flex items-center justify-center gap-2 flex-1"
                >
                  <Download className="h-4 w-4" />
                  Export Filtered
                </LoadingButton>
                <LoadingButton
                  onClick={() => handleExportCSV(true)}
                  isLoading={isExporting}
                  className="btn btn-primary btn-md flex items-center justify-center gap-2 flex-1"
                >
                  <Download className="h-4 w-4" />
                  Export All
                </LoadingButton>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-center mb-2 sm:mb-3">
                <FileSpreadsheet className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mr-2" />
                <h4 className="text-sm sm:text-base font-medium text-gray-900">Export to Excel</h4>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mb-3">
                Export categories to an Excel file with formatting.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <LoadingButton
                  onClick={() => handleExportExcel(false)}
                  isLoading={isExporting}
                  className="btn btn-secondary btn-md flex items-center justify-center gap-2 flex-1"
                >
                  <Download className="h-4 w-4" />
                  Export Filtered
                </LoadingButton>
                <LoadingButton
                  onClick={() => handleExportExcel(true)}
                  isLoading={isExporting}
                  className="btn btn-primary btn-md flex items-center justify-center gap-2 flex-1"
                >
                  <Download className="h-4 w-4" />
                  Export All
                </LoadingButton>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-start">
              <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mr-2 sm:mr-3 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h4 className="text-sm sm:text-base font-medium text-blue-900 mb-2">Import Guidelines</h4>
                <ul className="text-xs sm:text-sm text-blue-800 space-y-1">
                  <li>• Download the template to see the required format</li>
                  <li>• Required fields: Category Name</li>
                  <li>• Optional fields: Description, Parent Category Name, Sort Order</li>
                  <li>• Supported formats: CSV, Excel (.xlsx)</li>
                  <li>• Categories with duplicate names will be skipped</li>
                </ul>
                <button
                  onClick={handleDownloadTemplate}
                  className="btn btn-primary btn-md flex items-center justify-center gap-2 mt-3"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Import Categories</h3>
              <button onClick={resetImport} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {!importResults ? (
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select File</label>
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="input w-full" />
                  </div>

                  {importFile && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 text-gray-600 mr-2" />
                        <span className="text-sm text-gray-700">{importFile.name}</span>
                        <span className="text-xs text-gray-500 ml-auto">
                          {(importFile.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                    <button onClick={resetImport} className="btn btn-secondary btn-md w-full sm:w-auto">Cancel</button>
                    <LoadingButton
                      onClick={handleImport}
                      isLoading={isImporting}
                      disabled={!importFile}
                      className="btn btn-primary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                      Import Categories
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
                        <div className="text-lg font-semibold text-green-600">{importResults.success}</div>
                        <div className="text-sm text-green-700">Success</div>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <AlertCircle className="h-6 w-6 text-red-600 mx-auto mb-1" />
                        <div className="text-lg font-semibold text-red-600">{importResults.errors.length}</div>
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
                            <div className="text-sm text-gray-500">... and {importResults.errors.length - 10} more errors</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button onClick={resetImport} className="btn btn-primary btn-md w-full sm:w-auto">Close</button>
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

export default CategoryImportExport;
