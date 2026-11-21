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

test('newsletter forms use native email validation without sending a subscription', async ({ page }) => {
  const posts = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url());
  });
  // Any accidental submission stays inside the test; no address reaches Buttondown.
  await page.route('https://buttondown.com/**', (route) => route.abort('blockedbyclient'));

  for (const path of ['/', '/newsletter/']) {
    await page.goto(path);
    const email = page.getByRole('textbox', { name: 'your email', exact: true });
    const submit = page.getByRole('button', { name: 'i’m in!', exact: true });
    const form = page.locator('form').filter({ has: email });
    const initialUrl = page.url();
    await expect(form).toHaveAttribute('method', /post/i);
    await expect(form).toHaveAttribute('action', 'https://buttondown.com/api/emails/embed-subscribe/sawnts');

    await submit.click();
    await expect(email).toBeFocused();
    expect(await email.evaluate((element) => element.validity.valueMissing)).toBe(true);
    await email.fill('not-an-email');
    await submit.click();
    await expect(email).toBeFocused();
    expect(await email.evaluate((element) => element.validity.typeMismatch)).toBe(true);
    await email.fill('reader@example.test');
    expect(await email.evaluate((element) => element.checkValidity())).toBe(true);
    await expect(page).toHaveURL(initialUrl);
  }
  expect(posts).toEqual([]);
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
