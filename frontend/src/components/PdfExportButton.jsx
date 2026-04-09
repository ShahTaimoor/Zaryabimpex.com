import React, { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { toast } from 'sonner';

/**
 * A professional Export PDF button component
 * @param {Object} props
 * @param {Function} props.getData - Function that returns the payload { title, columns, data, summary, filename }
 * @param {string} props.label - Button label
 * @param {string} props.className - Custom CSS classes
 */
const PdfExportButton = ({ getData, label = "PDF", className = "" }) => {
    const [isExporting, setIsExporting] = useState(false);

    const loadImage = (url) => {
      return new Promise((resolve) => {
        if (!url) return resolve(null);
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
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
        img.onerror = () => resolve(null);
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

            const doc = new jsPDF(payload.orientation || 'landscape');
            doc.setFontSize(14);
            doc.text(payload.title || "Report", 14, 16);

            const heads = [payload.columns.map(c => c.header)];
            const imageColumnsIndices = [];
            payload.columns.forEach((col, idx) => {
                if (col.type === 'image' || col.key === 'imageUrl' || col.key === 'image') {
                    imageColumnsIndices.push(idx);
                }
            });

            const rows = [];
            const imagesMap = {}; // rowIndex_colIndex -> base64
            const BATCH_SIZE = 5;

            // Generate rows
            for (let i = 0; i < payload.data.length; i += BATCH_SIZE) {
                const batch = payload.data.slice(i, i + BATCH_SIZE);
                await Promise.all(
                    batch.map(async (item, idx) => {
                        const absoluteIdx = i + idx;
                        const rowData = [];
                        
                        for (let c = 0; c < payload.columns.length; c++) {
                            const col = payload.columns[c];
                            let val = item[col.key] ?? '';
                            
                            if (imageColumnsIndices.includes(c)) {
                                const imgData = await loadImage(val);
                                if (imgData) {
                                    imagesMap[`${absoluteIdx}_${c}`] = imgData;
                                }
                                rowData.push(''); // Empty string so autoTable doesn't print base64
                            } else {
                                rowData.push(String(val));
                            }
                        }
                        rows[absoluteIdx] = rowData;
                    })
                );
                await new Promise(resolve => setTimeout(resolve, 10));
                const progress = Math.floor(5 + ((i + BATCH_SIZE) / payload.data.length) * 80);
                toast.loading(`Generating PDF: ${Math.min(progress, 85)}%`, { id: toastId });
            }

            toast.loading(`Generating PDF: Finalizing...`, { id: toastId });

            const columnStyles = {};
            imageColumnsIndices.forEach(idx => {
                columnStyles[idx] = { cellWidth: 20, minCellHeight: 20, halign: 'center' };
            });

            autoTable(doc, {
                startY: 24,
                head: heads,
                body: rows,
                styles: { fontSize: 8, cellPadding: 3, valign: 'middle' },
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'center' },
                columnStyles: columnStyles,
                didDrawCell: function(data) {
                    if (data.cell.section === 'body' && imageColumnsIndices.includes(data.column.index)) {
                        const rowIndex = data.row.index;
                        const imgData = imagesMap[`${rowIndex}_${data.column.index}`];
                        if (imgData) {
                            const dim = 16;
                            const x = data.cell.x + (data.cell.width - dim) / 2;
                            const y = data.cell.y + (data.cell.height - dim) / 2;
                            doc.addImage(imgData, 'JPEG', x, y, dim, dim);
                        }
                    }
                }
            });

            // If there's a summary row, print it
            if (payload.summary && payload.summary.rows && payload.summary.rows.length > 0) {
               const summaryBody = payload.summary.rows.map(row => {
                   return payload.columns.map(col => row[col.key] ?? '');
               });
               autoTable(doc, {
                   startY: doc.lastAutoTable.finalY + 5,
                   head: [], // No header for summary
                   body: summaryBody,
                   styles: { fontSize: 9, fontStyle: 'bold', textColor: [0,0,0], cellPadding: 4, fillColor: [240, 240, 240] },
                   theme: 'plain'
               });
            }

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
