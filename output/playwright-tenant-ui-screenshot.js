async (page) => {
  await page.getByRole('button', { name: 'Listar organizações' }).click();
  await page.getByText('Consórcio Territorial A').waitFor();
  await page.screenshot({
    path: 'C:/DevCodex/Plataforma itMT/output/playwright/tenant-selector.png',
    fullPage: true,
  });
  return { cards: await page.locator('.org-card').count() };
}
