// Captures the marketing screenshots of admin-studio and the social share
// image, and writes them into frontend/site/public.
//
// Needs admin-studio running against a backend seeded by
// backend/scripts/seed_demo.py (see README.md). Never point this at real data.
//
//   STUDIO_URL=http://localhost:5190 node capture.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const STUDIO = process.env.STUDIO_URL || 'http://localhost:5190';
const PASSWORD = 'DemoPass123!';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, '../../frontend/site/public');
const raw = path.join(here, 'out');
const fileUrl = (p) => pathToFileURL(p).href;

const shots = [
  {
    name: 'platform-admin',
    login: 'morgan@example.com',
    path: '/admin/subscriptions',
    address: 'studio · subscriptions',
    // From the page heading down to the sixth workspace row.
    region: async (page) => ({
      top: page.getByRole('heading', { name: 'Subscriptions', exact: true }),
      bottom: page.getByText('Fieldnotes', { exact: true }),
      bottomPad: 34,
    }),
  },
  {
    name: 'publishing-control',
    login: 'lena@example.com',
    path: '/admin/w/lumen-studio/posts/edit/16',
    address: 'studio · lumen-studio · posts',
    prepare: async (page) => {
      // Open the scheduler so the calendar and time are in the shot.
      const toggle = page.getByText('Show scheduler');
      if (await toggle.isVisible().catch(() => false)) await toggle.click();
    },
    // From the post title down to the bottom of the Publish card.
    region: async (page) => ({
      top: page.getByPlaceholder('Give your post a title…'),
      bottom: page.getByRole('button', { name: 'Cancel schedule' }),
      bottomPad: 18,
    }),
  },
];

async function login(page, email) {
  await page.goto(`${STUDIO}/admin/login`);
  await page.locator('input:not([type=password]):not([type=checkbox])').first().fill(email);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20_000 });
}

async function captureStudio(browser) {
  for (const shot of shots) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: 'light',
      timezoneId: 'Africa/Lagos',
      locale: 'en-GB',
    });
    const page = await context.newPage();
    await login(page, shot.login);
    await page.goto(STUDIO + shot.path);
    await page.waitForLoadState('networkidle');
    await shot.prepare?.(page);
    await page.waitForTimeout(800);

    // Crop to the main content column: the sidebar edge on the left, the same
    // gutter mirrored on the right.
    const { top, bottom, bottomPad } = await shot.region(page);
    const sidebar = await page.locator('aside').first().boundingBox();
    // Pages also render a hidden mobile layout; measure the visible match.
    const heading = await top.filter({ visible: true }).first().boundingBox();
    const end = await bottom.filter({ visible: true }).first().boundingBox();
    const gutter = heading.x - (sidebar.x + sidebar.width);
    const x = heading.x - 24;
    const clip = {
      x,
      y: heading.y - 24,
      width: 1440 - gutter + 24 - x,
      height: end.y + end.height + bottomPad - (heading.y - 24),
    };
    const file = path.join(raw, `${shot.name}.png`);
    await page.screenshot({ path: file, clip, fullPage: true });
    await context.close();

    await frame(browser, shot, file, clip);
  }
}

async function frame(browser, shot, file, clip) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
  const query = new URLSearchParams({ src: fileUrl(file), url: shot.address, w: clip.width, h: clip.height });
  await page.goto(`${fileUrl(path.join(here, 'templates/frame.html'))}?${query}`);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot();
  await page.close();
  const info = await sharp(png).webp({ quality: 85 }).toFile(path.join(site, 'images', `${shot.name}.webp`));
  console.log(`images/${shot.name}.webp: ${info.width}×${info.height}, ${Math.round(info.size / 1024)} KB`);
}

async function captureOg(browser) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const query = new URLSearchParams({
    // The full-quality original, not the compressed WebP.
    art: fileUrl(path.join(here, 'source/multi-tenant-workspaces.png')),
    logo: fileUrl(path.join(site, 'inko-logo.svg')),
  });
  await page.goto(`${fileUrl(path.join(here, 'templates/og.html'))}?${query}`);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot();
  await page.close();
  const info = await sharp(png).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(path.join(site, 'og-image.png'));
  console.log(`og-image.png: ${info.width}×${info.height}, ${Math.round(info.size / 1024)} KB`);
}

await fs.mkdir(raw, { recursive: true });
const browser = await chromium.launch();
try {
  const only = process.argv[2];
  if (!only || only === 'studio') await captureStudio(browser);
  if (!only || only === 'og') await captureOg(browser);
} finally {
  await browser.close();
}
