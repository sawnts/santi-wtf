document.querySelectorAll('[data-filmstrip]').forEach((strip) => {
  strip.addEventListener('focusin', (event) => {
    const photo = event.target.closest('.index-photo');
    if (photo && strip.contains(photo)) photo.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  });
  strip.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const photos = [...strip.querySelectorAll('.index-photo')];
    const current = photos.indexOf(document.activeElement);
    if (current < 0) return;
    let next;
    if (event.key === 'ArrowRight') next = Math.min(current + 1, photos.length - 1);
    else if (event.key === 'ArrowLeft') next = Math.max(current - 1, 0);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = photos.length - 1;
    else return;
    event.preventDefault();
    photos[next].focus({ preventScroll: true });
    photos[next].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  });
});
