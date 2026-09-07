/* Progressive motion: the document stays readable without this file. */
(() => {
  'use strict';
  if (!('animate' in Element.prototype)) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Set();
  const easing = 'cubic-bezier(.22,1,.36,1)';

  function play(element, frames, options = {}) {
    if (!element || preference.matches || document.hidden) return;
    // A finished or cancelled animation always reveals the underlying page.
    const animation = element.animate(frames, {duration:720, easing, ...options});
    running.add(animation);
    animation.finished.then(() => running.delete(animation), () => running.delete(animation));
    return animation;
  }
  function settle() {
    running.forEach(animation => animation.cancel());
    running.clear();
  }
  preference.addEventListener('change', settle);
  document.addEventListener('visibilitychange', () => { if (document.hidden) settle(); });

  const entrance = [
    {opacity:.35, transform:'translateY(28px)'},
    {opacity:1, transform:'translateY(0)'}
  ];
  // Short overlaps establish hierarchy without an intro screen or blocking clicks.
  if (window.scrollY < 120) {
    ['.hero-meta', '.hero h1', '.hero-intro'].forEach((selector, index) => {
      play(document.querySelector(selector), entrance, {duration:850, delay:index * 90});
    });
    play(document.querySelector('.hero-photo img'), [
      {opacity:.65, transform:'scale(1.04)'}, {opacity:1, transform:'scale(1)'}
    ], {duration:1300});
  }

  if ('IntersectionObserver' in window) {
    const selectors = [
      '.audience a', '.about > div', '.section-head > div', '.section-head > p',
      '.direction', '.music-grid > div', '.music-photo', '.mentor',
      '.awards-heading', '.partners-grid > *', '.start-grid > div', '.steps li',
      '.faq > div:first-child', '.faq details', '.support-grid > div',
      '.contact-copy', '.contact-form', '.documents', '.footer-top > *'
    ].join(',');
    const observer = new IntersectionObserver(entries => {
      let sequence = 0;
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        // Items above the viewport on a deep link must not animate on restoration.
        if (entry.boundingClientRect.bottom <= 0) return;
        play(entry.target, entrance, {delay:Math.min(sequence++ * 65, 195)});
      });
    }, {threshold:0, rootMargin:'0px 0px -24px 0px'});
    document.querySelectorAll(selectors).forEach(element => observer.observe(element));
  }

  document.querySelectorAll('.faq details').forEach(details => {
    details.addEventListener('toggle', () => {
      if (details.open) play(details.querySelector('p'), [
        {opacity:.5, transform:'translateY(-6px)'}, {opacity:1, transform:'translateY(0)'}
      ], {duration:300});
    });
  });

  const menu = document.querySelector('#mobileNav');
  if (menu) {
    const menuAnimations = new Set();
    new MutationObserver(() => {
      menuAnimations.forEach(animation => animation.cancel());
      menuAnimations.clear();
      if (menu.hidden) return;
      const panel = play(menu, [
        {opacity:.45, transform:'translateY(-12px)'},
        {opacity:1, transform:'translateY(0)'}
      ], {duration:330});
      if (panel) menuAnimations.add(panel);
      menu.querySelectorAll('a').forEach((link, index) => {
        const animation = play(link, [
          {opacity:.45, transform:'translateX(-10px)'},
          {opacity:1, transform:'translateX(0)'}
        ], {duration:330, delay:Math.min(index * 35, 140)});
        if (animation) menuAnimations.add(animation);
      });
    }).observe(menu, {attributes:true, attributeFilter:['hidden']});
  }

  const dialog = document.querySelector('#lightbox');
  const photo = document.querySelector('#lightboxImage');
  if (dialog && photo) {
    let photoAnimation;
    photo.addEventListener('load', () => {
      if (!dialog.open) return;
      if (photoAnimation) photoAnimation.cancel();
      photoAnimation = play(photo, [
        {opacity:.35, transform:'translateY(12px) scale(.97)'},
        {opacity:1, transform:'translateY(0) scale(1)'}
      ], {duration:420});
    });
    new MutationObserver(() => {
      if (dialog.open) {
        play(dialog.querySelector('.lb-bar'), entrance, {duration:360});
        play(dialog.querySelector('.lb-label'), [{opacity:.35}, {opacity:1}], {duration:360});
      } else if (photoAnimation) photoAnimation.cancel();
    }).observe(dialog, {attributes:true, attributeFilter:['open']});
  }
})();
