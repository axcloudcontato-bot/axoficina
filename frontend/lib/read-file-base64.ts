// Reads a file picked by the user as plain base64 (without the "data:...;base64," prefix).
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error ?? new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

// Opens or saves a file that came back from the API as base64.
export function downloadBase64(name: string, mimeType: string, dataBase64: string): void {
  const bytes = Uint8Array.from(atob(dataBase64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
