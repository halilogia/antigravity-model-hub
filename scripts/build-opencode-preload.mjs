import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preload = path.join(root, 'dist/customPreload.js');
const feature = path.join(root, 'dist/features/opencode-picker/index.js');
// Electron sandbox preloads cannot require local modules. Include the feature in the same script.
fs.writeFileSync(preload, fs.readFileSync(feature, 'utf8') + '\n' + fs.readFileSync(preload, 'utf8'));
