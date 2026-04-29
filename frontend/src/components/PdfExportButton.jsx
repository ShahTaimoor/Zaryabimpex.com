import React, { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { toast } from 'sonner';

/**
 * A professional Export PDF button component
 * Supports professional invoice layouts with company/party headers.
 */
const PdfExportButton = ({ getData, label = "PDF", className = "" }) => {
    const [isExporting, setIsExporting] = useState(false);

    const loadImage = (url) => {
        return new Promise((resolve) => {
            if (!url) return resolve(null);

            const timeout = setTimeout(() => {
                resolve(null);
            }, 3000);

            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                clearTimeout(timeout);
                const MAX_DIM = 100;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > MAX_DIM) {
                        height *= MAX_DIM / width;
                        width = MAX_DIM;
                    }
                } else {
                    if (height > MAX_DIM) {
                        width *= MAX_DIM / height;
                        height = MAX_DIM;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(width, 1);
                canvas.height = Math.max(height, 1);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                try {
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                } catch (e) {
                    resolve(null);
                }
            };
            img.onerror = () => {
                clearTimeout(timeout);
                resolve(null);
            };
            img.src = url;
        });
    };

    const handleExport = async () => {
        try {
            setIsExporting(true);
            const payload = await getData();
            if (!payload) return;

            const toastId = toast.loading('Generating PDF: Preparing...');

            const { jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF(payload.orientation || 'portrait');
            let currentY = 10;
            const startX = 5;

            // 1. Company Header
            if (payload.company) {
                doc.setFontSize(20);
                doc.setTextColor(41, 128, 185);
                doc.setFont('helvetica', 'bold');
                doc.text(payload.company.name || '', startX, currentY);
                currentY += 8;

                doc.setFontSize(9);
                doc.setTextColor(80, 80, 80);
                doc.setFont('helvetica', 'normal');
                if (payload.company.address) {
                    doc.text(payload.company.address, startX, currentY);
                    currentY += 5;
                }
                if (payload.company.contact) {
                    doc.text(payload.company.contact, startX, currentY);
                    currentY += 5;
                }
                currentY += 5;
            }

            // 2. Document Title
            doc.setFontSize(16);
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            // Remove the long ID from the title as requested
            const cleanTitle = (payload.title || "Report").split(':')[0].trim();
            doc.text(cleanTitle, startX, currentY);
            currentY += 10;

            // 3. Bill To / Party Details
            if (payload.party) {
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text(payload.party.label || 'Bill To:', startX, currentY);
                currentY += 5;

                doc.setTextColor(0, 0, 0);
                doc.setFont('helvetica', 'bold');
                doc.text(payload.party.name || '', startX, currentY);
                currentY += 5;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                if (payload.party.address) {
                    const addrStr = String(payload.party.address);
                    const splitAddress = doc.splitTextToSize(addrStr, 90);
                    doc.text(splitAddress, startX, currentY);
                    currentY += (splitAddress.length * 4) + 2;
                }
                if (payload.party.phone) {
                    doc.text(`Phone: ${payload.party.phone}`, startX, currentY);
                    currentY += 5;
                }
                currentY += 5;
            }

            const heads = [payload.columns.map(c => c.header)];
            const imageColumnsIndices = [];
            payload.columns.forEach((col, idx) => {
                if (col.type === 'image' || col.key === 'imageUrl' || col.key === 'image') {
                    imageColumnsIndices.push(idx);
                }
            });

            const rows = [];
            const imagesMap = {};
            const BATCH_SIZE = 10;

            // Generate rows
            payload.data.forEach((item, rowIndex) => {
                const rowData = [];
                payload.columns.forEach((col, colIndex) => {
                    if (imageColumnsIndices.includes(colIndex)) {
                        rowData.push('');
                    } else {
                        rowData.push(String(item[col.key] ?? ''));
                    }
                });
                rows[rowIndex] = rowData;
            });

            if (imageColumnsIndices.length > 0) {
                toast.loading(`Generating PDF: Processing images...`, { id: toastId });
                for (let i = 0; i < payload.data.length; i += BATCH_SIZE) {
                    const batch = payload.data.slice(i, i + BATCH_SIZE);
                    await Promise.all(
                        batch.map(async (item, idx) => {
                            const rowIndex = i + idx;
                            for (const colIndex of imageColumnsIndices) {
                                const col = payload.columns[colIndex];
                                const imgData = await loadImage(item[col.key]);
                                if (imgData) {
                                    imagesMap[`${rowIndex}_${colIndex}`] = imgData;
                                }
                            }
                        })
                    );
                }
            }

            toast.loading(`Generating PDF: Finalizing...`, { id: toastId });

            const columnStyles = {};
            payload.columns.forEach((col, idx) => {
                if (col.width) {
                    columnStyles[idx] = { cellWidth: col.width };
                }
                if (imageColumnsIndices.includes(idx)) {
                    columnStyles[idx] = { ...columnStyles[idx], cellWidth: 20, minCellHeight: 20, halign: 'center' };
                }
            });

            autoTable(doc, {
                startY: currentY,
                head: heads,
                body: rows,
                theme: 'grid',
                margin: { left: 5, right: 5 },
                styles: { fontSize: 8, cellPadding: 1.5, valign: 'middle', halign: 'left' },
                headStyles: { fillColor: [243, 244, 246], textColor: 31, fontStyle: 'bold', halign: 'center' },
                columnStyles: columnStyles,
                didDrawCell: function (data) {
                    if (data.cell.section === 'body' && imageColumnsIndices.includes(data.column.index)) {
                        const rowIndex = data.row.index;
                        const imgData = imagesMap[`${rowIndex}_${data.column.index}`];
                        if (imgData) {
                            const dim = 14;
                            const x = data.cell.x + (data.cell.width - dim) / 2;
                            const y = data.cell.y + (data.cell.height - dim) / 2;
                            doc.addImage(imgData, 'JPEG', x, y, dim, dim);
                        }
                    }
                }
            });

            // Summary Table
            if (payload.summary && payload.summary.rows && payload.summary.rows.length > 0) {
                const summaryBody = payload.summary.rows.map(row => {
                    return payload.columns.map(col => row[col.key] ?? '');
                });

                autoTable(doc, {
                    startY: (doc.lastAutoTable ? doc.lastAutoTable.finalY : currentY) + 5,
                    head: [],
                    body: summaryBody,
                    styles: { fontSize: 9, fontStyle: 'bold', textColor: [0, 0, 0], cellPadding: 2, fillColor: [248, 250, 252] },
                    theme: 'plain',
                    margin: { left: 105 } // Shift summary to right half (centered on A4)
                });
            }

            // Footer / Signatures
            let finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : currentY) + 25;
            const pageWidth = doc.internal.pageSize.width;
            const pageHeight = doc.internal.pageSize.height;

            if (finalY + 20 > pageHeight) {
                doc.addPage();
                finalY = 30;
            }

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);

            doc.line(startX, finalY, startX + 60, finalY);
            doc.text("Customer Signature", startX, finalY + 5);

            doc.line(pageWidth - 65, finalY, pageWidth - startX, finalY);
            doc.text("Authorized Signature", pageWidth - 65, finalY + 5);

            let filename = payload.filename || `Export_${new Date().toLocaleDateString()}.pdf`;
            filename = filename.replace(/\.xlsx$/, '.pdf').replace(/\//g, '-');
            doc.save(filename);

            toast.success('PDF generated successfully', { id: toastId });
        } catch (error) {
            console.error("PDF Export error:", error);
            toast.error('Failed to generate PDF');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <button
            onClick={handleExport}
            disabled={isExporting}
            className={`flex items-center ${label ? 'gap-2 px-3 sm:px-4' : 'px-1'} py-2 bg-white border border-gray-200 hover:border-red-500 hover:bg-red-50 text-gray-700 hover:text-red-700 rounded-lg transition-all duration-200 shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group ${className}`}
            title={label || "Export PDF"}
        >
            {isExporting ? (
                <div className="h-4 w-4 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
            ) : (
                <FileText className="h-4 w-4 text-red-600 group-hover:scale-110 transition-transform" />
            )}
            {label && <span className="text-sm font-semibold tracking-tight">{label}</span>}
            {label && !isExporting && <Download className="h-3.5 w-3.5 ml-1 opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0 transition-all text-red-600" />}
        </button>
    );
};

export default PdfExportButton;
