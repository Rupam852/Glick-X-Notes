/**
 * Client-side high-efficiency image compression utility.
 * Compresses images using HTML Canvas before saving to local storage or sending to AI vision APIs.
 * Reduces 5MB-10MB camera shots/screenshots down to ~60KB-120KB without perceptible visual quality loss.
 */

export interface CompressedImage {
  id: string;
  name: string;
  dataUrl: string;
  base64: string;
  mimeType: string;
  sizeKb: number;
}

export async function compressImage(
  fileOrBlob: File | Blob,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.72
): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));

    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context for image compression'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
        const sizeKb = Math.round((base64.length * 3) / 4 / 1024);

        const fileName = (fileOrBlob as File).name || `image_${Date.now()}.jpg`;

        resolve({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: fileName,
          dataUrl,
          base64,
          mimeType,
          sizeKb
        });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to decode image'));
    reader.readAsDataURL(fileOrBlob);
  });
}
