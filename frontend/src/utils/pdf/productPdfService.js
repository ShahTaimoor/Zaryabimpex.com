import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Resize and load image as base64
const loadImage = (url) => {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      // Resize logic to prevent memory bloat
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

export const generateProductsPdf = async (products, onProgress) => {
  const doc = new jsPDF('landscape'); // Landscape to give columns more breathing room
  doc.setFontSize(14);
  doc.text("Products Report", 14, 16);

  const rows = [];
  const images = []; // Store images separately to avoid autoTable printing base64 text
  const BATCH_SIZE = 5;

  onProgress?.(5);

  // Process images in batches so the UI doesn't freeze
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (p, idx) => {
        const absoluteIdx = i + idx;
        const imgData = await loadImage(p.imageUrl);
        images[absoluteIdx] = imgData || null;

        rows[absoluteIdx] = [
          absoluteIdx + 1,
          '', // Empty string for Image column so text doesn't print
          p.name || 'N/A',
          p.categoryName || p.category?.name || (typeof p.category === 'string' ? p.category : '-'),
          p.pricing?.cost || 0,
          p.pricing?.retail || 0,
          p.pricing?.wholesale || 0,
          p.inventory?.currentStock || p.stockQuantity || 0
        ];
      })
    );
    // Yield to the main thread briefly
    await new Promise(resolve => setTimeout(resolve, 10));
    const percent = Math.floor(5 + ((i + BATCH_SIZE) / products.length) * 80);
    onProgress?.(Math.min(percent, 85));
  }

  onProgress?.(90);

  autoTable(doc, {
    startY: 24,
    head: [["S.No", "Image", "Product Name", "Category", "Cost Price", "Retail Price", "Whsl Price", "Stock"]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 3, valign: 'middle' },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 20, minCellHeight: 20, halign: 'center' }, // Image column
    },
    didDrawCell: function (data) {
      if (data.column.index === 1 && data.cell.section === 'body') {
        const rowIndex = data.row.index; // autoTable maps body array rows sequentially from 0
        const imgData = images[rowIndex];

        if (imgData && typeof imgData === 'string' && imgData.startsWith('data:image')) {
          const dim = 16;
          const x = data.cell.x + (data.cell.width - dim) / 2;
          const y = data.cell.y + (data.cell.height - dim) / 2;
          doc.addImage(imgData, 'JPEG', x, y, dim, dim);
        }
      }
    }
  });

  onProgress?.(100);
  doc.save(`Products_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
};
