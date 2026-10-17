// Project previews show at 128px in the list; 640px wide keeps them sharp on high-DPI screens and small on disk.
const PREVIEW_WIDTH = 640;

// Decodes any image Chromium understands (PNG, JPEG, WebP, GIF, BMP, AVIF...) and re-encodes it as a PNG,
// scaled down to PREVIEW_WIDTH.
export const toPreviewPng = (dataUrl: string): Promise<Uint8Array> => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
        const scale = Math.min(1, PREVIEW_WIDTH / img.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error('Canvas is not available.'));
            return;
        }
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error('Could not encode the image.'));
                return;
            }
            blob.arrayBuffer().then(buffer => resolve(new Uint8Array(buffer)), reject);
        }, 'image/png');
    };
    img.onerror = () => reject(new Error('The file could not be read as an image.'));
    img.src = dataUrl;
});
