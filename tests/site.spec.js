import { test, expect } from '@playwright/test';

const photoLinks = (page) => page.getByRole('link', { name: /^enlarge photograph:/ });
const lightbox = (page) => page.getByRole('dialog');

async function expectLoadedImage(image) {
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
}

test('gallery supports keyboard navigation and restores the opener and scroll position', async ({ page }) => {
  await page.goto('/photos/');
  const photos = photoLinks(page);
  const opener = photos.last();
  const openerHref = new URL(await opener.getAttribute('href'), page.url()).href;
  const firstHref = new URL(await photos.first().getAttribute('href'), page.url()).href;
  await opener.scrollIntoViewIfNeeded();
  await opener.focus();
  const scrollBefore = await page.evaluate(() => ({ x: scrollX, y: scrollY }));

  await opener.press('Enter');
  const dialog = lightbox(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '[close]', exact: true })).toBeFocused();
  await expectLoadedImage(dialog.locator('img'));

  await dialog.getByRole('button', { name: 'next photograph', exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'photo page', exact: true })).toHaveAttribute('href', firstHref);
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.getByRole('link', { name: 'photo page', exact: true })).toHaveAttribute('href', openerHref);
  await expectLoadedImage(dialog.locator('img'));

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  await expect.poll(() => page.evaluate(({ x, y }) => Math.max(Math.abs(scrollX - x), Math.abs(scrollY - y)), scrollBefore)).toBeLessThanOrEqual(1);
});

test('Back closes one gallery overlay and Forward restores its selected photograph', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'photographs', exact: true }).click();
  await page.evaluate(() => history.replaceState({ ...history.state, navigationProbe: 'retained' }, '', '?view=all#page-title'));
  const galleryUrl = page.url();
  const photos = photoLinks(page);
  const opener = photos.last();
  const selectedHref = new URL(await photos.first().getAttribute('href'), galleryUrl).href;
  await opener.scrollIntoViewIfNeeded();
  await opener.focus();
  const scrollBefore = await page.evaluate(() => ({ x: scrollX, y: scrollY }));

  await opener.press('Enter');
  const dialog = lightbox(page);
  await expect(dialog).toHaveAttribute('data-phase', 'open');
  await expect(page).toHaveURL(galleryUrl);
  await dialog.getByRole('button', { name: 'next photograph', exact: true }).click();
  await page.keyboard.press('ArrowRight');
  await dialog.getByRole('button', { name: 'previous photograph', exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'photo page', exact: true })).toHaveAttribute('href', selectedHref);
  expect(await page.evaluate(() => history.state.navigationProbe)).toBe('retained');

  await page.goBack();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(galleryUrl);
  await expect(opener).toBeFocused();
  await expect.poll(() => page.evaluate(({ x, y }) => Math.max(Math.abs(scrollX - x), Math.abs(scrollY - y)), scrollBefore)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => history.state.navigationProbe)).toBe('retained');

  await page.goForward();
  await expect(dialog).toHaveAttribute('data-phase', 'open');
  await expect(page).toHaveURL(galleryUrl);
  await expect(dialog.getByRole('link', { name: 'photo page', exact: true })).toHaveAttribute('href', selectedHref);
  await expectLoadedImage(dialog.locator('img'));
  expect(await page.evaluate(() => history.state.navigationProbe)).toBe('retained');
});

test('Escape, close, and backdrop dismissal leave the next Back for the previous page', async ({ page, baseURL }) => {
  await page.goto('/');
  for (const method of ['Escape', 'close', 'backdrop']) {
    await test.step(method, async () => {
      await page.getByRole('link', { name: 'photographs', exact: true }).click();
      const galleryUrl = page.url();
      await photoLinks(page).first().click();
      const dialog = lightbox(page);
      await expect(dialog).toHaveAttribute('data-phase', 'open');

      if (method === 'Escape') await page.keyboard.press('Escape');
      else if (method === 'close') await dialog.getByRole('button', { name: '[close]', exact: true }).click();
      else await dialog.locator('[data-lightbox-backdrop]').click({ position: { x: 2, y: 2 } });
      await expect(dialog).not.toBeVisible();
      await expect(page).toHaveURL(galleryUrl);

      await page.goBack();
      await expect(page).toHaveURL(new URL('/', baseURL).href);
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('santi villanueva');
    });
  }
});

