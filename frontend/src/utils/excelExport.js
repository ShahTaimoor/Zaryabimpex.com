import axios from 'axios';
import { toast } from 'sonner';

/**
 * Reusable utility to trigger Excel export from the backend
 * @param {Object} payload - The data configuration for the export
 * @param {string} payload.title - Document title
 * @param {Array} payload.columns - Column definitions
 * @param {Array} payload.data - The actual data rows
 * @param {Object} payload.summary - Subtotal, Discount, Total
 * @param {string} payload.filename - Name of the file to save
 */
export const exportToExcel = async (payload) => {
    const toastId = toast.loading(`Preparing ${payload.filename || 'Excel file'}...`);
    
    try {
        const storedToken = localStorage.getItem('authToken');
        const apiBase = import.meta.env.VITE_API_URL 
            ? import.meta.env.VITE_API_URL.replace(/\/$/, '') 
            : 'http://localhost:5000/api';
            
        const response = await axios.post(`${apiBase}/excel-manager/generate`, payload, {
            responseType: 'blob',
            withCredentials: true,
            headers: storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {}
        });

        // Create a download link for the blob
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', payload.filename || 'export.xlsx');
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('Download started successfully', { id: toastId });
    } catch (error) {
        console.error('Export Error:', error);
        const errorMessage = error.response?.data?.message || 'Failed to download Excel file';
        toast.error(errorMessage, { id: toastId });
    }
};

/**
 * Example usage pattern for an Invoice:
 * 
 * const handleExport = () => {
 *   exportToExcel({
 *     title: 'Sales Invoice',
 *     filename: `Invoice_${invoiceNo}.xlsx`,
 *     columns: [
 *       { header: 'Product', key: 'name', width: 35 },
 *       { header: 'Qty', key: 'qty', width: 10, type: 'number' },
 *       { header: 'Price', key: 'price', width: 15, type: 'currency' },
 *       { header: 'Total', key: 'total', width: 20, type: 'currency' }
 *     ],
 *     data: items.map(item => ({
 *       name: item.productName,
 *       qty: item.quantity,
 *       price: item.unitPrice,
 *       total: item.subtotal
 *     })),
 *     summary: {
 *       subtotal: totalSubtotal,
 *       discount: totalDiscount,
 *       total: grandTotal
 *     }
 *   });
 * };
 */

/**
 * Handle Excel file upload and parsing
 * @param {File} file - The file from input
 * @returns {Promise<Array>} - The parsed JSON data
 */
export const importExcelFile = async (file) => {
    const formData = new FormData();
    formData.append('excelFile', file);

    const toastId = toast.loading('Parsing Excel file...');
    try {
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
        toast.success(`Successfully parsed ${response.data.length} rows`, { id: toastId });
        return response.data;
    } catch (error) {
        console.error('Import Error:', error);
        toast.error('Failed to parse Excel file', { id: toastId });
        throw error;
    }
};

/**
 * Generate a template Excel file
 * @param {Object} payload - Template configuration
 */
export const exportTemplate = async (payload) => {
    return exportToExcel({
        ...payload,
        data: [], // Empty data for template
        summary: null
    });
};
