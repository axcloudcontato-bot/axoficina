import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site';

export const alt = `${SITE_NAME} — Sistema para oficina mecânica`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const svg = await readFile(path.join(process.cwd(), 'public', 'brand', 'ofix-logo-light-notag.svg'));
  const logo = `data:image/svg+xml;base64,${svg.toString('base64')}`;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 96px', background: '#0F171F', color: '#fff', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, background: '#FFBE00', display: 'flex' }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={560} height={205} alt="" />
        <div style={{ display: 'flex', marginTop: 48, fontSize: 56, fontWeight: 700, lineHeight: 1.15 }}>{SITE_TAGLINE}.</div>
        <div style={{ display: 'flex', marginTop: 20, fontSize: 30, color: '#B8C2CC' }}>Ordens de serviço, WhatsApp, agenda e financeiro em um só sistema.</div>
        <div style={{ display: 'flex', position: 'absolute', right: 96, bottom: 56, fontSize: 28, fontWeight: 700, color: '#FFBE00' }}>ofix.axcloud.com.br</div>
      </div>
    ),
    size,
  );
}
