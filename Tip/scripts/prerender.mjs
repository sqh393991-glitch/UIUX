import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageMarkup } from '../src/page-markup.js';

// Keep the approved page visible even while the interactive module downloads.
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = resolve(project, 'dist/index.html');
let html = readFileSync(entry, 'utf8');
if (!html.includes('<div id="app"></div>')) throw new Error('Missing page mount');
html = html.replace('<div id="app"></div>', `<div id="app">${pageMarkup}</div>`);
html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, tag => {
  const href = tag.match(/href="([^"]+)"/)?.[1];
  if (!href || /^(?:https?:|\/\/)/.test(href)) return tag;
  const cssPath = resolve(project, 'dist', href);
  const css = readFileSync(cssPath, 'utf8').replace(/url\((['"]?)([^)'"\s]+)\1\)/g, (whole, quote, url) => {
    if (/^(?:[a-z]+:|\/|#)/i.test(url)) return whole;
    return `url(${quote}./${posix.normalize(posix.join(posix.dirname(href), url))}${quote})`;
  });
  return `<style>${css}</style>`;
});
writeFileSync(entry, html);
console.log('Pre-rendered TIP page and styles. Interactive modules load separately.');
