import React, { useState } from 'react';
import { FileSpreadsheet, Download } from 'lucide-react';
import { exportToExcel } from '../utils/excelExport';

/**
 * A professional Export button component
 * @param {Object} props
 * @param {Function} props.getData - Function that returns the payload { title, columns, data, summary, filename }
 * @param {string} props.label - Button label
 * @param {string} props.className - Custom CSS classes
 */
const ExcelExportButton = ({ getData, label = "Export to Excel", className = "" }) => {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        try {
            setIsExporting(true);
            const payload = await getData();
            if (!payload) return;
            
            await exportToExcel(payload);
        } catch (error) {
            console.error("Export component error:", error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <button
            onClick={handleExport}
            disabled={isExporting}
            className={`flex items-center ${label ? 'gap-2 px-3 sm:px-4' : 'px-1'} py-2 bg-white border border-gray-200 hover:border-green-500 hover:bg-green-50 text-gray-700 hover:text-green-700 rounded-lg transition-all duration-200 shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group ${className}`}
            title={label || "Export Excel"}
        >
            {isExporting ? (
                <div className="h-4 w-4 border-2 border-green-600/30 border-t-green-600 rounded-full animate-spin" />
            ) : (
                <FileSpreadsheet className="h-4 w-4 text-green-600 group-hover:scale-110 transition-transform" />
            )}
            {label && <span className="text-sm font-semibold tracking-tight">{label}</span>}
            {label && !isExporting && <Download className="h-3.5 w-3.5 ml-1 opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0 transition-all text-green-600" />}
        </button>
    );
};

export default ExcelExportButton;
