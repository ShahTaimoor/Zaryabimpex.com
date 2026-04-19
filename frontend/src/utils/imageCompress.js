/**
 * Decode a data URL to approximate byte length (base64 payload).
 * @param {string} dataUrl
 */
function dataUrlByteLength(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return 0;
  const idx = dataUrl.indexOf(',');
  if (idx === -1) return 0;
  const b64 = dataUrl.slice(idx + 1);
  return Math.ceil((b64.length * 3) / 4);
}

/**
 * Load an image file, downscale if needed, emit JPEG data URL under maxBytes when possible.
 * @param {File} file
 * @param {{ maxDim?: number, quality?: number, maxBytes?: number }} [options]
 * @returns {Promise<string>}
 */
export function compressImageFileToDataUrl(file, options = {}) {
  const maxDim = options.maxDim ?? 1600;
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const src = reader.result;
      if (typeof src !== 'string') {
        reject(new Error('Invalid file data'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (!w || !h) {
          reject(new Error('Invalid image dimensions'));
          return;
        }
        const scale = Math.min(1, maxDim / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);

        let q = options.quality ?? 0.85;
        const minQ = 0.45;
        let dataUrl = canvas.toDataURL('image/jpeg', q);
        while (dataUrlByteLength(dataUrl) > maxBytes && q > minQ + 0.01) {
          q -= 0.08;
          dataUrl = canvas.toDataURL('image/jpeg', q);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
