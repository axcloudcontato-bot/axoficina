const MAX_DIMENSION = 1920;
const TARGET_BYTES = 1024 * 1024;
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const HEIF = /\.(heic|heif)$/i;

export class ImagePreparationError extends Error {}

type DecodedImage = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function bitmapOptions(file: File): Promise<ImageBitmapOptions> {
  const options: ImageBitmapOptions = { imageOrientation: 'from-image' };
  // Read only the header to request a smaller bitmap from the decoder for
  // high-resolution JPEG/PNG camera files, before allocating our canvas.
  const bytes = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
  let width = 0;
  let height = 0;
  if (bytes.byteLength >= 24 && bytes.getUint32(0) === 0x89504e47 && bytes.getUint32(4) === 0x0d0a1a0a) {
    width = bytes.getUint32(16); height = bytes.getUint32(20);
  } else if (bytes.byteLength >= 4 && bytes.getUint16(0) === 0xffd8) {
    let position = 2;
    while (position + 4 <= bytes.byteLength && bytes.getUint8(position) === 0xff) {
      const marker = bytes.getUint8(position + 1);
      if (marker === 0xff) { position++; continue; }
      if (marker === 0xda || marker === 0xd9) break;
      const length = bytes.getUint16(position + 2);
      if (length < 2 || position + 2 + length > bytes.byteLength) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) {
        height = bytes.getUint16(position + 5); width = bytes.getUint16(position + 7); break;
      }
      position += 2 + length;
    }
  }
  if (width && height && Math.max(width, height) > MAX_DIMENSION) {
    options.resizeWidth = Math.max(1, Math.round(width * MAX_DIMENSION / Math.max(width, height)));
    options.resizeQuality = 'high';
  }
  return options;
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, await bitmapOptions(file));
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch { /* Some mobile browsers can decode through <img> but not ImageBitmap. */ }
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Image decode failed'));
      image.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => { image.src = ''; URL.revokeObjectURL(url); } };
  } catch {
    image.src = '';
    URL.revokeObjectURL(url);
    throw new ImagePreparationError(HEIF.test(file.name) || /image\/hei[cf]/i.test(file.type)
      ? 'Este navegador não conseguiu abrir a foto HEIC/HEIF. Selecione uma cópia em JPEG ou configure a câmera para salvar fotos em JPEG.'
      : 'Não foi possível abrir esta foto. Tente tirar outra ou selecione uma imagem JPEG, PNG ou WebP.');
  }
}

export async function compressImageFile(file: File): Promise<File> {
  if (!file.size) throw new ImagePreparationError('A foto está vazia. Tire outra foto e tente novamente.');
  if (file.size > MAX_SOURCE_BYTES) throw new ImagePreparationError('A foto original é muito grande. Selecione uma foto de até 50 MiB ou reduza a resolução da câmera.');
  // Camera files can arrive without a MIME type. Accept those for decoding;
  // the resulting JPEG has a known MIME type, signature and matching suffix.
  if (file.type && !file.type.startsWith('image/') && file.type !== 'application/octet-stream') throw new ImagePreparationError('Selecione uma foto JPEG, PNG ou WebP.');
  const decoded = await decodeImage(file);
  const canvas = document.createElement('canvas');
  try {
    if (!decoded.width || !decoded.height) throw new ImagePreparationError('A foto não possui dimensões válidas. Tire outra foto.');
    const scale = Math.min(1, MAX_DIMENSION / Math.max(decoded.width, decoded.height));
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new ImagePreparationError('O navegador não conseguiu preparar a foto. Feche outras abas e tente novamente.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    let blob: Blob | null = null;
    for (const quality of [0.82, 0.68, 0.5]) {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob?.size) throw new ImagePreparationError('Não foi possível preparar a foto para envio. Tire outra foto e tente novamente.');
      if (blob.size <= TARGET_BYTES) break;
    }
    if (!blob || blob.type !== 'image/jpeg' || blob.size > 8 * 1024 * 1024) throw new ImagePreparationError('Não foi possível reduzir esta foto para envio. Selecione outra imagem ou reduza a resolução da câmera.');
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'foto'}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    decoded.release();
    canvas.width = 0;
    canvas.height = 0;
  }
}
