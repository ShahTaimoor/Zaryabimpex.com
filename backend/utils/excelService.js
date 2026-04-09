const ExcelJS = require('exceljs');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

/**
 * Fetches image buffer from URL or local file path
 * @param {string} url - Image URL or relative path
 * @returns {Promise<Buffer>}
 */
const getImageBuffer = (url) => {
    return new Promise((resolve, reject) => {
        // Handle relative API paths for local images
        if (url.startsWith('/api/images/')) {
            const fileName = url.replace('/api/images/', '');
            const localPath = path.join(__dirname, '..', 'uploads', 'images', 'optimized', fileName);
            if (fs.existsSync(localPath)) {
                return resolve(fs.readFileSync(localPath));
            }
        }

        // Handle full URLs
        if (url.startsWith('http')) {
            const client = url.startsWith('https') ? https : http;
            client.get(url, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to fetch image: ${res.statusCode}`));
                    return;
                }
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks)));
            }).on('error', reject);
        } else if (fs.existsSync(url)) {
            // Handle absolute or other relative local paths
            resolve(fs.readFileSync(url));
        } else {
            reject(new Error('Invalid image source'));
        }
    });
};

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
    // Excel worksheet names cannot exceed 31 chars and cannot contain certain characters
    const safeTitle = title
        .replace(/[\\\/\?\*\[\]\:\n\r]/g, ' ') // Remove invalid chars and newlines
        .substring(0, 31)                      // Limit to 31 chars
        .trim() || 'Report';                   // Fallback
    const worksheet = workbook.addWorksheet(safeTitle);

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
    for (const item of data) {
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
        let hasImage = false;

        for (let i = 0; i < columns.length; i++) {
            const colDef = columns[i];
            const cell = row.getCell(i + 1);
            const value = rowData[i];

            // Formatting based on column type
            if (colDef.type === 'currency') {
                cell.numFmt = '#,##0.00';
                cell.alignment = { horizontal: 'right' };
            } else if (colDef.type === 'number') {
                cell.alignment = { horizontal: 'center' };
            } else if (colDef.type === 'image' && value) {
                try {
                    const buffer = await getImageBuffer(value);
                    const imageId = workbook.addImage({
                        buffer,
                        extension: value.split('.').pop() || 'png',
                    });

                    // Set row height to accommodate image
                    row.height = 60;
                    hasImage = true;

                    worksheet.addImage(imageId, {
                        tl: { col: i, row: row.number - 1 },
                        ext: { width: 50, height: 50 },
                        editAs: 'oneCell'
                    });

                    cell.value = ''; // Clear the URL text so it doesn't overlap
                } catch (e) {
                    console.error('Excel Image Error:', e.message);
                    cell.value = 'No Image';
                }
            }

            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            cell.alignment = cell.alignment || { vertical: 'middle' };
        }

        if (!hasImage) {
            row.height = 20;
        }
    }

    // 6. Summary Section
    worksheet.addRow([]); // Space

    if (summary) {
        // Handle legacy top-level summary keys (subtotal, discount, total)
        if (summary.subtotal !== undefined) {
            const row = worksheet.addRow(['', '', 'Subtotal:', summary.subtotal]);
            row.font = { bold: true };
            const lastCell = worksheet.getCell(`D${row.number}`);
            lastCell.numFmt = '#,##0.00';
        }
        if (summary.discount !== undefined) {
            const row = worksheet.addRow(['', '', 'Discount:', summary.discount]);
            row.font = { color: { argb: 'FFFF0000' } };
            const lastCell = worksheet.getCell(`D${row.number}`);
            lastCell.numFmt = '#,##0.00';
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
            }

            const row = worksheet.addRow(rowData);
            row.height = summaryRow.label?.includes('GRAND') ? 25 : 20;

            row.eachCell((cell, colNumber) => {
                const colDef = columns[colNumber - 1];
                const isValue = summaryRow[colDef.key] !== undefined;

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

