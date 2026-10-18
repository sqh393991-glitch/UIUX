import './style.css';
import { initCoordination } from './coordination.js';
import { initPanorama } from './panorama.js';

import { pageMarkup } from './page-markup.js';

const app = document.querySelector('#app');
if (!app.querySelector('#home')) app.innerHTML = pageMarkup;

initCoordination();
initPanorama();
const nav = document.querySelector('.nav');
const menu = document.querySelector('.menu-toggle');
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('menu-open', open);
});
nav.querySelectorAll('nav a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('menu-open'); menu.setAttribute('aria-expanded', 'false');
}));
const pause = document.querySelector('#hero-pause');
pause.addEventListener('click', () => {
  const paused = pause.getAttribute('aria-pressed') !== 'true';
  pause.setAttribute('aria-pressed', String(paused));
  pause.textContent = paused ? 'Resume movement' : 'Pause movement';
  document.querySelector('.hero').classList.toggle('motion-paused', paused);
});
import('./viewer.js').then(module => module.initViewer()).catch(() => {
  document.querySelector('#model-loader').textContent = '3D is unavailable in this browser.';
});
