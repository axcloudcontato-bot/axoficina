// Avisa o IndexNow (Bing, Yandex e outros) sobre as URLs do sitemap.
// Uso: pnpm --filter @oficina/frontend indexnow   (rode depois do deploy em produção)
// A chave é pública por desenho: ela precisa estar em https://<site>/<chave>.txt.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://ofix.axcloud.com.br').replace(/\/+$/, '');
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const keyFile = readdirSync(publicDir).find((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('Arquivo de chave IndexNow não encontrado em public/.');
const key = keyFile.replace('.txt', '');
if (readFileSync(path.join(publicDir, keyFile), 'utf8').trim() !== key) throw new Error('Conteúdo da chave diferente do nome do arquivo.');

const sitemap = await (await fetch(`${site}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urlList.length) throw new Error('Nenhuma URL encontrada no sitemap.');

const keyCheck = await fetch(`${site}/${keyFile}`);
if (!keyCheck.ok) throw new Error(`Chave não está publicada em ${site}/${keyFile} (HTTP ${keyCheck.status}). Faça o deploy antes.`);

const res = await fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(site).host, key, keyLocation: `${site}/${keyFile}`, urlList }),
});
console.log(`IndexNow: HTTP ${res.status} para ${urlList.length} URLs`);
if (!res.ok && res.status !== 202) process.exit(1);