test('reloading an open gallery retains the selected photograph and one overlay history entry', async ({ page, baseURL }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'photographs', exact: true }).click();
  const galleryUrl = page.url();
  const opener = photoLinks(page).last();
  const selectedHref = new URL(await photoLinks(page).first().getAttribute('href'), galleryUrl).href;
  await opener.scrollIntoViewIfNeeded();
  await opener.focus();
  const scrollBefore = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  await opener.press('Enter');
  let dialog = lightbox(page);
  await expect(dialog).toHaveAttribute('data-phase', 'open');
  await dialog.getByRole('button', { name: 'next photograph', exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'photo page', exact: true })).toHaveAttribute('href', selectedHref);

  await page.reload();
  dialog = lightbox(page);
  await expect(dialog).toHaveAttribute('data-phase', 'open');
  await expect(page).toHaveURL(galleryUrl);
  await expect(dialog.getByRole('link', { name: 'photo page', exact: true })).toHaveAttribute('href', selectedHref);
  await expectLoadedImage(dialog.locator('img'));

  await page.goBack();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(galleryUrl);
  await expect(opener).toBeFocused();
  await expect.poll(() => page.evaluate(({ x, y }) => Math.max(Math.abs(scrollX - x), Math.abs(scrollY - y)), scrollBefore)).toBeLessThanOrEqual(1);
  await page.goBack();
  await expect(page).toHaveURL(new URL('/', baseURL).href);
});

test('a failed enlarged photograph can be retried', async ({ page }) => {
  await page.goto('/');
  const opener = photoLinks(page).first();
  const source = await opener.getAttribute('data-photo-src');
  let failNextRequest = true;
  await page.route(new URL(source, page.url()).href, async (route) => {
    if (failNextRequest) {
      failNextRequest = false;
      await route.abort('failed');
    } else {
      await route.continue();
    }
  });

  await opener.click();
  const dialog = lightbox(page);
  await expect(dialog.getByText('couldn’t load this photograph.', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'photo page', exact: true })).toHaveAttribute('href', new URL(await opener.getAttribute('href'), page.url()).href);
  await dialog.getByRole('button', { name: '[try again]', exact: true }).click();
  await expectLoadedImage(dialog.locator('img'));
  await expect(dialog.getByRole('button', { name: '[try again]', exact: true })).not.toBeVisible();
});

test('the homepage loads the optimized font without downloading the original', async ({ page }) => {
  const fonts = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.endsWith('.woff2')) fonts.push(response);
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => [...document.fonts].some((face) => face.family === 'santi-index-mono' && face.status === 'loaded'))).toBe(true);
  expect(fonts.some((response) => response.url().includes('/fonts/santi-index-latin.woff2'))).toBe(true);
  expect(fonts.some((response) => response.url().includes('/fonts/MonaspaceNeonVar.woff2'))).toBe(false);
  let bytes = 0;
  for (const response of fonts) {
    expect(response.ok()).toBe(true);
    bytes += (await response.body()).length;
  }
  // Protect the gain on a real page, including any fallback font it requests.
  expect(bytes).toBeLessThan(150_000);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('photographs retain working canonical page links', async ({ page, baseURL }) => {
    await page.goto('/photos/');
    const photograph = photoLinks(page).first();
    const href = await photograph.getAttribute('href');
    expect(href).toMatch(/^\/photos\/[^/]+\/$/);
    await photograph.click();
    await expect(page).toHaveURL(new URL(href, baseURL).href);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    await expectLoadedImage(page.locator('.photo-figure img'));
  });
});

for (const [name, path] of [['homepage', '/'], ['photograph gallery', '/photos/']]) {
  test(`${name} fits the viewport and preserves photograph proportions`, async ({ page }) => {
    await page.goto(path);
    const photographs = photoLinks(page).locator('img');
    expect(await photographs.count()).toBeGreaterThan(0);
    for (const photograph of await photographs.all()) {
      await photograph.scrollIntoViewIfNeeded();
      await expectLoadedImage(photograph);
      const distortion = await photograph.evaluate((image) => {
        const bounds = image.getBoundingClientRect();
        return Math.abs((bounds.width / bounds.height) / (image.naturalWidth / image.naturalHeight) - 1);
      });
      expect(distortion).toBeLessThan(0.01);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test('retired letter URLs forward to their new home', async ({ page }) => {
  for (const [from, to] of [['/newsletter/keep-going/', '/notes/keep-going/'], ['/newsletter/', '/notes/'], ['/newsletter/art-politics-and-epstein/', '/notes/']]) {
    await page.goto(from);
    await expect(page).toHaveURL(new RegExp(`${to.replaceAll('/', '\\/')}$`));
  }
});
