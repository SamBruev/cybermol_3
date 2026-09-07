(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const config = window.CYBERMOL_CONFIG || {};
  $('#year').textContent = new Date().getFullYear();

  // The menu and native dialog share the page lock without changing each other's state.
  const menu = $('#mobileNav');
  const toggle = $('.menu-toggle');
  const dialog = $('#lightbox');
  const background = [$('#main'), $('.footer'), $('#toTop')];
  const lockPage = () => document.body.classList.toggle('locked', !menu.hidden || dialog.open);
  toggle.hidden = false;
  function setMenu(open, returnFocus = false) {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    background.forEach(el => { el.inert = open; });
    $('.nav-action').inert = open;
    $('.header .brand').inert = open;
    lockPage();
    if (open) menu.querySelector('a').focus();
    else if (returnFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => setMenu(menu.hidden, !menu.hidden));
  menu.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    setMenu(false);
    if (link.hash) {
      const target = document.getElementById(link.hash.slice(1));
      if (target) { target.tabIndex = -1; target.focus({preventScroll:true}); }
    }
  });
  document.addEventListener('keydown', event => {
    if (menu.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); setMenu(false, true); }
    if (event.key === 'Tab') {
      const focusable = [toggle, ...menu.querySelectorAll('a[href]')];
      const current = focusable.indexOf(document.activeElement);
      if (current === -1 || (!event.shiftKey && current === focusable.length - 1)) {
        event.preventDefault(); focusable[0].focus();
      } else if (event.shiftKey && current === 0) {
        event.preventDefault(); focusable.at(-1).focus();
      }
    }
  });
  matchMedia('(max-width:820px)').addEventListener('change', e => {
    if (!e.matches && !menu.hidden) setMenu(false);
  });

  const photos = {
    awards: $$('.award').map(el => ({src:el.querySelector('img').getAttribute('src'), alt:el.querySelector('img').alt})),
    fomin: [{src:'assets/mentor-fomin.jpg',alt:'Алексей Анатольевич Фомин: руководитель движения «Кибермол»'}],
    bruev: [
      {src:'assets/mentor-bruev-full.jpg',alt:'Семён Сергеевич Бруев'},
      {src:'assets/mentor-bruev-studio.jpg',alt:'Семён Бруев в студии звукозаписи'},
      {src:'assets/mentor-bruev-lecture.jpg',alt:'Из лекционной практики наставника Семёна Бруева'},
      {src:'assets/avatar-bruev.jpg',alt:'Семён Бруев: музыкальный продюсер и звукорежиссёр'}
    ]
  };
  let activePhotos = [], currentPhoto = 0, opener = null;
  const photo = $('#lightboxImage');
  const label = $('#lightboxLabel');
  function showPhoto(index) {
    currentPhoto = (index + activePhotos.length) % activePhotos.length;
    const item = activePhotos[currentPhoto];
    photo.src = item.src; photo.alt = item.alt;
    label.textContent = item.alt;
    dialog.setAttribute('aria-label', item.alt);
    $('#lbCount').textContent = `${currentPhoto + 1} / ${activePhotos.length}`;
    $('#lbPrev').hidden = $('#lbNext').hidden = activePhotos.length < 2;
  }
  $$('[data-gallery]').forEach(button => button.addEventListener('click', event => {
    if (typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    opener = button;
    activePhotos = photos[button.dataset.gallery];
    showPhoto(Number(button.dataset.index) || 0);
    dialog.showModal();
    lockPage();
    $('.lb-close').focus();
  }));
  $('.lb-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === $('.lightbox-inner')) dialog.close(); });
  dialog.addEventListener('close', () => {
    lockPage(); photo.removeAttribute('src');
    if (opener) opener.focus({preventScroll:true});
  });
  $('#lbPrev').addEventListener('click', () => showPhoto(currentPhoto - 1));
  $('#lbNext').addEventListener('click', () => showPhoto(currentPhoto + 1));
  dialog.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); showPhoto(currentPhoto - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); showPhoto(currentPhoto + 1); }
  });
  let touchStart = null;
  photo.addEventListener('touchstart', e => {
    touchStart = e.touches.length === 1 ? {x:e.touches[0].clientX, y:e.touches[0].clientY} : null;
  }, {passive:true});
  photo.addEventListener('touchcancel', () => { touchStart = null; });
  photo.addEventListener('touchend', e => {
    if (!touchStart || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > 1.5 * Math.abs(dy)) showPhoto(currentPhoto + (dx < 0 ? 1 : -1));
  }, {passive:true});

  const track = $('#awardTrack');
  $('.gallery-controls').hidden = false;
  const galleryButtons = $$('[data-scroll]');
  galleryButtons.forEach(button => button.addEventListener('click', () => {
    track.scrollBy({left:Number(button.dataset.scroll) * track.clientWidth * .8, behavior:reduced() ? 'instant' : 'smooth'});
  }));
  function galleryState() {
    galleryButtons[0].disabled = track.scrollLeft <= 2;
    galleryButtons[1].disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  }
  track.addEventListener('scroll', galleryState, {passive:true});
  window.addEventListener('resize', galleryState);
  galleryState();

  // Automatic travel reverses at the ends without duplicating document links.
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const awardsSection = track.closest('section');
  const pauseButton = document.createElement('button');
  pauseButton.type = 'button';
  pauseButton.className = 'award-motion-toggle';
  pauseButton.setAttribute('aria-controls', 'awardTrack');
  $('.gallery-controls').prepend(pauseButton);
  let autoEnabled = !motionPreference.matches;
  let inView = false, hovered = false, focused = false, direction = 1;
  let animationFrame = 0, lastFrame = 0, position = track.scrollLeft;
  function canTravel() {
    return autoEnabled && inView && !hovered && !focused && !document.hidden &&
      !dialog.open && menu.hidden && !motionPreference.matches;
  }
  function renderMotionButton() {
    pauseButton.textContent = autoEnabled ? 'Пауза' : 'Автопрокрутка';
    pauseButton.setAttribute('aria-label', autoEnabled ? 'Остановить движение грамот' : 'Включить движение грамот');
    pauseButton.disabled = motionPreference.matches;
    pauseButton.title = motionPreference.matches ? 'Движение отключено в настройках устройства' : '';
  }
  function travel(now) {
    animationFrame = 0;
    if (!canTravel()) { lastFrame = 0; track.classList.remove('auto-travel'); return; }
    const dt = lastFrame ? Math.min(now - lastFrame, 50) : 0;
    lastFrame = now;
    const end = Math.max(0, track.scrollWidth - track.clientWidth);
    position = Math.max(0, Math.min(end, position + direction * dt * .022));
    track.scrollLeft = position;
    if (position >= end) direction = -1;
    else if (position <= 0) direction = 1;
    animationFrame = requestAnimationFrame(travel);
  }
  function syncTravel() {
    cancelAnimationFrame(animationFrame);
    lastFrame = 0;
    track.classList.toggle('auto-travel', canTravel());
    if (canTravel()) { position = track.scrollLeft; animationFrame = requestAnimationFrame(travel); }
  }
  pauseButton.addEventListener('click', () => {
    autoEnabled = !autoEnabled; renderMotionButton(); syncTravel();
  });
  function manualTravel() {
    autoEnabled = false; renderMotionButton(); syncTravel();
  }
  track.addEventListener('pointerdown', manualTravel, {passive:true});
  track.addEventListener('wheel', manualTravel, {passive:true});
  galleryButtons.forEach(button => button.addEventListener('click', manualTravel));
  awardsSection.addEventListener('pointerenter', e => {
    if (e.pointerType === 'mouse') { hovered = true; syncTravel(); }
  });
  awardsSection.addEventListener('pointerleave', () => { hovered = false; syncTravel(); });
  awardsSection.addEventListener('focusin', () => { focused = true; syncTravel(); });
  awardsSection.addEventListener('focusout', () => {
    queueMicrotask(() => { focused = awardsSection.contains(document.activeElement); syncTravel(); });
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting; syncTravel();
    }, {threshold:.15}).observe(track);
  }
  new MutationObserver(syncTravel).observe(dialog, {attributes:true,attributeFilter:['open']});
  new MutationObserver(syncTravel).observe(menu, {attributes:true,attributeFilter:['hidden']});
  document.addEventListener('visibilitychange', syncTravel);
  motionPreference.addEventListener('change', () => {
    autoEnabled = !motionPreference.matches; renderMotionButton(); syncTravel();
  });
  renderMotionButton();

  $$('[data-interest]').forEach(link => link.addEventListener('click', () => {
    $('#interest').value = link.dataset.interest;
    $('#interest').dispatchEvent(new Event('input', {bubbles:true}));
    $('#formStatus').textContent = `Выбрана тема: ${link.dataset.interest}.`;
    $('#contacts').tabIndex = -1;
    $('#contacts').focus({preventScroll:true});
  }));

  const form = $('#contactForm');
  const status = $('#formStatus');
  let lastLetter = '';
  function makeLetter() {
    const data = new FormData(form);
    return `Здравствуйте!\n\nТема: ${data.get('interest')}\nИмя: ${String(data.get('name')).trim()}\n` +
      (String(data.get('phone')).trim() ? `Телефон: ${String(data.get('phone')).trim()}\n` : '') +
      `\n${String(data.get('message')).trim()}`;
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = $('#name');
    name.setCustomValidity(name.value.trim() ? '' : 'Укажите, как к вам обращаться.');
    if (!form.reportValidity()) return;
    lastLetter = makeLetter();
    $('#letterPreview').textContent = lastLetter;
    $('#letterFallback').hidden = false;
    status.textContent = 'Письмо подготовлено. Отправьте его из почтового приложения. Если оно не открылось, скопируйте текст и напишите на frmcybermol@yandex.ru.';
    window.location.href = 'mailto:frmcybermol@yandex.ru?subject=' + encodeURIComponent('Кибермол: ' + $('#interest').value) + '&body=' + encodeURIComponent(lastLetter);
  });
  form.querySelector('fieldset').disabled = false;
  $('#name').addEventListener('input', () => $('#name').setCustomValidity(''));
  form.addEventListener('input', () => {
    if (!$('#letterFallback').hidden) {
      lastLetter = makeLetter(); $('#letterPreview').textContent = lastLetter;
      status.textContent = 'Текст изменён. Нажмите «Подготовить письмо», чтобы открыть обновлённое письмо в почте.';
    }
  });
  $('#copyLetter').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(lastLetter);
      status.textContent = 'Текст скопирован. Вставьте его в письмо на frmcybermol@yandex.ru и отправьте.';
    } catch {
      const range = document.createRange(); range.selectNodeContents($('#letterPreview'));
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      status.textContent = 'Текст выделен. Скопируйте его и отправьте на frmcybermol@yandex.ru.';
    }
  });

  function httpsUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
    catch { return null; }
  }
  [['vkUrl','#vkLink'], ['maxUrl','#maxLink'], ['donateUrl','#donateLink']].forEach(([key,selector]) => {
    const href = httpsUrl(config[key]); if (!href) return;
    const link = $(selector); link.href = href; link.hidden = false; link.target = '_blank'; link.rel = 'noopener';
    if (key !== 'donateUrl') $('#socialLinks').hidden = false;
  });
  $$('[data-document]').forEach(link => {
    const value = config.documents?.[link.dataset.document];
    const href = httpsUrl(value) || (typeof value === 'string' && /^docs\/[a-zA-Z0-9_.-]+\.pdf$/.test(value) ? value : null);
    if (!href) return;
    link.href = href; link.hidden = false; link.target = '_blank'; link.rel = 'noopener';
  });

  const topButton = $('#toTop');
  const onScroll = () => { topButton.hidden = window.scrollY < 650; };
  window.addEventListener('scroll', onScroll, {passive:true}); onScroll();
  topButton.addEventListener('click', () => {
    $('#top').tabIndex = -1; $('#top').focus({preventScroll:true});
    window.scrollTo({top:0, behavior:reduced() ? 'instant' : 'smooth'});
  });
})();
