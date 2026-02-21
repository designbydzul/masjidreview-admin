import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distPath = resolve(__dirname, '..', 'dist', 'index.html');
const outPath = resolve(__dirname, '..', 'src', 'worker', 'frontend.js');

const html = readFileSync(distPath, 'utf-8');

// Escape backticks and ${} for template literal
const escaped = html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

writeFileSync(outPath, `export default \`${escaped}\`;\n`);

console.log('✅ Frontend embedded into src/worker/frontend.js');
