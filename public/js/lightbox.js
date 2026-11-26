(() => {
  const dialog = document.querySelector('[data-photo-lightbox]');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const find = (name) => dialog.querySelector(`[data-lightbox-${name}]`);
  const shell = find('shell');
  const backdrop = find('backdrop');
  const frame = find('frame');
  const image = find('image');
  const status = find('status');
  const statusCopy = find('status-copy');
  const retry = find('retry');
  const title = find('title');
  const date = find('date');
  const counter = find('counter');
  const pageLink = find('page');
  const navigation = find('navigation');
  const announcement = find('announcement');
  const closeButton = find('close');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let items = [];
  let index = 0;
  let phase = 'closed';
  let opener = null;
  let scrollLock = null;
  let pendingImage = null;
  let imageTimeout;
  let imageGeneration = 0;
  let motionGeneration = 0;
  let animations = [];
  let backdropPress = false;
  const historyKey = '__santiPhotoLightbox';
  let historyBackPending = false;

  function photoHistory(state = history.state) {
    const entry = state?.[historyKey];
    return entry?.version === 1 && entry.page === location.href
      && typeof entry.photo === 'string' && typeof entry.opener === 'string'
      && typeof entry.group === 'string' ? entry : null;
  }

  function historyState() {
    return history.state && typeof history.state === 'object' && !Array.isArray(history.state)
      ? { ...history.state } : {};
  }

  function writePhotoHistory(replace = false) {
    // One entry belongs to the whole viewing session, including photo changes.
    const state = historyState();
    state[historyKey] = {
      version: 1,
      page: location.href,
      photo: items[index].href,
      opener: opener.href,
      group: opener.dataset.lightbox || '',
      scroll: { x: scrollLock.x, y: scrollLock.y },
    };
    try {
      history[replace ? 'replaceState' : 'pushState'](state, '', location.href);
    } catch { /* Viewing and ordinary dismissal still work if history is unavailable. */ }
  }

  function clearPhotoHistory() {
    if (!photoHistory()) return;
    const state = historyState();
    delete state[historyKey];
    try { history.replaceState(state, '', location.href); } catch { /* Best effort. */ }
  }

  function leavePhotoHistory() {
    if (!photoHistory() || history.length < 2) return false;
    historyBackPending = true;
    try {
      history.back();
      return true;
    } catch {
      historyBackPending = false;
      return false;
    }
  }

  const setPhase = (value) => {
    phase = value;
    dialog.dataset.phase = value;
  };

  function lockScroll(position) {
    if (scrollLock) return;
    const body = document.body;
    const html = document.documentElement;
    const properties = ['position', 'top', 'left', 'right', 'width', 'paddingRight'];
    const bodyStyles = Object.fromEntries(properties.map((property) => [property, body.style[property]]));
    const gap = Math.max(0, window.innerWidth - html.clientWidth);
    const padding = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
    const restored = Number.isFinite(position?.x) && Number.isFinite(position?.y) ? position : null;
    scrollLock = { x: restored?.x ?? window.scrollX, y: restored?.y ?? window.scrollY, bodyStyles, overflow: html.style.overflow };
    body.style.position = 'fixed';
    body.style.top = `${-scrollLock.y}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.paddingRight = `${padding + gap}px`;
    html.style.overflow = 'hidden';
  }

  function unlockScroll() {
    if (!scrollLock) return;
    const saved = scrollLock;
    scrollLock = null;
    const html = document.documentElement;
    const behavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    for (const [property, value] of Object.entries(saved.bodyStyles)) document.body.style[property] = value;
    html.style.overflow = saved.overflow;
    window.scrollTo(saved.x, saved.y);
    html.style.scrollBehavior = behavior;
  }

  function cancelImage() {
    imageGeneration += 1;
    window.clearTimeout(imageTimeout);
    if (pendingImage) {
      pendingImage.onload = null;
      pendingImage.onerror = null;
      pendingImage.removeAttribute('src');
      pendingImage = null;
    }
  }

  function cancelAnimations() {
    for (const animation of animations) animation.cancel();
    animations = [];
  }

  function finishClose() {
    motionGeneration += 1;
    setPhase('closed');
    if (dialog.open) dialog.close();
    cancelAnimations();
    cancelImage();
    image.hidden = true;
    image.removeAttribute('src');
    frame.setAttribute('aria-busy', 'false');
    unlockScroll();
    const target = opener;
    opener = null;
    if (target?.isConnected) target.focus({ preventScroll: true });
  }

  async function animateDialog(entering, fresh = false) {
    const generation = ++motionGeneration;
    const shellStyle = getComputedStyle(shell);
    const backdropStyle = getComputedStyle(backdrop);
    const fromShell = fresh
      ? { opacity: 0, transform: reducedMotion.matches ? 'none' : 'translateY(6px) scale(.98)' }
      : { opacity: shellStyle.opacity, transform: shellStyle.transform };
    const fromBackdrop = fresh ? { opacity: 0 } : { opacity: backdropStyle.opacity };
    cancelAnimations();
    setPhase(entering ? 'opening' : 'closing');
    if (typeof shell.animate !== 'function') {
      if (entering) setPhase('open');
      else finishClose();
      return;
    }
    const duration = reducedMotion.matches ? 70 : entering ? 260 : 220;
    const options = { duration, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'forwards' };
    const toShell = entering
      ? { opacity: 1, transform: 'none' }
      : { opacity: 0, transform: reducedMotion.matches ? 'none' : 'translateY(4px) scale(.98)' };
    animations = [shell.animate([fromShell, toShell], options), backdrop.animate([fromBackdrop, { opacity: entering ? 1 : 0 }], options)];
    await Promise.allSettled(animations.map((animation) => animation.finished));
    if (generation !== motionGeneration) return;
    if (entering) {
      cancelAnimations();
      setPhase('open');
    } else finishClose();
  }

  function requestClose() {
    if (!dialog.open || phase === 'closing' || historyBackPending) return;
    // Escape, backdrop, and the close button consume the same entry as browser Back.
    if (leavePhotoHistory()) return;
    clearPhotoHistory();
    void animateDialog(false);
  }

  function loadCurrent() {
    cancelImage();
    const generation = imageGeneration;
    const item = items[index];
    title.textContent = item.title || item.alt || 'photograph';
    date.textContent = item.date;
    date.hidden = !item.date;
    counter.textContent = `${index + 1} / ${items.length}`;
    counter.setAttribute('aria-label', `photograph ${index + 1} of ${items.length}`);
    pageLink.href = item.href;
    navigation.hidden = items.length < 2;
    image.hidden = true;
    image.removeAttribute('src');
    image.alt = item.alt;
    status.hidden = false;
    statusCopy.textContent = 'loading photograph…';
    if (document.activeElement === retry) closeButton.focus({ preventScroll: true });
    retry.hidden = true;
    frame.setAttribute('aria-busy', 'true');
    announcement.textContent = `loading photograph ${index + 1} of ${items.length}`;

    const fail = (message) => {
      if (generation !== imageGeneration || !dialog.open) return;
      cancelImage();
      frame.setAttribute('aria-busy', 'false');
      statusCopy.textContent = message;
      retry.hidden = false;
      announcement.textContent = `${message} Try again or open the photo page.`;
    };
    const request = new Image();
    pendingImage = request;
    request.decoding = 'async';
    request.onload = async () => {
      try { await request.decode(); } catch { /* A loaded image can still be displayed without decode(). */ }
      if (generation !== imageGeneration || !dialog.open) return;
      window.clearTimeout(imageTimeout);
      image.width = request.naturalWidth;
      image.height = request.naturalHeight;
      image.src = item.src;
      image.hidden = false;
      status.hidden = true;
      frame.setAttribute('aria-busy', 'false');
      announcement.textContent = `photograph ${index + 1} of ${items.length}: ${title.textContent}`;
      request.onload = null;
      request.onerror = null;
      pendingImage = null;
    };
    request.onerror = () => fail('couldn’t load this photograph.');
    imageTimeout = window.setTimeout(() => fail('this photograph is taking too long to load.'), 12000);
    request.src = item.src;
  }

  function open(trigger, restoredEntry = null) {
    const group = trigger.dataset.lightbox;
    const triggers = [...document.querySelectorAll('a[data-lightbox][data-photo-src]')]
      .filter((anchor) => !group || anchor.dataset.lightbox === group);
    const selected = triggers.indexOf(trigger);
    if (selected < 0) return false;
    const fresh = !dialog.open;
    if (fresh) {
      opener = restoredEntry
        ? triggers.find((anchor) => anchor.href === restoredEntry.opener) || trigger
        : trigger;
      lockScroll(restoredEntry?.scroll);
      try { dialog.showModal(); } catch {
        unlockScroll();
        opener = null;
        return false;
      }
    }
    items = triggers.map((anchor) => ({
      src: anchor.dataset.photoSrc,
      alt: anchor.dataset.photoAlt || anchor.querySelector('img')?.alt || '',
      title: anchor.dataset.photoTitle || '',
      date: anchor.dataset.photoDate || '',
      href: anchor.href,
    }));
    index = selected;
    if (!restoredEntry) writePhotoHistory(!fresh && Boolean(photoHistory()));
    loadCurrent();
    void animateDialog(true, fresh);
    if (fresh) closeButton.focus({ preventScroll: true });
    return true;
  }

  function move(direction) {
    if (!dialog.open || phase === 'closing' || historyBackPending || items.length < 2) return;
    index = (index + direction + items.length) % items.length;
    if (photoHistory()) writePhotoHistory(true);
    loadCurrent();
  }

  function restorePhotoHistory() {
    historyBackPending = false;
    const entry = photoHistory();
    if (entry) {
      const trigger = [...document.querySelectorAll('a[data-lightbox][data-photo-src]')]
        .find((anchor) => anchor.href === entry.photo && (anchor.dataset.lightbox || '') === entry.group);
      if (trigger) {
        if (dialog.open && phase !== 'closing' && items[index]?.href === entry.photo) return;
        if (open(trigger, entry)) return;
      }
      clearPhotoHistory();
    }
    if (dialog.open) void animateDialog(false);
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const trigger = event.target instanceof Element ? event.target.closest('a[data-lightbox][data-photo-src]') : null;
    if (trigger && open(trigger)) event.preventDefault();
  });
  closeButton.addEventListener('click', requestClose);
  find('previous').addEventListener('click', () => move(-1));
  find('next').addEventListener('click', () => move(1));
  retry.addEventListener('click', loadCurrent);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    requestClose();
  });
  dialog.addEventListener('close', () => {
    if (!dialog.open && phase !== 'closed') {
      finishClose();
      if (!leavePhotoHistory()) clearPhotoHistory();
    }
  });
  dialog.addEventListener('pointerdown', (event) => {
    backdropPress = event.button === 0 && (event.target === backdrop || event.target === dialog);
  });
  dialog.addEventListener('click', (event) => {
    if (backdropPress && (event.target === backdrop || event.target === dialog)) requestClose();
    backdropPress = false;
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  window.addEventListener('popstate', restorePhotoHistory);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) restorePhotoHistory();
  });
  // History state survives reload; the URL and canonical photo links remain unchanged.
  restorePhotoHistory();
})();
