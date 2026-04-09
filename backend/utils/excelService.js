const ExcelJS = require('exceljs');

/**
 * Generates a professionally styled Excel report/invoice
 * @param {Object} options 
 * @param {string} options.title - The main title of the document
 * @param {Object} options.company - Company details (name, address, contact)
 * @param {Object} options.customer - Customer details
 * @param {Array} options.columns - Table column definitions { header, key, width, style }
 * @param {Array} options.data - Array of data objects
 * @param {Object} options.summary - Summary rows (subtotal, tax, grand total)
 * @returns {Promise<ExcelJS.Workbook>}
 */
const generateStyledExcel = async ({
    title = 'INVOICE',
    company = {
        name: 'ZARYAB IMPEX',
        address: '123 Business Road, City, Country',
        contact: '+123 456 7890 | info@zaryabimpex.com'
    },
    customer = null,
    columns = [],
    data = [],
    summary = {}
}) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(title);

    // 1. Company Header (Merged Cells)
    worksheet.mergeCells('A1:D1');
    const companyNameCell = worksheet.getCell('A1');
    companyNameCell.value = company.name;
    companyNameCell.font = { name: 'Arial Black', size: 18, bold: true, color: { argb: 'FF1F4E78' } };
    companyNameCell.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.mergeCells('A2:D2');
    const addressCell = worksheet.getCell('A2');
    addressCell.value = company.address;
    addressCell.font = { size: 10, color: { argb: 'FF595959' } };
    addressCell.alignment = { horizontal: 'center' };

    worksheet.mergeCells('A3:D3');
    const contactCell = worksheet.getCell('A3');
    contactCell.value = company.contact;
    contactCell.font = { size: 10, italic: true };
    contactCell.alignment = { horizontal: 'center' };

    // Space after header
    worksheet.addRow([]);

    // 2. Document Title
    worksheet.mergeCells('A5:D5');
    const titleCell = worksheet.getCell('A5');
    titleCell.value = title.toUpperCase();
    titleCell.font = { size: 16, bold: true, underline: true };
    titleCell.alignment = { horizontal: 'center' };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' }
    };

    worksheet.addRow([]); // Space

    // 3. Customer Info (if available)
    if (customer) {
        worksheet.addRow(['Bill To:', customer.name || 'N/A']);
        worksheet.addRow(['Address:', customer.address || 'N/A']);
        worksheet.addRow(['Contact:', customer.contact || 'N/A']);
        worksheet.getRow(worksheet.lastRow.number - 2).font = { bold: true };
        worksheet.addRow([]); // Space
    }

    // 4. Table Header
    const headerRow = worksheet.addRow(columns.map(col => col.header));
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1F4E78' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // 5. Data Rows
    data.forEach(item => {
        const rowData = columns.map(col => {
            const key = col.key;
            // Try different variants: Original, snake_case, camelCase, lowercase
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            const camelKey = key.replace(/([-_][a-z])/g, group => group.toUpperCase().replace('-', '').replace('_', ''));
            
            let value = item[key];
            if (value === undefined || value === null) value = item[snakeKey];
            if (value === undefined || value === null) value = item[camelKey];
            if (value === undefined || value === null) value = item[key.toLowerCase()];
            
            // Final Cleanup: Convert null/undefined to empty string
            // Also strip "UNKNOWN", "N/A", "UNDEFINED" which might be in the database
            if (value === null || value === undefined) {
                value = '';
            } else if (typeof value === 'string') {
                const upperVal = value.toUpperCase();
                if (upperVal === 'UNKNOWN' || upperVal === 'N/A' || upperVal === 'UNDEFINED' || upperVal === '-') {
                    value = '';
                }
            }
            
            return value;
        });
        const row = worksheet.addRow(rowData);
        row.eachCell((cell, colNumber) => {
            const colDef = columns[colNumber - 1];
            // Formatting based on column type
            if (colDef.type === 'currency') {
                cell.numFmt = '#,##0.00';
                cell.alignment = { horizontal: 'right' };
            } else if (colDef.type === 'number') {
                cell.alignment = { horizontal: 'center' };
            }
            
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
    });

    // 6. Summary Section
    worksheet.addRow([]); // Space
    
    // 6. Summary Section
    worksheet.addRow([]); // Space

    if (summary) {
        // Handle legacy top-level summary keys (subtotal, discount, total)
        if (summary.subtotal !== undefined) {
            const row = worksheet.addRow(['', '', 'Subtotal:', summary.subtotal]);
            row.font = { bold: true };
            worksheet.getCell(`D${row.number}`).numFmt = '#,##0.00';
        }
        if (summary.discount !== undefined) {
            const row = worksheet.addRow(['', '', 'Discount:', summary.discount]);
            row.font = { color: { argb: 'FFFF0000' } };
            worksheet.getCell(`D${row.number}`).numFmt = '#,##0.00';
        }
        
        // Handle dynamic summaryRows (preferred for complex reports)
        const rowsToProcess = summary.rows || [];
        if (summary.total !== undefined && !summary.rows) {
            // Support legacy 'total' as single row if 'rows' is not provided
            rowsToProcess.push({ label: 'GRAND TOTAL:', total: summary.total });
        }

        rowsToProcess.forEach(summaryRow => {
            const rowData = columns.map(col => summaryRow[col.key] ?? '');
            
            // Find a place for the label (usually first empty cell before the first value)
            const firstValueIdx = columns.findIndex(col => summaryRow[col.key] !== undefined);
            if (firstValueIdx > 0) {
                rowData[firstValueIdx - 1] = summaryRow.label || 'TOTAL:';
            } else if (firstValueIdx === 0) {
                // If the first column has a value, just prepend label if there's space elsewhere?
                // For now, let's just use the label if provided
            }

            const row = worksheet.addRow(rowData);
            row.height = summaryRow.label?.includes('GRAND') ? 25 : 20;
            
            row.eachCell((cell, colNumber) => {
                const colDef = columns[colNumber - 1];
                const isValue = summaryRow[colDef.key] !== undefined;
                const isLabel = (colNumber === firstValueIdx); // simplified

                if (isValue || cell.value === summaryRow.label) {
                    cell.font = { bold: true, size: 11 };
                    if (summaryRow.label?.includes('GRAND')) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFC00000' } // Red for Grand Total
                        };
                        cell.font.color = { argb: 'FFFFFFFF' };
                    } else {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF2F2F2' }
                        };
                    }

                    if (colDef.type === 'currency' && isValue) {
                        cell.numFmt = '#,##0.00';
                        cell.alignment = { horizontal: 'right' };
                    } else {
                        cell.alignment = { horizontal: 'right' };
                    }
                }
            });
        });
    }

    // Set Column Widths
    columns.forEach((col, i) => {
        worksheet.getColumn(i + 1).width = col.width || 15;
    });

    return workbook;
};

module.exports = { generateStyledExcel };
