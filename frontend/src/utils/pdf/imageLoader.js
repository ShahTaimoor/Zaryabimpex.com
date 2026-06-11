/** Load remote image as compressed JPEG data URL for jsPDF embedding. */
export function loadImageForPdf(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);

    const timeout = setTimeout(() => resolve(null), 3000);

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
      } else if (height > MAX_DIM) {
        width *= MAX_DIM / height;
        height = MAX_DIM;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(width, 1);
      canvas.height = Math.max(height, 1);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };
    img.src = url;
  });
}
