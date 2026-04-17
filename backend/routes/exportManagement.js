const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { generateStyledExcel } = require('../utils/excelService');
const logger = require('../utils/logger');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const { auth } = require('../middleware/auth');

/** Normalize ExcelJS cell values for JSON (strings, numbers, dates; rich text & formula results). */
function cellValueToPlain(cell) {
    if (!cell || cell.value === null || cell.value === undefined) return null;
    const v = cell.value;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
    if (v instanceof Date) return v;
    if (typeof v === 'object') {
        if (Object.prototype.hasOwnProperty.call(v, 'result')) return v.result;
        if (Array.isArray(v.richText)) return v.richText.map((p) => p.text || '').join('');
        if (v.hyperlink !== undefined) return v.text != null ? v.text : v.hyperlink;
    }
    if (typeof cell.text === 'string' && cell.text.length) return cell.text;
    return String(v);
}

/**
 * @route   POST /api/excel-manager/generate
 * @desc    Export data to a professionally styled Excel file
 * @access  Private (Assume auth middleware is applied globally or here)
 */
router.post('/generate', auth, async (req, res) => {
    try {
        const { 
            title = 'Report', 
            company, 
            customer, 
            columns, 
            data, 
            summary,
            filename = 'export.xlsx'
        } = req.body;

        // 1. Validation
        if (!columns || !Array.isArray(columns) || columns.length === 0) {
            return res.status(400).json({ message: 'Columns definition is required' });
        }
        if (!data || !Array.isArray(data)) {
            return res.status(400).json({ message: 'Data is required' });
        }

        // 2. Generate Workbook
        const workbook = await generateStyledExcel({
            title,
            company,
            customer,
            columns,
            data,
            summary
        });

        // 3. Set Response Headers for Download
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=${filename}`
        );

        // 4. Write to Response Stream
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        logger.error('Excel Export Error:', error);
        res.status(500).json({ 
            message: 'Failed to generate Excel file', 
            error: process.env.NODE_ENV === 'development' ? error.message : undefined 
        });
    }
});

/**
 * @route   GET /api/export-excel/sample
 * @desc    Test endpoint with sample data
 */
router.get('/sample', async (req, res) => {
    try {
        const sampleData = {
            title: 'SALES INVOICE',
            company: {
                name: 'ZARYAB IMPEX PREMIUM',
                address: 'Plot #45, Industrial Zone, Karachi, Pakistan',
                contact: 'Tel: +92 21 3456789 | Email: sales@zaryabimpex.com'
            },
            customer: {
                name: 'John Doe Enterprise',
                address: 'Office 101, Business Center, Lahore',
                contact: '+92 300 1234567'
            },
            columns: [
                { header: 'Product Name', key: 'name', width: 40 },
                { header: 'Qty', key: 'qty', width: 10, type: 'number' },
                { header: 'Unit Price', key: 'price', width: 15, type: 'currency' },
                { header: 'Total Amount', key: 'total', width: 20, type: 'currency' }
            ],
            data: [
                { name: 'Heavy Duty Industrial Drill', qty: 2, price: 450, total: 900 },
                { name: 'High Precision Laser Level', qty: 1, price: 1200, total: 1200 },
                { name: 'Magnetic Screwdriver Set (24pc)', qty: 5, price: 45, total: 225 },
                { name: 'Safety Helmet - Grade A', qty: 10, price: 25, total: 250 }
            ],
            summary: {
                subtotal: 2575,
                discount: 75,
                total: 2500
            },
            filename: 'Sample_Invoice.xlsx'
        };

        const workbook = await generateStyledExcel(sampleData);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Sample_Invoice.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/import', auth, upload.single('excelFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.getWorksheet(1); // Read first sheet

        const data = [];
        const headers = [];

        // Identifies the header row by searching for a row containing "Product Name" or similar
        let headerRowNumber = 1;
        for (let i = 1; i <= 20; i++) {
            const row = worksheet.getRow(i);
            let isHeader = false;
            row.eachCell((cell) => {
                const raw = cellValueToPlain(cell);
                const val = raw != null ? String(raw).toLowerCase() : '';
                if (val && (val.includes('product') || val.includes('name') || val.includes('business') || val.includes('company')
                    || val.includes('supplier') || val.includes('vendor') || val.includes('contact'))) {
                    isHeader = true;
                }
            });
            if (isHeader) {
                headerRowNumber = i;
                break;
            }
        }

        // Identify headers from the detected header row
        worksheet.getRow(headerRowNumber).eachCell((cell, colNumber) => {
            const raw = cellValueToPlain(cell);
            const val = raw != null ? String(raw).toLowerCase().trim()
                .replace(/ /g, '_')
                .replace(/\*/g, '')
                .replace(/\(.*\)/g, '') : '';
            headers[colNumber] = val || `col_${colNumber}`;
        });

        // Parse rows starting AFTER the header row
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber <= headerRowNumber) return; // Skip header row and everything above it

            const rowData = {};
            let hasData = false;
            row.eachCell((cell, colNumber) => {
                const header = headers[colNumber];
                if (header) {
                    const plain = cellValueToPlain(cell);
                    rowData[header] = plain;
                    if (plain !== null && plain !== undefined && plain !== '') hasData = true;
                }
            });
            if (hasData) data.push(rowData);
        });

        res.json({
            message: 'Excel parsed successfully',
            count: data.length,
            data
        });

    } catch (error) {
        logger.error('Excel Import Error:', error);
        res.status(500).json({ message: 'Failed to parse Excel file', error: error.message });
    }
});

module.exports = router;
