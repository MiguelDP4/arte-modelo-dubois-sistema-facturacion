export interface CompressedImagePayload {
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  dataBase64: string;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('No se pudo leer la imagen.'));
      }
    };
    reader.onerror = () => reject(new Error('Error leyendo archivo de imagen.'));
    reader.readAsDataURL(file);
  });
}

function normalizeMimeType(
  rawType: string,
): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (rawType === 'image/png') return 'image/png';
  if (rawType === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

export async function compressImageFile(
  file: File,
  maxDimension = 1200,
  quality = 0.82,
): Promise<CompressedImagePayload> {
  const dataUrl = await readAsDataUrl(file);
  const mimeType = normalizeMimeType(file.type);

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return { fileName: file.name, mimeType, dataBase64: dataUrl };
  }

  let has2dCanvas = false;
  try {
    const testCanvas = document.createElement('canvas');
    has2dCanvas = Boolean(testCanvas.getContext?.('2d'));
  } catch {
    has2dCanvas = false;
  }
  if (!has2dCanvas) {
    return { fileName: file.name, mimeType, dataBase64: dataUrl };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext?.('2d');
      if (!ctx || img.width <= 0 || img.height <= 0) {
        resolve({ fileName: file.name, mimeType, dataBase64: dataUrl });
        return;
      }

      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const outputMime =
        mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      const compressed = canvas.toDataURL(outputMime, quality);
      resolve({
        fileName: file.name,
        mimeType: outputMime,
        dataBase64: compressed,
      });
    };
    img.onerror = () => {
      resolve({ fileName: file.name, mimeType, dataBase64: dataUrl });
    };
    img.src = dataUrl;
  });
}
