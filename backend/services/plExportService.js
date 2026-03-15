const fs = require('fs').promises;
const path = require('path');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const FinancialStatement = require('../models/FinancialStatement');

class PLExportService {
  constructor() {
    this.exportDir = path.join(__dirname, '../exports');
    this.ensureExportDir();
  }

  async ensureExportDir() {
    try {
      await fs.access(this.exportDir);
    } catch (error) {
      await fs.mkdir(this.exportDir, { recursive: true });
    }
  }

  // Export P&L statement to Excel
  async exportToExcel(statementId, options = {}) {
    try {
      const statement = await FinancialStatement.findById(statementId);
      if (!statement) {
        throw new Error('P&L statement not found');
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Profit & Loss Statement');

      // Set up styles
      const headerStyle = {
        font: { bold: true, size: 12 },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
      };

      const dataStyle = {
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
        alignment: { vertical: 'middle' }
      };

      const currencyStyle = {
        ...dataStyle,
        numFmt: '$#,##0.00'
      };

      const totalStyle = {
        ...headerStyle,
        font: { bold: true, size: 11 }
      };

      // Set column widths
      worksheet.getColumn(1).width = 40;
      worksheet.getColumn(2).width = 20;
      worksheet.getColumn(3).width = 20;

      let row = 1;

      // Company Header
      if (statement.company?.name) {
        worksheet.mergeCells(`A${row}:C${row}`);
        worksheet.getCell(`A${row}`).value = statement.company.name;
        worksheet.getCell(`A${row}`).font = { bold: true, size: 16 };
        worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
        row += 2;

        worksheet.mergeCells(`A${row}:C${row}`);
        worksheet.getCell(`A${row}`).value = 'PROFIT & LOSS STATEMENT';
        worksheet.getCell(`A${row}`).font = { bold: true, size: 14 };
        worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
        row += 2;

        worksheet.mergeCells(`A${row}:C${row}`);
        worksheet.getCell(`A${row}`).value = `Period: ${this.formatDate(statement.period.startDate)} - ${this.formatDate(statement.period.endDate)}`;
        worksheet.getCell(`A${row}`).alignment = { horizontal: 'center' };
        row += 3;
      }

      // Revenue Section
      worksheet.getCell(`A${row}`).value = 'REVENUE';
      worksheet.getCell(`A${row}`).style = headerStyle;
      worksheet.mergeCells(`A${row}:C${row}`);
      row++;

      worksheet.getCell(`A${row}`).value = 'Gross Sales';
      worksheet.getCell(`A${row}`).style = dataStyle;
      worksheet.getCell(`C${row}`).value = statement.revenue.grossSales.amount;
      worksheet.getCell(`C${row}`).style = currencyStyle;
      row++;

      if (statement.revenue.salesReturns.amount > 0) {
        worksheet.getCell(`A${row}`).value = 'Less: Sales Returns';
        worksheet.getCell(`A${row}`).style = dataStyle;
        worksheet.getCell(`C${row}`).value = -statement.revenue.salesReturns.amount;
        worksheet.getCell(`C${row}`).style = currencyStyle;
        row++;
      }

      if (statement.revenue.salesDiscounts.amount > 0) {
        worksheet.getCell(`A${row}`).value = 'Less: Sales Discounts';
        worksheet.getCell(`A${row}`).style = dataStyle;
        worksheet.getCell(`C${row}`).value = -statement.revenue.salesDiscounts.amount;
        worksheet.getCell(`C${row}`).style = currencyStyle;
        row++;
      }

      worksheet.getCell(`A${row}`).value = 'Net Sales';
      worksheet.getCell(`A${row}`).style = totalStyle;
      worksheet.getCell(`C${row}`).value = statement.revenue.netSales.amount;
      worksheet.getCell(`C${row}`).style = { ...currencyStyle, font: { bold: true } };
      row++;

      if (statement.revenue.otherRevenue.amount > 0) {
        worksheet.getCell(`A${row}`).value = 'Other Revenue';
        worksheet.getCell(`A${row}`).style = dataStyle;
        worksheet.getCell(`C${row}`).value = statement.revenue.otherRevenue.amount;
        worksheet.getCell(`C${row}`).style = currencyStyle;
        row++;
      }

      worksheet.getCell(`A${row}`).value = 'Total Revenue';
      worksheet.getCell(`A${row}`).style = totalStyle;
      worksheet.getCell(`C${row}`).value = statement.revenue.totalRevenue.amount;
      worksheet.getCell(`C${row}`).style = { ...currencyStyle, font: { bold: true } };
      row += 2;

      // Cost of Goods Sold Section
      worksheet.getCell(`A${row}`).value = 'COST OF GOODS SOLD';
      worksheet.getCell(`A${row}`).style = headerStyle;
      worksheet.mergeCells(`A${row}:C${row}`);
      row++;

      worksheet.getCell(`A${row}`).value = 'Beginning Inventory';
      worksheet.getCell(`A${row}`).style = dataStyle;
      worksheet.getCell(`C${row}`).value = statement.costOfGoodsSold.beginningInventory;
      worksheet.getCell(`C${row}`).style = currencyStyle;
      row++;

      worksheet.getCell(`A${row}`).value = 'Purchases';
      worksheet.getCell(`A${row}`).style = dataStyle;
      worksheet.getCell(`C${row}`).value = statement.costOfGoodsSold.purchases.amount;
      worksheet.getCell(`C${row}`).style = currencyStyle;
      row++;

      if (statement.costOfGoodsSold.freightIn > 0) {
        worksheet.getCell(`A${row}`).value = 'Freight In';
        worksheet.getCell(`A${row}`).style = dataStyle;
        worksheet.getCell(`C${row}`).value = statement.costOfGoodsSold.freightIn;
        worksheet.getCell(`C${row}`).style = currencyStyle;
        row++;
      }

      if (statement.costOfGoodsSold.purchaseReturns > 0) {
        worksheet.getCell(`A${row}`).value = 'Less: Purchase Returns';
        worksheet.getCell(`A${row}`).style = dataStyle;
        worksheet.getCell(`C${row}`).value = -statement.costOfGoodsSold.purchaseReturns;
        worksheet.getCell(`C${row}`).style = currencyStyle;
        row++;
      }

      if (statement.costOfGoodsSold.purchaseDiscounts > 0) {
        worksheet.getCell(`A${row}`).value = 'Less: Purchase Discounts';
        worksheet.getCell(`A${row}`).style = dataStyle;
        worksheet.getCell(`C${row}`).value = -statement.costOfGoodsSold.purchaseDiscounts;
        worksheet.getCell(`C${row}`).style = currencyStyle;
        row++;
      }

      worksheet.getCell(`A${row}`).value = 'Less: Ending Inventory';
      worksheet.getCell(`A${row}`).style = dataStyle;
      worksheet.getCell(`C${row}`).value = -statement.costOfGoodsSold.endingInventory;
      worksheet.getCell(`C${row}`).style = currencyStyle;
      row++;

      worksheet.getCell(`A${row}`).value = 'Total Cost of Goods Sold';
      worksheet.getCell(`A${row}`).style = totalStyle;
      worksheet.getCell(`C${row}`).value = statement.costOfGoodsSold.totalCOGS.amount;
      worksheet.getCell(`C${row}`).style = { ...currencyStyle, font: { bold: true } };
      row += 2;

      // Gross Profit
      worksheet.getCell(`A${row}`).value = 'Gross Profit';
      worksheet.getCell(`A${row}`).style = totalStyle;
      worksheet.getCell(`C${row}`).value = statement.grossProfit.amount;
      worksheet.getCell(`C${row}`).style = { ...currencyStyle, font: { bold: true } };
      worksheet.getCell(`B${row}`).value = `${statement.grossProfit.margin.toFixed(1)}%`;
      worksheet.getCell(`B${row}`).style = { ...dataStyle, alignment: { horizontal: 'right' } };
      row += 2;

      // Operating Expenses
      worksheet.getCell(`A${row}`).value = 'OPERATING EXPENSES';
      worksheet.getCell(`A${row}`).style = headerStyle;
      worksheet.mergeCells(`A${row}:C${row}`);
      row++;

      worksheet.getCell(`A${row}`).value = 'Selling Expenses';
      worksheet.getCell(`A${row}`).style = dataStyle;
      worksheet.getCell(`C${row}`).value = statement.operatingExpenses.sellingExpenses.total;
      worksheet.getCell(`C${row}`).style = currencyStyle;
      row++;

      worksheet.getCell(`A${row}`).value = 'Administrative Expenses';
      worksheet.getCell(`A${row}`).style = dataStyle;
      worksheet.getCell(`C${row}`).value = statement.operatingExpenses.administrativeExpenses.total;
      worksheet.getCell(`C${row}`).style = currencyStyle;
      row++;

      worksheet.getCell(`A${row}`).value = 'Total Operating Expenses';
      worksheet.getCell(`A${row}`).style = totalStyle;
      worksheet.getCell(`C${row}`).value = statement.operatingExpenses.totalOperatingExpenses.amount;
      worksheet.getCell(`C${row}`).style = { ...currencyStyle, font: { bold: true } };
      row += 2;

      // Operating Income
      worksheet.getCell(`A${row}`).value = 'Operating Income';
      worksheet.getCell(`A${row}`).style = totalStyle;
      worksheet.getCell(`C${row}`).value = statement.operatingIncome.amount;
      worksheet.getCell(`C${row}`).style = { ...currencyStyle, font: { bold: true } };
      worksheet.getCell(`B${row}`).value = `${statement.operatingIncome.margin.toFixed(1)}%`;
      worksheet.getCell(`B${row}`).style = { ...dataStyle, alignment: { horizontal: 'right' } };
      row += 2;

      // Other Income and Expenses
      worksheet.getCell(`A${row}`).value = 'OTHER INCOME AND EXPENSES';
      worksheet.getCell(`A${row}`).style = headerStyle;
      worksheet.mergeCells(`A${row}:C${row}`);
      row++;

      if (statement.otherIncome.totalOtherIncome.amount !== 0) {
        worksheet.getCell(`A${row}`).value = 'Other Income';
        worksheet.getCell(`A${row}`).style = dataStyle;
        worksheet.getCell(`C${row}`).value = statement.otherIncome.totalOtherIncome.amount;
        worksheet.getCell(`C${row}`).style = currencyStyle;
        row++;
      }

      if (statement.otherExpenses.totalOtherExpenses.amount !== 0) {
        worksheet.getCell(`A${row}`).value = 'Other Expenses';
        worksheet.getCell(`A${row}`).style = dataStyle;
        worksheet.getCell(`C${row}`).value = -statement.otherExpenses.totalOtherExpenses.amount;
        worksheet.getCell(`C${row}`).style = currencyStyle;
        row++;
      }

      worksheet.getCell(`A${row}`).value = 'Earnings Before Tax';
      worksheet.getCell(`A${row}`).style = totalStyle;
      worksheet.getCell(`C${row}`).value = statement.earningsBeforeTax.amount;
      worksheet.getCell(`C${row}`).style = { ...currencyStyle, font: { bold: true } };
      row += 2;

      // Income Tax
      worksheet.getCell(`A${row}`).value = 'Income Tax';
      worksheet.getCell(`A${row}`).style = totalStyle;
      worksheet.getCell(`C${row}`).value = -statement.incomeTax.total.amount;
      worksheet.getCell(`C${row}`).style = { ...currencyStyle, font: { bold: true } };
      worksheet.getCell(`B${row}`).value = `${statement.incomeTax.total.rate.toFixed(1)}%`;
      worksheet.getCell(`B${row}`).style = { ...dataStyle, alignment: { horizontal: 'right' } };
      row += 2;

      // Net Income
      worksheet.getCell(`A${row}`).value = 'NET INCOME';
      worksheet.getCell(`A${row}`).style = { ...totalStyle, font: { bold: true, size: 14 } };
      worksheet.getCell(`C${row}`).value = statement.netIncome.amount;
      worksheet.getCell(`C${row}`).style = { ...currencyStyle, font: { bold: true, size: 14 } };
      worksheet.getCell(`B${row}`).value = `${statement.netIncome.margin.toFixed(1)}%`;
      worksheet.getCell(`B${row}`).style = { ...dataStyle, alignment: { horizontal: 'right' }, font: { bold: true } };
      row += 3;

      // Key Metrics
      worksheet.getCell(`A${row}`).value = 'KEY METRICS';
      worksheet.getCell(`A${row}`).style = headerStyle;
      worksheet.mergeCells(`A${row}:C${row}`);
      row++;

      worksheet.getCell(`A${row}`).value = 'Gross Profit Margin';
      worksheet.getCell(`A${row}`).style = dataStyle;
      worksheet.getCell(`C${row}`).value = statement.keyMetrics.grossProfitMargin;
      worksheet.getCell(`C${row}`).style = { ...dataStyle, numFmt: '0.0%' };
      row++;

      worksheet.getCell(`A${row}`).value = 'Operating Margin';
      worksheet.getCell(`A${row}`).style = dataStyle;
      worksheet.getCell(`C${row}`).value = statement.keyMetrics.operatingMargin;
      worksheet.getCell(`C${row}`).style = { ...dataStyle, numFmt: '0.0%' };
      row++;

      worksheet.getCell(`A${row}`).value = 'Net Profit Margin';
      worksheet.getCell(`A${row}`).style = dataStyle;
      worksheet.getCell(`C${row}`).value = statement.keyMetrics.netProfitMargin;
      worksheet.getCell(`C${row}`).style = { ...dataStyle, numFmt: '0.0%' };
      row++;

      worksheet.getCell(`A${row}`).value = 'EBITDA';
      worksheet.getCell(`A${row}`).style = dataStyle;
      worksheet.getCell(`C${row}`).value = statement.keyMetrics.ebitda;
      worksheet.getCell(`C${row}`).style = currencyStyle;
      row += 2;

      // Footer
      worksheet.getCell(`A${row}`).value = `Generated on: ${this.formatDate(new Date())}`;
      worksheet.getCell(`A${row}`).style = { ...dataStyle, font: { size: 9 } };
      worksheet.mergeCells(`A${row}:C${row}`);
      row++;

      if (statement.generatedBy) {
        worksheet.getCell(`A${row}`).value = `Generated by: ${statement.generatedBy.firstName} ${statement.generatedBy.lastName}`;
        worksheet.getCell(`A${row}`).style = { ...dataStyle, font: { size: 9 } };
        worksheet.mergeCells(`A${row}:C${row}`);
      }

      // Generate filename
      const filename = `PL_Statement_${this.formatDate(statement.period.startDate)}_to_${this.formatDate(statement.period.endDate)}.xlsx`;
      const filepath = path.join(this.exportDir, filename);

      // Write file
      await workbook.xlsx.writeFile(filepath);

      return {
        filename,
        filepath,
        size: (await fs.stat(filepath)).size,
        format: 'excel'
      };
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw error;
    }
  }

  // Export P&L statement to PDF
  async exportToPDF(statementId, options = {}) {
    try {
      const statement = await FinancialStatement.findById(statementId);
      if (!statement) {
        throw new Error('P&L statement not found');
      }

      const doc = new PDFDocument({ margin: 50 });
      const filename = `PL_Statement_${this.formatDate(statement.period.startDate)}_to_${this.formatDate(statement.period.endDate)}.pdf`;
      const filepath = path.join(this.exportDir, filename);

      // Create write stream
      const stream = require('fs').createWriteStream(filepath);
      doc.pipe(stream);

      // Header
      if (statement.company?.name) {
        doc.fontSize(20).font('Helvetica-Bold').text(statement.company.name, { align: 'center' });
        doc.moveDown(0.5);
      }

      doc.fontSize(16).font('Helvetica-Bold').text('PROFIT & LOSS STATEMENT', { align: 'center' });
      doc.moveDown(0.5);
      
      doc.fontSize(12).font('Helvetica').text(
        `Period: ${this.formatDate(statement.period.startDate)} - ${this.formatDate(statement.period.endDate)}`,
        { align: 'center' }
      );
      doc.moveDown(2);

      // Set up table parameters
      const tableTop = 200;
      const itemHeight = 25;
      const leftMargin = 50;
      const rightMargin = 550;
      const descriptionWidth = 350;
      const amountWidth = 100;

      let currentY = tableTop;

      // Helper function to add table row
      const addRow = (description, amount, isHeader = false, isTotal = false) => {
        // Draw border
        doc.rect(leftMargin, currentY, descriptionWidth + amountWidth, itemHeight);
        
        // Add description
        doc.fontSize(isHeader ? 12 : isTotal ? 11 : 10)
           .font(isHeader || isTotal ? 'Helvetica-Bold' : 'Helvetica')
           .text(description, leftMargin + 10, currentY + (itemHeight - 10) / 2);
        
        // Add amount
        if (amount !== undefined) {
          const amountText = amount >= 0 ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `($${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
          doc.text(amountText, rightMargin - amountWidth + 10, currentY + (itemHeight - 10) / 2, { align: 'right' });
        }
        
        currentY += itemHeight;
      };

      // Revenue Section
      addRow('REVENUE', undefined, true);
      addRow('Gross Sales', statement.revenue.grossSales.amount);
      
      if (statement.revenue.salesReturns.amount > 0) {
        addRow('Less: Sales Returns', -statement.revenue.salesReturns.amount);
      }
      
      if (statement.revenue.salesDiscounts.amount > 0) {
        addRow('Less: Sales Discounts', -statement.revenue.salesDiscounts.amount);
      }
      
      addRow('Net Sales', statement.revenue.netSales.amount, false, true);
      
      if (statement.revenue.otherRevenue.amount > 0) {
        addRow('Other Revenue', statement.revenue.otherRevenue.amount);
      }
      
      addRow('Total Revenue', statement.revenue.totalRevenue.amount, false, true);
      currentY += 10;

      // Cost of Goods Sold Section
      addRow('COST OF GOODS SOLD', undefined, true);
      addRow('Beginning Inventory', statement.costOfGoodsSold.beginningInventory);
      addRow('Purchases', statement.costOfGoodsSold.purchases.amount);
      
      if (statement.costOfGoodsSold.freightIn > 0) {
        addRow('Freight In', statement.costOfGoodsSold.freightIn);
      }
      
      if (statement.costOfGoodsSold.purchaseReturns > 0) {
        addRow('Less: Purchase Returns', -statement.costOfGoodsSold.purchaseReturns);
      }
      
      if (statement.costOfGoodsSold.purchaseDiscounts > 0) {
        addRow('Less: Purchase Discounts', -statement.costOfGoodsSold.purchaseDiscounts);
      }
      
      addRow('Less: Ending Inventory', -statement.costOfGoodsSold.endingInventory);
      addRow('Total Cost of Goods Sold', statement.costOfGoodsSold.totalCOGS.amount, false, true);
      currentY += 10;

      // Gross Profit
      addRow('Gross Profit', statement.grossProfit.amount, false, true);
      currentY += 10;

      // Operating Expenses
      addRow('OPERATING EXPENSES', undefined, true);
      addRow('Selling Expenses', statement.operatingExpenses.sellingExpenses.total);
      addRow('Administrative Expenses', statement.operatingExpenses.administrativeExpenses.total);
      addRow('Total Operating Expenses', statement.operatingExpenses.totalOperatingExpenses.amount, false, true);
      currentY += 10;

      // Operating Income
      addRow('Operating Income', statement.operatingIncome.amount, false, true);
      currentY += 10;

      // Other Income and Expenses
      addRow('OTHER INCOME AND EXPENSES', undefined, true);
      
      if (statement.otherIncome.totalOtherIncome.amount !== 0) {
        addRow('Other Income', statement.otherIncome.totalOtherIncome.amount);
      }
      
      if (statement.otherExpenses.totalOtherExpenses.amount !== 0) {
        addRow('Other Expenses', -statement.otherExpenses.totalOtherExpenses.amount);
      }
      
      addRow('Earnings Before Tax', statement.earningsBeforeTax.amount, false, true);
      currentY += 10;

      // Income Tax
      addRow('Income Tax', -statement.incomeTax.total.amount, false, true);
      currentY += 10;

      // Net Income
      addRow('NET INCOME', statement.netIncome.amount, false, true);
      currentY += 20;

      // Key Metrics
      doc.fontSize(12).font('Helvetica-Bold').text('KEY METRICS', leftMargin, currentY);
      currentY += 30;

      const metrics = [
        ['Gross Profit Margin', `${statement.keyMetrics.grossProfitMargin.toFixed(1)}%`],
        ['Operating Margin', `${statement.keyMetrics.operatingMargin.toFixed(1)}%`],
        ['Net Profit Margin', `${statement.keyMetrics.netProfitMargin.toFixed(1)}%`],
        ['EBITDA', `$${statement.keyMetrics.ebitda.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ];

      metrics.forEach(([label, value]) => {
        doc.fontSize(10).font('Helvetica').text(`${label}:`, leftMargin, currentY);
        doc.text(value, rightMargin - 100, currentY, { align: 'right' });
        currentY += 20;
      });

      // Footer
      currentY += 30;
      doc.fontSize(9).font('Helvetica').text(`Generated on: ${this.formatDate(new Date())}`, leftMargin, currentY);
      
      if (statement.generatedBy) {
        currentY += 15;
        doc.text(`Generated by: ${statement.generatedBy.firstName} ${statement.generatedBy.lastName}`, leftMargin, currentY);
      }

      // Finalize PDF
      doc.end();

      return new Promise((resolve, reject) => {
        stream.on('finish', async () => {
          try {
            const stats = await fs.stat(filepath);
            resolve({
              filename,
              filepath,
              size: stats.size,
              format: 'pdf'
            });
          } catch (error) {
            reject(error);
          }
        });
        
        stream.on('error', reject);
      });
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      throw error;
    }
  }

  // Export P&L statement to CSV
  async exportToCSV(statementId, options = {}) {
    try {
      const statement = await FinancialStatement.findById(statementId);
      if (!statement) {
        throw new Error('P&L statement not found');
      }

      const csvRows = [];
      
      // Header
      if (statement.company?.name) {
        csvRows.push([statement.company.name]);
        csvRows.push(['PROFIT & LOSS STATEMENT']);
        csvRows.push([`Period: ${this.formatDate(statement.period.startDate)} - ${this.formatDate(statement.period.endDate)}`]);
        csvRows.push([]);
      }

      // Revenue Section
      csvRows.push(['REVENUE', '', '']);
      csvRows.push(['Gross Sales', '', this.formatCurrency(statement.revenue.grossSales.amount)]);
      
      if (statement.revenue.salesReturns.amount > 0) {
        csvRows.push(['Less: Sales Returns', '', this.formatCurrency(-statement.revenue.salesReturns.amount)]);
      }
      
      if (statement.revenue.salesDiscounts.amount > 0) {
        csvRows.push(['Less: Sales Discounts', '', this.formatCurrency(-statement.revenue.salesDiscounts.amount)]);
      }
      
      csvRows.push(['Net Sales', '', this.formatCurrency(statement.revenue.netSales.amount)]);
      
      if (statement.revenue.otherRevenue.amount > 0) {
        csvRows.push(['Other Revenue', '', this.formatCurrency(statement.revenue.otherRevenue.amount)]);
      }
      
      csvRows.push(['Total Revenue', '', this.formatCurrency(statement.revenue.totalRevenue.amount)]);
      csvRows.push([]);

      // Cost of Goods Sold Section
      csvRows.push(['COST OF GOODS SOLD', '', '']);
      csvRows.push(['Beginning Inventory', '', this.formatCurrency(statement.costOfGoodsSold.beginningInventory)]);
      csvRows.push(['Purchases', '', this.formatCurrency(statement.costOfGoodsSold.purchases.amount)]);
      
      if (statement.costOfGoodsSold.freightIn > 0) {
        csvRows.push(['Freight In', '', this.formatCurrency(statement.costOfGoodsSold.freightIn)]);
      }
      
      if (statement.costOfGoodsSold.purchaseReturns > 0) {
        csvRows.push(['Less: Purchase Returns', '', this.formatCurrency(-statement.costOfGoodsSold.purchaseReturns)]);
      }
      
      if (statement.costOfGoodsSold.purchaseDiscounts > 0) {
        csvRows.push(['Less: Purchase Discounts', '', this.formatCurrency(-statement.costOfGoodsSold.purchaseDiscounts)]);
      }
      
      csvRows.push(['Less: Ending Inventory', '', this.formatCurrency(-statement.costOfGoodsSold.endingInventory)]);
      csvRows.push(['Total Cost of Goods Sold', '', this.formatCurrency(statement.costOfGoodsSold.totalCOGS.amount)]);
      csvRows.push([]);

      // Gross Profit
      csvRows.push(['Gross Profit', '', this.formatCurrency(statement.grossProfit.amount)]);
      csvRows.push(['Gross Profit Margin', `${statement.grossProfit.margin.toFixed(1)}%`, '']);
      csvRows.push([]);

      // Operating Expenses
      csvRows.push(['OPERATING EXPENSES', '', '']);
      csvRows.push(['Selling Expenses', '', this.formatCurrency(statement.operatingExpenses.sellingExpenses.total)]);
      csvRows.push(['Administrative Expenses', '', this.formatCurrency(statement.operatingExpenses.administrativeExpenses.total)]);
      csvRows.push(['Total Operating Expenses', '', this.formatCurrency(statement.operatingExpenses.totalOperatingExpenses.amount)]);
      csvRows.push([]);

      // Operating Income
      csvRows.push(['Operating Income', '', this.formatCurrency(statement.operatingIncome.amount)]);
      csvRows.push(['Operating Margin', `${statement.operatingIncome.margin.toFixed(1)}%`, '']);
      csvRows.push([]);

      // Other Income and Expenses
      csvRows.push(['OTHER INCOME AND EXPENSES', '', '']);
      
      if (statement.otherIncome.totalOtherIncome.amount !== 0) {
        csvRows.push(['Other Income', '', this.formatCurrency(statement.otherIncome.totalOtherIncome.amount)]);
      }
      
      if (statement.otherExpenses.totalOtherExpenses.amount !== 0) {
        csvRows.push(['Other Expenses', '', this.formatCurrency(-statement.otherExpenses.totalOtherExpenses.amount)]);
      }
      
      csvRows.push(['Earnings Before Tax', '', this.formatCurrency(statement.earningsBeforeTax.amount)]);
      csvRows.push([]);

      // Income Tax
      csvRows.push(['Income Tax', '', this.formatCurrency(-statement.incomeTax.total.amount)]);
      csvRows.push(['Tax Rate', `${statement.incomeTax.total.rate.toFixed(1)}%`, '']);
      csvRows.push([]);

      // Net Income
      csvRows.push(['NET INCOME', '', this.formatCurrency(statement.netIncome.amount)]);
      csvRows.push(['Net Profit Margin', `${statement.netIncome.margin.toFixed(1)}%`, '']);
      csvRows.push([]);

      // Key Metrics
      csvRows.push(['KEY METRICS', '', '']);
      csvRows.push(['Gross Profit Margin', `${statement.keyMetrics.grossProfitMargin.toFixed(1)}%`, '']);
      csvRows.push(['Operating Margin', `${statement.keyMetrics.operatingMargin.toFixed(1)}%`, '']);
      csvRows.push(['Net Profit Margin', `${statement.keyMetrics.netProfitMargin.toFixed(1)}%`, '']);
      csvRows.push(['EBITDA', this.formatCurrency(statement.keyMetrics.ebitda), '']);
      csvRows.push([]);

      // Footer
      csvRows.push([`Generated on: ${this.formatDate(new Date())}`]);
      
      if (statement.generatedBy) {
        csvRows.push([`Generated by: ${statement.generatedBy.firstName} ${statement.generatedBy.lastName}`]);
      }

      // Convert to CSV string
      const csvContent = csvRows.map(row => 
        row.map(cell => `"${cell || ''}"`).join(',')
      ).join('\n');

      // Generate filename
      const filename = `PL_Statement_${this.formatDate(statement.period.startDate)}_to_${this.formatDate(statement.period.endDate)}.csv`;
      const filepath = path.join(this.exportDir, filename);

      // Write file
      await fs.writeFile(filepath, csvContent, 'utf8');

      return {
        filename,
        filepath,
        size: (await fs.stat(filepath)).size,
        format: 'csv'
      };
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw error;
    }
  }

  // Helper methods
  formatDate(date) {
    return new Date(date).toLocaleDateString('en-US');
  }

  formatCurrency(amount) {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Clean up old export files
  async cleanupOldExports(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    try {
      const files = await fs.readdir(this.exportDir);
      const now = Date.now();
      
      for (const file of files) {
        const filepath = path.join(this.exportDir, file);
        const stats = await fs.stat(filepath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filepath);
          console.log(`Cleaned up old export file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old exports:', error);
    }
  }
}

module.exports = new PLExportService();
