/** Spec Phase 4 – Fotos clientseitig auf höchstens ~1600 px (längste Kante) verkleinern. */
export const MAX_PHOTO_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export function targetSize(
  width: number,
  height: number,
  max: number = MAX_PHOTO_EDGE,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Verkleinert ein Foto (Canvas → JPEG). Ohne Bild-API, bei Lesefehlern (z. B. HEIC in älteren
 * Browsern) oder wenn das Ergebnis nicht kleiner ist, bleibt das Original erhalten.
 */
export async function compressImage(blob: Blob, max: number = MAX_PHOTO_EDGE): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return blob;
  try {
    const bitmap = await createImageBitmap(blob);
    const { width, height } = targetSize(bitmap.width, bitmap.height, max);
    let out: Blob | null = null;
    if (typeof OffscreenCanvas === 'function') {
      const canvas = new OffscreenCanvas(width, height);
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
      out = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(bitmap, 0, 0, width, height);
        out = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
        });
      }
    }
    bitmap.close();
    return out && out.size < blob.size ? out : blob;
  } catch {
    return blob;
  }
}
