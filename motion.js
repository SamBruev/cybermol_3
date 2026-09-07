/* Motion stays progressive: every cancelled animation reveals the original page. */
(() => {
  'use strict';
  if (!('animate' in Element.prototype)) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 901px) and (hover: hover) and (pointer: fine)');
  const smallScreen = matchMedia('(max-width: 820px)');
  const running = new Set();
  const editorialEase = 'cubic-bezier(.16,1,.3,1)';
  const revealQueue = new Map();

  function play(element, frames, options = {}) {
    if (!element || preference.matches || document.hidden) return null;
    const animation = element.animate(frames, {
      duration: smallScreen.matches ? 560 : 850,
      easing: editorialEase, fill: 'backwards', ...options
    });
    running.add(animation);
    animation.finished.then(() => running.delete(animation), () => running.delete(animation));
    return animation;
  }
  function settle() {
    running.forEach(animation => animation.cancel());
    running.clear();
  }

  // Individual word masks preserve natural wrapping and do not measure or fix line widths.
  function headingWords(heading) {
    if (heading.dataset.motionWords) return [...heading.querySelectorAll('.motion-word')];
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(node => {
      const fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (!part || /^\s+$/.test(part)) { fragment.append(document.createTextNode(part)); return; }
        const mask = document.createElement('span');
        const word = document.createElement('span');
        mask.className = 'motion-word-mask'; word.className = 'motion-word';
        word.textContent = part; mask.append(word); fragment.append(mask);
      });
      node.replaceWith(fragment);
    });
    heading.dataset.motionWords = 'true';
    return [...heading.querySelectorAll('.motion-word')];
  }
  function revealHeading(heading, hero = false) {
    if (preference.matches || document.hidden) return;
    headingWords(heading).forEach((word, index) => {
      play(word, [
        {transform:'translateY(108%)', opacity:0},
        {transform:'translateY(0)', opacity:1}
      ], {
        duration: smallScreen.matches ? 620 : (hero ? 1050 : 850),
        delay: Math.min(index * (hero ? 70 : 45), hero ? 280 : 180)
      });
    });
  }
  function revealText(element, delay = 0) {
    play(element, [
      {opacity:.12, transform:`translateY(${smallScreen.matches ? 12 : 22}px)`},
      {opacity:1, transform:'translateY(0)'}
    ], {delay});
  }
  function revealPhoto(frame) {
    play(frame, [
      {clipPath:'inset(5% 0 5% 0 round 5px)', opacity:.55},
      {clipPath:'inset(0% 0 0% 0 round 5px)', opacity:1}
    ], {duration:smallScreen.matches ? 650 : 1100});
    play(frame.querySelector('img'), [
      {transform:'scale(1.045)'}, {transform:'scale(1)'}
    ], {duration:smallScreen.matches ? 800 : 1400});
  }

  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    let index = 0;
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const effect = revealQueue.get(entry.target);
      revealQueue.delete(entry.target);
      if (entry.boundingClientRect.bottom > 0) effect?.(Math.min(index++ * 65, 195));
    });
  }, {threshold:0, rootMargin:'0px 0px 24px 0px'}) : null;
  function observe(element, effect) {
    if (!element) return;
    if (!observer) return; // Static content is the fallback.
    revealQueue.set(element, effect); observer.observe(element);
  }

  const studioImage = document.querySelector('.music-photo > img');
  if (studioImage) {
    const windowFrame = document.createElement('div');
    windowFrame.className = 'motion-photo-window';
    studioImage.before(windowFrame); windowFrame.append(studioImage);
  }
  const hero = document.querySelector('.hero');
  if (hero && window.scrollY < 120) {
    revealText(hero.querySelector('.hero-meta'));
    revealHeading(hero.querySelector('h1'), true);
    revealText(hero.querySelector('.hero-intro'), 100);
  }
  document.querySelectorAll('main h2').forEach(heading => observe(heading, () => revealHeading(heading)));
  document.querySelectorAll('.hero-photo, .music-photo').forEach(frame => observe(frame, () => revealPhoto(frame)));
  document.querySelectorAll([
    '.audience a', '.about-copy > p', '.about-facts', '.section-head > p',
    '.direction', '.music-grid > div > p', '.music .btn', '.mentor',
    '.partners-grid > *', '.start-grid > div > p', '.steps li',
    '.faq details', '.support-grid > div > p', '.support-actions',
    '.contact-copy > p', '.contact-items', '.contact-form', '.documents', '.footer-top > *'
  ].join(',')).forEach(element => observe(element, delay => revealText(element, delay)));

  document.querySelectorAll('.faq details').forEach(details => {
    details.addEventListener('toggle', () => {
      if (details.open) play(details.querySelector('p'), [
        {opacity:.2, transform:'translateY(-8px)'}, {opacity:1, transform:'translateY(0)'}
      ], {duration:360});
    });
  });

  // No idle animation loop: at most one batch of geometry reads/writes per scroll frame.
  const header = document.querySelector('.header');
  const progress = document.createElement('div');
  progress.className = 'reading-progress'; progress.setAttribute('aria-hidden', 'true');
  header?.append(progress);
  const photoFrames = [...document.querySelectorAll('.hero-photo, .music-photo')];
  const visiblePhotos = new Set();
  let scrollFrame = 0;
  const photoObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => entry.isIntersecting ? visiblePhotos.add(entry.target) : visiblePhotos.delete(entry.target));
    scheduleScroll();
  }) : null;
  photoFrames.forEach(frame => photoObserver?.observe(frame));
  function updateScroll() {
    scrollFrame = 0;
    if (document.hidden) return;
    const viewport = window.innerHeight;
    const maxScroll = document.documentElement.scrollHeight - viewport;
    const readings = !preference.matches && desktop.matches && !document.body.classList.contains('locked')
      ? [...visiblePhotos].map(frame => ({frame, rect:frame.getBoundingClientRect()})) : [];
    progress.style.transform = `scaleX(${maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0})`;
    header?.classList.toggle('header-scrolled', window.scrollY > 24);
    readings.forEach(({frame, rect}) => {
      const ratio = Math.min(1, Math.max(0, (viewport - rect.top) / (viewport + rect.height)));
      const image = frame.querySelector('img');
      image.style.translate = `0 ${(ratio - .5) * 26}px`;
      image.style.scale = '1.055';
    });
  }
  function scheduleScroll() {
    if (!scrollFrame && !document.hidden) scrollFrame = requestAnimationFrame(updateScroll);
  }
  function resetDepth() {
    photoFrames.forEach(frame => {
      const image = frame.querySelector('img');
      image.style.removeProperty('translate'); image.style.removeProperty('scale');
    });
    scheduleScroll();
  }
  window.addEventListener('scroll', scheduleScroll, {passive:true});
  window.addEventListener('resize', resetDepth);
  desktop.addEventListener('change', resetDepth);
  preference.addEventListener('change', () => { settle(); resetDepth(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { settle(); cancelAnimationFrame(scrollFrame); scrollFrame = 0; }
    else scheduleScroll();
  });
  scheduleScroll();

  const menuAnimations = new Set();
  function cancelMenuAnimations() {
    menuAnimations.forEach(animation => animation.cancel()); menuAnimations.clear();
  }
  function menuAnimation(element, frames, options) {
    const animation = play(element, frames, options);
    if (animation) menuAnimations.add(animation);
    return animation;
  }
  window.CybermolMotion = {
    openMenu(menu) {
      cancelMenuAnimations();
      menuAnimation(menu, [
        {clipPath:'inset(0 0 100% 0)'}, {clipPath:'inset(0 0 0% 0)'}
      ], {duration:480});
      menu.querySelectorAll('a, .menu-location').forEach((link, index) => {
        menuAnimation(link, [
          {opacity:0, transform:'translateY(18px)'},
          {opacity:1, transform:'translateY(0)'}
        ], {duration:460, delay:60 + Math.min(index * 35, 210)});
      });
    },
    closeMenu(menu) {
      cancelMenuAnimations();
      return menuAnimation(menu, [
        {clipPath:'inset(0 0 0% 0)', opacity:1},
        {clipPath:'inset(0 0 100% 0)', opacity:.85}
      ], {duration:240, easing:'cubic-bezier(.4,0,1,1)'});
    },
    closeDialog(dialog) {
      dialog.classList.add('is-closing');
      return play(dialog, [{opacity:1}, {opacity:0}], {duration:220, easing:'ease-out'});
    }
  };

  const dialog = document.querySelector('#lightbox');
  const photo = document.querySelector('#lightboxImage');
  if (dialog && photo) {
    let photoAnimation;
    photo.addEventListener('load', () => {
      if (!dialog.open || dialog.classList.contains('is-closing')) return;
      photoAnimation?.cancel();
      photoAnimation = play(photo, [
        {opacity:0, transform:'translateY(14px) scale(.975)'},
        {opacity:1, transform:'translateY(0) scale(1)'}
      ], {duration:650});
    });
    new MutationObserver(() => {
      if (dialog.open) {
        revealText(dialog.querySelector('.lb-bar'));
        play(dialog.querySelector('.lb-label'), [{opacity:0}, {opacity:1}], {duration:400});
      } else {
        photoAnimation?.cancel(); dialog.classList.remove('is-closing');
      }
    }).observe(dialog, {attributes:true, attributeFilter:['open']});
  }
})();
