import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/site';

export const alt = `${SITE_NAME} — Sistema para oficina mecânica`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const svg = await readFile(path.join(process.cwd(), 'public', 'brand', 'ofix-logo-light-notag.svg'));
  const logo = `data:image/svg+xml;base64,${svg.toString('base64')}`;

  return new ImageResponse(
    (
      // Só a logo, centralizada e com margem: o WhatsApp e outros apps recortam a imagem
      // num quadrado central (630x630), então ela precisa caber inteira nessa área.
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F171F', position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={540} height={198} alt="" />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 18, background: '#FFBE00', display: 'flex' }} />
      </div>
    ),
    size,
  );
}
