import React, { useState } from 'react';
import BaseModal from './BaseModal';
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  AlertCircle,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import {
  useExportCategoriesMutation,
  useImportCategoriesMutation,
  useDownloadCategoryTemplateQuery,
  useLazyDownloadCategoryExportFileQuery,
} from '../store/services/categoriesApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingButton } from './LoadingSpinner';
import { handleApiError, showSuccessToast, showErrorToast, showWarningToast } from '../utils/errorHandler';
import { toast } from 'sonner';

const CategoryImportExport = ({ onImportComplete, filters = {} }) => {
  const [importFile, setImportFile] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  
  const [exportExcel, { isLoading: isExporting }] = useExportCategoriesMutation();
  const [importExcel, { isLoading: isImporting }] = useImportCategoriesMutation();
  const { refetch: downloadTemplate } = useDownloadCategoryTemplateQuery(undefined, { skip: true });
  const [downloadExportFile] = useLazyDownloadCategoryExportFileQuery();

  const handleExportExcel = async () => {
    try {
      const response = await exportExcel(filters).unwrap();
      
      if (response.downloadUrl) {
        const filename = response.filename;
        const fileResponse = await downloadExportFile(filename).unwrap();
        
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
      
      showSuccessToast(`Exported ${response.recordCount || 0} categories to Excel`);
    } catch (error) {
      handleApiError(error, 'Excel Export');
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const validExtensions = ['.xlsx', '.xls'];
      const fileName = file.name.toLowerCase();
      const isValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
      
      if (!isValidExtension) {
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
        showSuccessToast(`Successfully imported ${successCount} categories`);
        if (onImportComplete) {
          onImportComplete();
        }
      }
      
      const errors = response?.results?.errors || response?.errors || [];
      if (errors.length > 0) {
        showWarningToast(`${errors.length} categories failed to import`);
      }
      
    } catch (error) {
      handleApiError(error, 'Category Import');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await downloadTemplate();
      
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'category_template.xlsx');
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
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Import / Export Categories</h3>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="relative group">
            <Button
              onClick={handleDownloadTemplate}
              variant="outline"
              size="default"
              className="flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Template
            </Button>
          </div>
          <div className="relative group">
            <LoadingButton
              onClick={handleExportExcel}
              isLoading={isExporting}
              variant="secondary"
              size="default"
              className="flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </LoadingButton>
          </div>
          <div className="relative group">
            <Button
              onClick={() => setShowImportModal(true)}
              variant="default"
              size="default"
              className="flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Upload className="h-4 w-4" />
              Import Categories
            </Button>
          </div>
        </div>
      </div>

      {showImportModal && (
        <BaseModal
          isOpen={showImportModal}
          onClose={resetImport}
          title="Import Categories"
          maxWidth="md"
          variant="centered"
          contentClassName="p-6"
        >
              {!importResults ? (
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Excel File</label>
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      className="w-full"
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
                    <Button onClick={resetImport} variant="secondary" size="default" className="w-full sm:w-auto">Cancel</Button>
                    <LoadingButton
                      onClick={handleImport}
                      isLoading={isImporting}
                      disabled={!importFile}
                      variant="default"
                      size="default"
                      className="flex items-center justify-center gap-2 w-full sm:w-auto"
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
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={resetImport} variant="default" size="default" className="w-full sm:w-auto">Close</Button>
                  </div>
                </div>
              )}
        </BaseModal>
      )}
    </div>
  );
};

export default CategoryImportExport;
