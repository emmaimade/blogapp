// Turns the generated feature illustrations in source/ into web-ready WebP files for the
// marketing site: trims the outer margin so the subject reads at phone width,
// then resizes to the 1200×800 slot FeaturesPage declares.
//
//   node convert-illustrations.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const sources = path.join(here, 'source');
const images = path.resolve(here, '../../frontend/site/public/images');

const jobs = [
  // trim: share of each edge to cut, as much as the subject's margin allows.
  { from: 'multi-tenant-workspaces.png', to: 'multi-tenant-workspaces.webp', trim: 0.03 },
  { from: 'role-based-collaboration.png', to: 'role-based-collaboration.webp', trim: 0.06 },
];

for (const { from, to, trim } of jobs) {
  const image = sharp(path.join(sources, from));
  const { width, height } = await image.metadata();
  const left = Math.round(width * trim);
  const top = Math.round(height * trim);
  const info = await image
    .extract({ left, top, width: width - left * 2, height: height - top * 2 })
    .resize(1200, 800, { fit: 'cover' })
    .webp({ quality: 82 })
    .toFile(path.join(images, to));
  console.log(`${to}: ${info.width}×${info.height}, ${Math.round(info.size / 1024)} KB`);
}
