/* eslint-env node */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const repoRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(repoRoot, 'src', 'assets');
const resDir = path.join(repoRoot, 'android', 'app', 'src', 'main', 'res');
if (!fs.existsSync(assetsDir)) {fs.mkdirSync(assetsDir, {recursive: true});}

// Prefer the user-provided source; fall back to the largest icon already built
const sourceCandidates = [
  path.join(assetsDir, 'logo_source.png'),
  path.join(resDir, 'mipmap-xxxhdpi', 'ic_launcher.png'),
];
const src = sourceCandidates.find(p => fs.existsSync(p));
if (!src) {
  console.error('No source logo found. Place the artwork at src/assets/logo_source.png.');
  process.exit(1);
}
console.log('Using source:', src);

// ── Design constants ────────────────────────────────────────────────────────
const PLATE_HEX = '#0B0F14'; // dark plate that replaces the launcher's white one
const PLATE_RGB = {r: 0x0b, g: 0x0f, b: 0x14, alpha: 1};
const CORNER_RADIUS_RATIO = 0.22; // plate corner radius, as a share of the edge

// Adaptive icons: 108dp layers, only the central 66dp circle is guaranteed to
// survive every launcher mask. The artwork already has ~22% rounded corners, so
// 0.58 keeps it inside the mask while still looking bold.
const ADAPTIVE_LAYER_RATIO = 0.58;
const ADAPTIVE_SIZES = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

// Legacy bitmaps (API < 26) are shown as-is, so the plate is baked in.
const LEGACY_SQUARE_RATIO = 0.64;
const LEGACY_ROUND_RATIO = 0.56;
const LEGACY_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const MASTER_4K = 4096; // high-res master for artwork / future re-exports
const MASTER_IN_APP = 1024; // what the JS bundle actually loads

const plateSquare = (size, radius) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${PLATE_HEX}"/>` +
      `</svg>`,
  );

const plateCircle = size =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${PLATE_HEX}"/>` +
      `</svg>`,
  );

const transparentCanvas = size =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect x="0" y="0" width="${size}" height="${size}" fill="none"/>` +
      `</svg>`,
  );

// Fit the artwork inside `size * ratio` without touching its aspect ratio.
const fitLogo = (source, size, ratio) => {
  const inner = Math.max(1, Math.round(size * ratio));
  return sharp(source)
    .resize(inner, inner, {fit: 'inside', kernel: 'lanczos3', background: {r: 0, g: 0, b: 0, alpha: 0}})
    .png()
    .toBuffer();
};

const writePng = async (file, bufferOrImage) => {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  await (bufferOrImage.toFile ? bufferOrImage.png().toFile(file) : sharp(bufferOrImage).png().toFile(file));
};

(async function () {
  try {
    // 0) Trim the transparent padding so the artwork fills its own frame.
    const cropped = await sharp(src, {failOnError: false})
      .ensureAlpha()
      .trim({threshold: 5})
      .png()
      .toBuffer();

    const croppedMeta = await sharp(cropped).metadata();
    console.log(`Artwork content: ${croppedMeta.width}x${croppedMeta.height}`);

    // 1) 4K master. The source tops out near 800px, so this is a high-quality
    //    resample + light unsharp mask — it smooths the edges nicely but cannot
    //    invent detail that the source never had.
    const master4kPath = path.join(assetsDir, 'logo_master_4k.png');
    await sharp(cropped)
      .resize(MASTER_4K, MASTER_4K, {
        fit: 'contain',
        kernel: 'lanczos3',
        background: {r: 0, g: 0, b: 0, alpha: 0},
      })
      .sharpen({sigma: 0.8})
      .png({compressionLevel: 9})
      .toFile(master4kPath);
    console.log('Wrote 4K master:', master4kPath);

    // 2) In-app transparent master (this is the one Metro bundles).
    const masterPath = path.join(assetsDir, 'logo_master.png');
    await sharp(master4kPath)
      .resize(MASTER_IN_APP, MASTER_IN_APP, {
        fit: 'contain',
        kernel: 'lanczos3',
        background: {r: 0, g: 0, b: 0, alpha: 0},
      })
      .png({compressionLevel: 9})
      .toFile(masterPath);
    console.log('Wrote in-app master:', masterPath);

    await sharp(master4kPath).resize(512, 512).png({compressionLevel: 9}).toFile(path.join(assetsDir, 'logo.png'));
    console.log('Wrote in-app logo:', path.join(assetsDir, 'logo.png'));

    // 3) Adaptive icons (API 26+) — the foreground art sits on a transparent
    //    layer and the launcher supplies the dark plate plus its own mask.
    const foregroundSizes = {};
    for (const [folder, size] of Object.entries(ADAPTIVE_SIZES)) {
      const outDir = path.join(resDir, folder);
      fs.mkdirSync(outDir, {recursive: true});

      const logo = await fitLogo(master4kPath, size, ADAPTIVE_LAYER_RATIO);
      const foreground = await sharp({
        create: {width: size, height: size, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}},
      })
        .composite([{input: logo, gravity: 'center'}])
        .png()
        .toBuffer();

      const file = path.join(outDir, 'ic_launcher_foreground.png');
      fs.writeFileSync(file, foreground);
      foregroundSizes[folder] = size;
      console.log('Wrote', file);
    }

    // 4) Legacy bitmaps (API 24-25) — plate baked in, no launcher mask applied.
    for (const [folder, size] of Object.entries(LEGACY_SIZES)) {
      const outDir = path.join(resDir, folder);
      fs.mkdirSync(outDir, {recursive: true});

      const squareLogo = await fitLogo(master4kPath, size, LEGACY_SQUARE_RATIO);
      const square = await sharp(plateSquare(size, Math.round(size * CORNER_RADIUS_RATIO)))
        .composite([{input: squareLogo, gravity: 'center'}])
        .png()
        .toBuffer();
      fs.writeFileSync(path.join(outDir, 'ic_launcher.png'), square);

      const roundLogo = await fitLogo(master4kPath, size, LEGACY_ROUND_RATIO);
      const round = await sharp(plateCircle(size))
        .composite([{input: roundLogo, gravity: 'center'}])
        .png()
        .toBuffer();
      fs.writeFileSync(path.join(outDir, 'ic_launcher_round.png'), round);

      console.log('Wrote legacy icons in', folder, `(${size}px)`);
    }

    // 5) Adaptive icon definitions + shared plate colour.
    const anydpiDir = path.join(resDir, 'mipmap-anydpi-v26');
    fs.mkdirSync(anydpiDir, {recursive: true});
    const adaptiveXml =
      `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n` +
      `    <background android:drawable="@color/ic_launcher_background"/>\n` +
      `    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n` +
      `</adaptive-icon>\n`;
    fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), adaptiveXml);
    fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), adaptiveXml);

    const valuesDir = path.join(resDir, 'values');
    fs.mkdirSync(valuesDir, {recursive: true});
    fs.writeFileSync(
      path.join(valuesDir, 'ic_launcher_background.xml'),
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${PLATE_HEX}</color>\n</resources>\n`,
    );
    console.log('Wrote adaptive icon xml + plate colour.');

    // Keep the placeholder canvas helper referenced so lint does not flag it as
    // dead code if it is ever needed for a transparent master.
    void transparentCanvas;
    void PLATE_RGB;
    void writePng;

    console.log('Icon generation complete.');
  } catch (e) {
    console.error('Error generating icons:', e);
    process.exit(2);
  }
})();
