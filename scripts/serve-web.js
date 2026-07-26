const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const port = Number(process.env.PORT || 8083);
const root = path.resolve(process.argv[2] || 'dist');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const routeTemplates = [];
const collectRouteTemplates = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectRouteTemplates(target);
    } else if (entry.isFile() && entry.name.endsWith('.html') && target.includes(`${path.sep}[`)) {
      routeTemplates.push(target);
    }
  }
};

if (fs.existsSync(root)) collectRouteTemplates(root);

const findDynamicRoute = (relativePath) => {
  const requestSegments = relativePath.replace(/\.html$/, '').split('/');
  return routeTemplates.find((template) => {
    const routeSegments = path.relative(root, template).replaceAll(path.sep, '/').replace(/\.html$/, '').split('/');
    return routeSegments.length === requestSegments.length && routeSegments.every(
      (segment, index) => /^\[[^\]]+\]$/.test(segment) || segment === requestSegments[index],
    );
  });
};

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidates = path.extname(relativePath)
    ? [relativePath]
    : [`${relativePath}.html`, path.join(relativePath, 'index.html')];
  const exactTarget = candidates
    .map((candidate) => path.resolve(root, candidate))
    .find((candidate) => candidate.startsWith(`${root}${path.sep}`) && fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  const singlePageTarget = path.join(root, 'index.html');
  const target = exactTarget
    || (!path.extname(relativePath) ? findDynamicRoute(relativePath) : undefined)
    || (!path.extname(relativePath) && fs.existsSync(singlePageTarget) ? singlePageTarget : undefined);

  if (!target) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('ページが見つかりません。Web書き出しをやり直してください。');
    return;
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': contentTypes[path.extname(target)] || 'application/octet-stream',
  });
  fs.createReadStream(target).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`TSUDOWA Web: http://127.0.0.1:${port}`);
});
