// Small, responsive feedback around the existing interface; actions never wait
// for an animation to finish and the original page layout stays unchanged.
export function initMotion(root = document) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const activeAnimations = new WeakMap();
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const controls = 'button:not(:disabled), a.btn, .hero-glasses';
  const panelSelectors = [
    '#hero-request', '#wide-request', '#demo-card', '#requester-card',
    '#request-form', '#sent-request', '.handoff-note', '#availability-feedback',
    '#outgoing-request', '#wide-note-state',
  ];
  const panels = panelSelectors.map(selector => root.querySelector(selector)).filter(Boolean);
  const snapshots = new WeakMap();

  const visible = element => {
    if (!element.isConnected || element.hidden || document.hidden) return false;
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.bottom > 0 &&
      box.top < innerHeight && box.right > 0 && box.left < innerWidth;
  };
  const signature = element => [
    element.hidden,
    element.textContent.replace(/\s+/g, ' ').trim(),
    element.querySelectorAll('form, input, textarea').length,
  ].join('|');

  function animate(element, keyframes, settings = {}) {
    if (reduceMotion.matches || !element?.animate || !visible(element)) return;
    activeAnimations.get(element)?.cancel();
    const animation = element.animate(keyframes, {
      duration: 340,
      easing: 'cubic-bezier(.2,.75,.25,1)',
      ...settings,
    });
    animation.id = settings.id || 'tip-panel-enter';
    activeAnimations.set(element, animation);
    animation.onfinish = () => activeAnimations.delete(element);
  }

  const reveal = element => animate(element, [
    { opacity: .25, transform: 'translateY(10px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ]);
  panels.forEach(element => snapshots.set(element, signature(element)));

  // Coordination replaces several cards after each action. Compare their
  // actual content so a change in one card does not animate unrelated panels.
  const observer = new MutationObserver(() => {
    for (const element of panels) {
      const next = signature(element);
      if (snapshots.get(element) === next) continue;
      snapshots.set(element, next);
      reveal(element);
    }
  });
  const app = root.querySelector('#app');
  if (app) observer.observe(app, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['hidden'],
  });

  root.addEventListener('click', event => {
    const control = event.target.closest(controls);
    if (!control) return;
    // Capture before request cards replace the clicked button. Persistent
    // controls (tabs, status and model controls) finish their soft release.
    animate(control, [
      { scale: .965 },
      { scale: 1.015, offset: .65 },
      { scale: 1 },
    ], { duration: 250, id: 'tip-button-press' });

    if (control.matches('[data-pan-target]')) {
      const target = root.querySelector({
        team: '.pan-team', request: '#wide-request', handoff: '.pan-handoff',
      }[control.dataset.panTarget]);
      // The camera already pans. A quiet border glow identifies the screen
      // being brought into view without tilting or moving the AR overlay.
      if (!reduceMotion.matches && target?.animate) {
        target.animate([
          { boxShadow: '0 0 0 0 rgba(238,191,121,0)' },
          { boxShadow: '0 0 0 2px rgba(238,191,121,.55)', offset: .45 },
          { boxShadow: '0 0 0 0 rgba(238,191,121,0)' },
        ], { duration: 700, easing: 'ease-out' }).id = 'tip-view-focus';
      }
    }
    if (control.matches('.menu-toggle')) {
      // Wait until the target's menu handler has run, then animate its view.
      requestAnimationFrame(() => {
        if (control.getAttribute('aria-expanded') === 'true') reveal(root.querySelector('.nav nav'));
      });
    }
  }, { ...options, capture: true });

  root.addEventListener('change', event => {
    if (!event.target.matches('.composer select')) return;
    animate(event.target, [
      { boxShadow: '0 0 0 2px rgba(147,164,193,.65)' },
      { boxShadow: '0 0 0 0 rgba(147,164,193,0)' },
    ], { duration: 450, id: 'tip-choice-confirm' });
  }, options);

  let pointerFrame = 0;
  let pointerTarget = null;
  let pointerX = 0;
  let pointerY = 0;
  root.addEventListener('pointermove', event => {
    if (!finePointer.matches || reduceMotion.matches) return;
    pointerTarget = event.target.closest(controls);
    if (!pointerTarget) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      if (!pointerTarget?.isConnected) return;
      const box = pointerTarget.getBoundingClientRect();
      pointerTarget.style.setProperty('--tip-pointer-x', `${pointerX - box.left}px`);
      pointerTarget.style.setProperty('--tip-pointer-y', `${pointerY - box.top}px`);
    });
  }, { ...options, passive: true });

  // A single, small arrival for section headings and cards as the page scrolls.
  // Everything is visible in HTML first; a script or observer failure can never
  // leave a section hidden.
  const scrollObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      scrollObserver.unobserve(entry.target);
      reveal(entry.target);
    }
  }, { threshold: .12 });
  root.querySelectorAll('.section-heading,.section-copy,.composer,.availability-panel,.product-details').forEach(element => {
    if (element.getBoundingClientRect().top >= innerHeight) scrollObserver.observe(element);
  });

  const stopMotion = () => {
    if (!reduceMotion.matches) return;
    root.querySelectorAll('*').forEach(element => {
      activeAnimations.get(element)?.cancel();
    });
  };
  reduceMotion.addEventListener('change', stopMotion);
  return () => {
    listeners.abort();
    observer.disconnect();
    scrollObserver.disconnect();
    cancelAnimationFrame(pointerFrame);
    reduceMotion.removeEventListener('change', stopMotion);
  };
}
