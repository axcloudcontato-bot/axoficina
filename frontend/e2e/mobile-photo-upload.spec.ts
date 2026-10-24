import { expect, test, type Page } from '@playwright/test';
import { LEGAL_VERSION } from '@oficina/contracts';
import { createServer, type Server } from 'node:http';

const uploadServers: Server[] = [];
test.afterEach(async () => {
  for (const server of uploadServers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((version) => {
    localStorage.setItem('ax-privacy-choice', JSON.stringify({ version, necessary: true, analytics: false, marketing: false, savedAt: new Date().toISOString() }));
    localStorage.setItem('oficina-auth', JSON.stringify({ state: { accessToken: 'photo-test', refreshToken: 'test-refresh', user: { id: 'u1', tenantId: 't1', name: 'Mecânico', email: 'test@example.invalid', role: 'MECHANIC', permissions: ['service_orders.view', 'service_orders.manage', 'customers.view'], status: 'active', createdAt: '2026-10-24T00:00:00Z' } }, version: 0 }));
  }, LEGAL_VERSION);
});

async function mockOrder(page: Page, failures = 0, refreshGate?: Promise<void>) {
  const order = { id: 'order-1', tenant_id: 't1', order_number: 4, customer_id: 'c1', customer_name: 'Cliente de teste', customer_phone: '11999998888', vehicle_id: 'v1', vehicle_brand: 'Honda', vehicle_model: 'HR-V', vehicle_plate: 'ABC1D35', status: 'OPEN', opened_at: '2026-10-24T12:00:00Z', created_at: '2026-10-24T12:00:00Z', status_history: [], items: [] };
  const uploaded: Array<{ name: string; mime: string; bytes: Buffer }> = [];
  const photos: unknown[] = [];
  // Receive real multipart bytes over HTTP: WebKit's request interception
  // omits file bodies from postDataBuffer(), unlike Chromium.
  const receiver = createServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS' });
      response.end(); return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks);
    const boundary = /boundary="?([^";]+)"?/.exec(request.headers['content-type']!)![1];
    const header = /name="file"; filename="([^"]+)"\r\nContent-Type: ([^\r]+)\r\n\r\n/.exec(body.toString('latin1'))!;
    expect(body.toString('latin1')).toContain('name="serviceOrderId"\r\n\r\norder-1');
    expect(body.toString('latin1')).toContain('name="angle"\r\n\r\nFRONT');
    const start = header.index + header[0].length;
    const bytes = body.subarray(start, body.indexOf(`\r\n--${boundary}`, start));
    uploaded.push({ name: header[1], mime: header[2], bytes });
    let status = 201;
    let json: unknown;
    if (uploaded.length <= failures) { status = 503; json = { error: { message: 'O servidor não conseguiu salvar a foto. Tente novamente.' } }; }
    else {
      const photo = { id: 'photo-1', service_order_id: 'order-1', category: 'ENTRY', angle: 'FRONT', original_name: header[1], mime_type: header[2], size_bytes: bytes.length, created_at: new Date().toISOString() };
      photos.push(photo); json = { photo };
    }
    response.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    response.end(JSON.stringify(json));
  });
  uploadServers.push(receiver);
  await new Promise<void>((resolve) => receiver.listen(0, '127.0.0.1', resolve));
  const uploadUrl = `http://127.0.0.1:${(receiver.address() as { port: number }).port}/upload`;
  await page.route('**/api/v1/**', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let json: unknown = { items: [], total: 0, offset: 0, limit: 100, has_more: false };
    if (path.endsWith('/settings/branding')) json = { company: { name: 'AX Oficina' } };
    if (path.endsWith('/service-order')) json = { service_order: order };
    if (path.endsWith('/service-orders/photos')) {
      if (request.method() === 'POST') {
        return route.continue({ url: uploadUrl });
      } else {
        if (uploaded.length && refreshGate) await refreshGate;
        json = { photos };
      }
    }
    if (path.endsWith('/service-orders/photos/content')) return route.fulfill({ body: uploaded.at(-1)!.bytes, contentType: 'image/jpeg', headers: { 'access-control-allow-origin': '*' } });
    await route.fulfill({ json, headers: { 'access-control-allow-origin': '*' } });
  });
  return uploaded;
}

async function cameraJpeg(page: Page) {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 3000; canvas.height = 2000;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#2463eb'; context.fillRect(0, 0, 3000, 2000);
    context.fillStyle = '#fff'; context.font = '180px sans-serif'; context.fillText('FOTO DA OS', 200, 500);
    return canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
  });
  const jpeg = Buffer.from(data, 'base64');
  // EXIF orientation 6: the phone holds the camera in portrait orientation.
  const exif = Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000600000000000000', 'hex');
  // Trailing bytes emulate an original exceeding the server's 8 MiB limit.
  return Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2), Buffer.alloc(9 * 1024 * 1024)]);
}

