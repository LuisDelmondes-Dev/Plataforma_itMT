async (page) => {
  const ids = {
    tenant: '30000000-0000-4000-8000-000000000001',
    a: '40000000-0000-4000-8000-000000000001',
    b: '40000000-0000-4000-8000-000000000002',
  };
  const apiRequests = [];
  await page.route('**/api/v1/**', async (route) => {
    const pathname = `/${route.request().url().split('/').slice(3).join('/').split('?')[0]}`;
    apiRequests.push(pathname);
    if (pathname.endsWith('/auth/organizacoes')) return route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([{
        tenant_id: ids.tenant, organization_id: ids.a, slug: 'org-a',
        nome: 'Consórcio Territorial A', papel: 'OWNER', membership_version: 3,
      }]),
    });
    if (pathname.endsWith('/auth/contexto')) return route.fulfill({
      status: 201, contentType: 'application/json', body: JSON.stringify({
        token: 'contexto-assinado-a', tenant_id: ids.tenant, organization_id: ids.a,
      }),
    });
    if (pathname.includes(`/organizacoes/${ids.a}/configuracoes`)) return route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([
        { chave: 'tema', valor: { cor: 'azul' }, atualizada_em: '2026-08-15T00:00:00Z' },
      ]),
    });
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"statusCode":404}' });
  });

  await page.goto('http://localhost:3100/organizacoes');
  await page.getByLabel('Token da identidade').fill('identidade-assinada');
  await page.getByRole('button', { name: 'Listar organizações' }).click();
  await page.getByRole('button', { name: /Consórcio Territorial A/ }).click();
  await page.waitForURL('**/o/org-a');
  await page.getByRole('heading', { name: 'Consórcio Territorial A' }).waitFor();
  const proprio = await page.locator('main').innerText();

  const requestsAntes = apiRequests.length;
  await page.goto('http://localhost:3100/o/org-b');
  await page.getByText('DENIED').waitFor();
  const negado = await page.locator('main').innerText();
  const requestsDepois = apiRequests.length;
  return {
    urlA: 'http://localhost:3100/o/org-a',
    proprioTemTema: proprio.includes('tema') && proprio.includes('azul'),
    urlB: page.url(),
    denied: negado.includes('DENIED') && negado.includes('Nenhum dado foi solicitado'),
    nenhumaApiAoDigitarB: requestsDepois === requestsAntes,
    apiRequests,
  };
}
