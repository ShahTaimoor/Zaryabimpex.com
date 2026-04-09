import React, { useRef, useState } from 'react';
import { FileUp, Upload } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

/**
 * A professional Excel Import button component
 * @param {Object} props
 * @param {Function} props.onDataImported - Callback function when data is successfully parsed
 * @param {string} props.label - Button label
 */
const ExcelImportButton = ({ onDataImported, label = "Import Excel" }) => {
    const fileInputRef = useRef(null);
    const [isImporting, setIsImporting] = useState(false);

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset input so the same file can be selected again
        event.target.value = '';

        const toastId = toast.loading(`Uploading and parsing ${file.name}...`);
        
        const formData = new FormData();
        formData.append('excelFile', file);

        try {
            setIsImporting(true);
            const storedToken = localStorage.getItem('authToken');
            const apiBase = import.meta.env.VITE_API_URL 
                ? import.meta.env.VITE_API_URL.replace(/\/$/, '') 
                : 'http://localhost:5000/api';

            const response = await axios.post(`${apiBase}/excel-manager/import`, formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    ...(storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {})
                },
                withCredentials: true
            });

            const { data, count } = response.data;
            toast.success(`Successfully parsed ${count} rows!`, { id: toastId });
            
            if (onDataImported) {
                onDataImported(data);
            }
        } catch (error) {
            console.error('Import Error:', error);
            const errorMessage = error.response?.data?.message || 'Failed to import Excel file';
            toast.error(errorMessage, { id: toastId });
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="inline-block">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls"
                className="hidden"
            />
            <button
                onClick={handleButtonClick}
                disabled={isImporting}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-gray-700 hover:text-blue-700 rounded-lg transition-all duration-200 shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
                {isImporting ? (
                    <div className="h-4 w-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                ) : (
                    <FileUp className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform" />
                )}
                <span className="text-sm font-semibold tracking-tight">{label}</span>
                {!isImporting && <Upload className="h-3.5 w-3.5 ml-1 opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0 transition-all text-blue-600" />}
            </button>
        </div>
    );
};

export default ExcelImportButton;
