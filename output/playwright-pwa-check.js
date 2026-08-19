async (page) => {
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    const response = await fetch(link.href);
    return { href: link.getAttribute('href'), status: response.status, json: await response.json() };
  });
  const registration = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { scope: reg.scope, active: reg.active?.state, controlled: Boolean(navigator.serviceWorker.controller) };
  });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  const controlledAfterReload = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  await page.context().setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  const offline = {
    url: page.url(),
    title: await page.title(),
    h1: await page.locator('h1').count(),
    body: (await page.locator('body').innerText()).slice(0, 120),
  };
  await page.context().setOffline(false);
  return { manifest, registration, controlledAfterReload, offline };
}