for (const fallback of [false, true]) test(`camera photo is normalized and saved on mobile ${fallback ? 'with the image-element fallback' : 'with ImageBitmap'}`, async ({ page }) => {
  if (fallback) await page.addInitScript(() => Object.defineProperty(window, 'createImageBitmap', { value: undefined, configurable: true }));
  const uploaded = await mockOrder(page);
  await page.goto('/service-orders/order-1');
  const file = await cameraJpeg(page);
  const slot = page.getByRole('group', { name: 'Foto: Frente', exact: true });
  const chooser = page.waitForEvent('filechooser');
  await slot.getByRole('button', { name: 'Câmera', exact: true }).click();
  const capture = await chooser;
  expect(await capture.element().getAttribute('capture')).toBe('environment');
  await capture.setFiles({ name: 'camera-sem-tipo.jpg', mimeType: '', buffer: file });
  await expect(slot.getByRole('status')).toHaveText('Foto salva na OS.');
  await expect(page.getByText('Foto de frente salva na OS.', { exact: true })).toBeVisible();
  expect(uploaded).toHaveLength(1);
  expect(uploaded[0].mime).toBe('image/jpeg');
  expect(uploaded[0].name).toMatch(/\.jpg$/);
  expect(uploaded[0].bytes.subarray(0, 3).toString('hex')).toBe('ffd8ff');
  expect(uploaded[0].bytes.length).toBeLessThan(1024 * 1024);
  const dimensions = await page.evaluate(async (data) => {
    const url = URL.createObjectURL(new Blob([new Uint8Array(data)], { type: 'image/jpeg' }));
    const image = new Image();
    await new Promise<void>((resolve) => { image.onload = () => resolve(); image.src = url; });
    const size = { width: image.naturalWidth, height: image.naturalHeight }; URL.revokeObjectURL(url); return size;
  }, [...uploaded[0].bytes]);
  expect(dimensions.height).toBe(1920);
  expect(dimensions.width).toBe(1280);
  await expect(slot.getByRole('img', { name: /^Foto camera/ })).toBeVisible();
  await slot.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts/mobile-photo-${fallback ? 'fallback' : 'bitmap'}.png`, fullPage: true });
  // A second capture with the same filename must still trigger upload.
  await slot.locator('input[capture]').setInputFiles({ name: 'camera-sem-tipo.jpg', mimeType: '', buffer: file });
  await expect.poll(() => uploaded.length).toBe(2);
});

test('unsupported HEIC shows an actionable error before uploading', async ({ page }) => {
  const uploaded = await mockOrder(page);
  await page.goto('/service-orders/order-1');
  const slot = page.getByRole('group', { name: 'Foto: Frente', exact: true });
  await slot.locator('input[capture]').setInputFiles({ name: 'camera.heic', mimeType: 'image/heic', buffer: Buffer.from('unsupported-heic-fixture') });
  await expect(slot.getByRole('alert')).toContainText('Selecione uma cópia em JPEG');
  expect(uploaded).toHaveLength(0);
  await expect(slot.getByRole('button', { name: 'Câmera', exact: true })).toBeEnabled();
});

test('a refused upload can retry the prepared photo without opening the camera again', async ({ page }) => {
  const uploaded = await mockOrder(page, 1);
  await page.goto('/service-orders/order-1');
  const slot = page.getByRole('group', { name: 'Foto: Frente', exact: true });
  await slot.locator('input[capture]').setInputFiles({ name: 'camera.jpg', mimeType: 'image/jpeg', buffer: await cameraJpeg(page) });
  await expect(slot.getByRole('alert')).toHaveText('O servidor não conseguiu salvar a foto. Tente novamente.');
  await slot.getByRole('button', { name: 'Tentar enviar novamente', exact: true }).click();
  await expect(slot.getByRole('status')).toHaveText('Foto salva na OS.');
  expect(uploaded).toHaveLength(2);
  expect(uploaded[0].bytes.equals(uploaded[1].bytes)).toBe(true);
});

test('the saved photo appears without waiting for a slow gallery refresh', async ({ page }) => {
  let releaseRefresh!: () => void;
  const gate = new Promise<void>((resolve) => { releaseRefresh = resolve; });
  await mockOrder(page, 0, gate);
  await page.goto('/service-orders/order-1');
  const slot = page.getByRole('group', { name: 'Foto: Frente', exact: true });
  try {
    await slot.locator('input[capture]').setInputFiles({ name: 'camera.jpg', mimeType: 'image/jpeg', buffer: await cameraJpeg(page) });
    await expect(slot.getByRole('status')).toHaveText('Foto salva na OS.');
    await expect(slot.getByRole('img', { name: /^Foto camera/ })).toBeVisible();
    await expect(slot.getByRole('button', { name: 'Câmera', exact: true })).toBeEnabled();
  } finally { releaseRefresh(); }
});
