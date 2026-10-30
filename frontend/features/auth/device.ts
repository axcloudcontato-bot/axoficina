// "Chrome em Windows", "Safari em iPhone": enough for the person to recognize their own devices.
export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Aparelho desconhecido';
  const os = /iPhone/.test(userAgent) ? 'iPhone' : /iPad/.test(userAgent) ? 'iPad' : /Android/.test(userAgent) ? 'Android' : /Windows/.test(userAgent) ? 'Windows' : /Mac OS X|Macintosh/.test(userAgent) ? 'Mac' : /Linux/.test(userAgent) ? 'Linux' : null;
  // Order matters: Edge and Opera also say Chrome, and Chrome also says Safari.
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /OPR\/|Opera/.test(userAgent) ? 'Opera' : /Firefox\//.test(userAgent) ? 'Firefox' : /Chrome\/|CriOS/.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : null;
  if (browser && os) return `${browser} em ${os}`;
  return browser ?? os ?? 'Aparelho desconhecido';
}
