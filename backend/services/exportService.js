const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class ExportService {
  constructor() {
    this.exportDir = path.join(__dirname, '../exports');
    // Ensure exports directory exists
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount, currency = 'USD') {
    if (amount === null || amount === undefined) return '0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Format date for display
   */
  formatDate(date, format = 'short') {
    if (!date) return '';
    const d = new Date(date);
    
    if (format === 'long') {
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } else if (format === 'datetime') {
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return d.toLocaleDateString('en-US');
  }

  /**
   * Generate unique filename
   */
  generateFilename(prefix, extension) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const random = Math.random().toString(36).substr(2, 6);
    return `${prefix}_${timestamp}_${random}.${extension}`;
  }

  /**
   * Export data to CSV
   */
  async exportToCSV(data, headers, filename) {
    const filepath = path.join(this.exportDir, filename);
    
    // Create CSV content with BOM for Excel compatibility
    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel
    
    // Add headers
    if (headers && headers.length > 0) {
      csvContent += headers.map(h => {
        const header = String(h || '');
        return `"${header.replace(/"/g, '""')}"`;
      }).join(',') + '\r\n';
    }
    
    // Add data rows
    data.forEach(row => {
      const csvRow = row.map(cell => {
        // Escape quotes and wrap in quotes
        const cellValue = cell !== null && cell !== undefined ? String(cell) : '';
        return `"${cellValue.replace(/"/g, '""')}"`;
      });
      csvContent += csvRow.join(',') + '\r\n';
    });
    
    // Write to file
    fs.writeFileSync(filepath, csvContent, 'utf8');
    
    return filepath;
  }

  /**
   * Export data to Excel
   */
  async exportToExcel(data, options = {}) {
    const {
      headers = [],
      sheetName = 'Sheet1',
      filename = this.generateFilename('export', 'xlsx'),
      title = null,
      subtitle = null
    } = options;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // Set default column widths
    worksheet.columns = headers.map((header, index) => ({
      header,
      key: `col${index}`,
      width: 15
    }));

    // Add title row if provided
    if (title) {
      worksheet.mergeCells(1, 1, 1, headers.length);
      const titleRow = worksheet.getRow(1);
      titleRow.getCell(1).value = title;
      titleRow.getCell(1).font = { bold: true, size: 14 };
      titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.height = 25;
    }

    // Add subtitle row if provided
    if (subtitle) {
      const subtitleRowIndex = title ? 2 : 1;
      worksheet.mergeCells(subtitleRowIndex, 1, subtitleRowIndex, headers.length);
      const subtitleRow = worksheet.getRow(subtitleRowIndex);
      subtitleRow.getCell(1).value = subtitle;
      subtitleRow.getCell(1).font = { size: 12 };
      subtitleRow.getCell(1).alignment = { horizontal: 'center' };
      subtitleRow.height = 20;
    }

    // Add header row
    const headerRowIndex = (title ? 1 : 0) + (subtitle ? 1 : 0) + 1;
    const headerRow = worksheet.getRow(headerRowIndex);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    headerRow.height = 20;

    // Add data rows
    data.forEach((row, rowIndex) => {
      const excelRow = worksheet.addRow(row);
      excelRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        
        // Format currency columns (assuming last few columns are amounts)
        if (cell.value && typeof cell.value === 'number' && colNumber > headers.length - 3) {
          cell.numFmt = '#,##0.00';
        }
      });
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: false }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength < 10 ? 10 : maxLength + 2;
    });

    const filepath = path.join(this.exportDir, filename);
    await workbook.xlsx.writeFile(filepath);
    
    return filepath;
  }

  /**
   * Export data to PDF
   */
  async exportToPDF(data, options = {}) {
    const {
      headers = [],
      filename = this.generateFilename('export', 'pdf'),
      title = 'Report',
      subtitle = null,
      pageSize = 'A4',
      margin = 50
    } = options;

    const doc = new PDFDocument({ 
      size: pageSize,
      margin: margin
    });
    
    const filepath = path.join(this.exportDir, filename);
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // Add title
    doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown();

    // Add subtitle if provided
    if (subtitle) {
      doc.fontSize(12).font('Helvetica').text(subtitle, { align: 'center' });
      doc.moveDown();
    }

    // Add date
    doc.fontSize(10).font('Helvetica').text(
      `Generated: ${new Date().toLocaleString('en-US')}`,
      { align: 'right' }
    );
    doc.moveDown(2);

    // Table dimensions
    const tableTop = doc.y;
    const tableWidth = pageSize === 'A4' ? 495 : 700;
    const rowHeight = 20;
    const colWidth = tableWidth / headers.length;

    // Draw table headers
    doc.fontSize(10).font('Helvetica-Bold');
    let currentX = margin;
    headers.forEach((header, index) => {
      doc.rect(currentX, tableTop, colWidth, rowHeight).stroke();
      doc.text(header, currentX + 5, tableTop + 5, {
        width: colWidth - 10,
        align: 'left'
      });
      currentX += colWidth;
    });

    // Draw data rows
    doc.fontSize(9).font('Helvetica');
    let currentY = tableTop + rowHeight;
    
    data.forEach((row, rowIndex) => {
      // Check if we need a new page
      if (currentY > doc.page.height - margin - rowHeight) {
        doc.addPage();
        currentY = margin + rowHeight;
      }

      currentX = margin;
      row.forEach((cell, colIndex) => {
        doc.rect(currentX, currentY, colWidth, rowHeight).stroke();
        const cellValue = cell !== null && cell !== undefined ? String(cell) : '';
        doc.text(cellValue, currentX + 5, currentY + 5, {
          width: colWidth - 10,
          align: 'left'
        });
        currentX += colWidth;
      });
      currentY += rowHeight;
    });

    // Add footer
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).font('Helvetica').text(
        `Page ${i + 1} of ${pageCount}`,
        doc.page.width / 2 - 50,
        doc.page.height - 30,
        { align: 'center' }
      );
    }

    doc.end();
    
    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(filepath));
      stream.on('error', reject);
    });
  }

  /**
   * Export data to JSON
   */
  async exportToJSON(data, options = {}) {
    const {
      filename = this.generateFilename('export', 'json'),
      pretty = true
    } = options;

    const filepath = path.join(this.exportDir, filename);
    const jsonContent = pretty 
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
    
    fs.writeFileSync(filepath, jsonContent, 'utf8');
    
    return filepath;
  }

  /**
   * Delete export file
   */
  deleteExportFile(filename) {
    const filepath = path.join(this.exportDir, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }
    return false;
  }

  /**
   * Clean up old export files (older than specified days)
   */
  cleanupOldExports(daysOld = 7) {
    const files = fs.readdirSync(this.exportDir);
    const now = Date.now();
    const maxAge = daysOld * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    let deletedCount = 0;

    files.forEach(file => {
      const filepath = path.join(this.exportDir, file);
      const stats = fs.statSync(filepath);
      const fileAge = now - stats.mtimeMs;

      if (fileAge > maxAge) {
        fs.unlinkSync(filepath);
        deletedCount++;
      }
    });

    return deletedCount;
  }
}

module.exports = new ExportService();

