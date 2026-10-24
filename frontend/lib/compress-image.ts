// Fotos de câmera de celular moderno saem em resolução altíssima (12-108MP,
// até 20-40MB). Decodificar esse bitmap em memória (largura x altura x 4
// bytes) numa WebView de aparelho fraco/com pouca RAM estoura o limite do
// processo e derruba a aba inteira ("Devido à insuficiência de memória...").
// Por isso toda foto enviada passa por aqui antes do upload: reduz a maior
// dimensão e reencoda como JPEG, cortando tanto o payload de rede quanto o
// custo de decodificação no preview da galeria.
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;

export async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) {
      bitmap.close();
      return file;
    }
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) return file;
    return new File([blob], file.name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    // Decodificação falhou (formato não suportado, memória etc.) — manda o
    // arquivo original e deixa o backend validar/rejeitar.
    return file;
  }
}
