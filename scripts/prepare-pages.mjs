// Cloudflare Pages excludes node_modules paths, including Expo's exported fonts.
// Copy only exported files, flatten asset URLs, and leave the source export intact.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function preparePages(source, destination) {
  const src = path.resolve(source), dst = path.resolve(destination);
  if (src === dst || dst.startsWith(src + path.sep) || src.startsWith(dst + path.sep)) throw new Error('Export and output directories must be separate');
  if (!fs.existsSync(path.join(src, 'index.html'))) throw new Error('Expo export index.html missing');
  if (fs.existsSync(dst)) throw new Error('Use a new output directory to avoid stale or overwritten files');
  const files = [];
  const collect = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Export must not contain symbolic links');
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collect(full);
      else if (entry.isFile()) files.push(path.relative(src, full).split(path.sep).join('/'));
    }
  };
  collect(src);
  const mapping = new Map(files.filter(f => f.startsWith('assets/')).map(f => [f, `assets/files/${createHash('sha256').update(f).digest('hex').slice(0, 16)}-${path.basename(f)}`]));
  const textTypes = new Set(['.js', '.css', '.html', '.json']);
  for (const file of files) {
    const target = path.join(dst, mapping.get(file) || file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (textTypes.has(path.extname(file))) {
      let text = fs.readFileSync(path.join(src, file), 'utf8');
      for (const [from, to] of mapping) text = text.replaceAll(from, to);
      fs.writeFileSync(target, text);
    } else fs.copyFileSync(path.join(src, file), target);
  }
  console.log(`Pages output: ${files.length} files, ${mapping.size} asset URLs prepared.`);
  return { files: files.length, assets: mapping.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error('Usage: node scripts/prepare-pages.mjs <expo-export-directory> <new-pages-directory>');
  preparePages(process.argv[2], process.argv[3]);
}
