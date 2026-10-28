import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.resolve(rootDir, '..', 'exercises-dataset');
const targetDir = path.resolve(rootDir, 'android', 'app', 'src', 'main', 'assets', 'exercises-dataset');

const required = ['data', 'images', 'videos'];

for (const entry of required) {
  const sourcePath = path.join(sourceDir, entry);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing required dataset folder: ${sourcePath}`);
  }
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });

for (const entry of required) {
  const sourcePath = path.join(sourceDir, entry);
  const targetPath = path.join(targetDir, entry);
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

const readmeSource = path.join(sourceDir, 'README.md');
if (fs.existsSync(readmeSource)) {
  fs.copyFileSync(readmeSource, path.join(targetDir, 'README.md'));
}

console.log(`✅ Copied exercise dataset into Android assets: ${targetDir}`);
console.log(`   Included folders: ${required.join(', ')}`);
