/* Official VK community wall. Public posts are loaded directly from VK, without a token. */
(() => {
  'use strict';
  const config = window.CYBERMOL_CONFIG || {};
  const groupId = Number(config.vkCommunityId);
  const section = document.getElementById('news');
  const frame = document.getElementById('vkFeedFrame');
  const mount = document.getElementById('vkCommunityFeed');
  const status = document.getElementById('vkFeedStatus');
  const refresh = document.getElementById('vkFeedRefresh');
  const refreshLabel = refresh?.querySelector('span');
  if (!section || !frame || !mount || !status || !refresh || !Number.isSafeInteger(groupId) || groupId <= 0) return;

  let transport = null;
  let generation = 0;
  let widgetId = null;
  let readyTimer = 0;
  let resizeTimer = 0;
  let renderedWidth = 0;
  let started = false;
  const widgetTitle = 'Новости сообщества АНО ФРМ Кибермол во ВКонтакте';

  function loadTransport() {
    if (window.VK?.Widgets?.Group) return Promise.resolve();
    if (transport) return transport;
    transport = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://vk.ru/js/api/openapi.js?169';
      script.async = true;
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        script.onload = script.onerror = null;
        if (error) { script.remove(); reject(error); }
        else resolve();
      };
      const timeout = setTimeout(() => finish(new Error('VK script timed out')), 15000);
      script.onload = () => finish(window.VK?.Widgets?.Group ? null : new Error('VK widget unavailable'));
      script.onerror = () => finish(new Error('VK script unavailable'));
      document.head.append(script);
    }).catch(error => { transport = null; throw error; });
    return transport;
  }

  function clearWidget() {
    clearTimeout(readyTimer);
    // The SDK keeps a message channel per iframe. Release it before a redraw.
    const rpc = window.VK?.Widgets?.RPC?.[widgetId];
    if (rpc) {
      rpc.destroy?.();
      delete window.VK.Widgets.RPC[widgetId];
    }
    widgetId = null;
    mount.replaceChildren();
    mount.removeAttribute('style');
  }

  function setState(state) {
    frame.dataset.state = state;
    frame.setAttribute('aria-busy', String(state === 'loading'));
    status.hidden = state === 'ready' || state === 'displayed';
    refresh.disabled = state === 'loading';
    refreshLabel.textContent = state === 'error' ? 'Попробовать ещё раз' : 'Обновить ленту';
    if (state === 'loading') status.textContent = 'Загружаем новости из ВКонтакте…';
    if (state === 'error') status.textContent = 'Лента ВК сейчас не загрузилась. Новости можно открыть в сообществе по ссылке ниже.';
  }

  async function render() {
    started = true;
    clearTimeout(resizeTimer);
    const current = ++generation;
    clearWidget();
    setState('loading');
    renderedWidth = Math.max(120, Math.floor(frame.clientWidth));
    try {
      await loadTransport();
      if (current !== generation) return;
      readyTimer = setTimeout(() => {
        if (current !== generation) return;
        generation++;
        clearWidget();
        setState('error');
      }, 15000);
      widgetId = window.VK.Widgets.Group(mount.id, {
        mode: 4,
        wide: 1,
        no_cover: 1,
        width: 'auto',
        height: 640,
        color1: 'FFFFFF',
        color2: '191B1B',
        color3: 'D72632',
        onReady() {
          if (current !== generation) return;
          clearTimeout(readyTimer);
          mount.querySelector('iframe')?.setAttribute('title', widgetTitle);
          setState('ready');
        }
      }, groupId);
      mount.querySelector('iframe')?.setAttribute('title', widgetTitle);
    } catch {
      if (current !== generation) return;
      clearWidget();
      setState('error');
    }
  }

  refresh.hidden = false;
  refresh.addEventListener('click', render);

  // A loaded VK page may contain its own notice or verification screen.
  // Keep it visible even when it does not send the SDK's onReady message.
  new MutationObserver(() => {
    const iframe = mount.querySelector('iframe');
    if (!iframe || iframe.dataset.feedObserved) return;
    iframe.dataset.feedObserved = 'true';
    iframe.title = widgetTitle;
    const current = generation;
    iframe.addEventListener('load', () => {
      if (current !== generation || !iframe.isConnected) return;
      clearTimeout(readyTimer);
      if (frame.dataset.state !== 'ready') setState('displayed');
    }, {once:true});
  }).observe(mount, {childList:true});

  // Keep VK requests out of the initial screen's loading path.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      if (!started) render();
    }, {rootMargin:'300px 0px'});
    observer.observe(section);
  } else render();

  // VK fixes widths inside its cross-origin document. Recreate only after resizing settles.
  const checkWidth = () => {
    clearTimeout(resizeTimer);
    if (!started || Math.abs(Math.floor(frame.clientWidth) - renderedWidth) < 2) return;
    resizeTimer = setTimeout(render, 650);
  };
  if ('ResizeObserver' in window) new ResizeObserver(checkWidth).observe(frame);
  else window.addEventListener('resize', checkWidth, {passive:true});
})();
