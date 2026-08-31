# Referências da barra de qualidade — Gauntlet "Pesquisa vs IA Xingú"

Verificadas e abertas em 26/08/2026. Regra do gauntlet: a referência precisa ser
buscável, abrível e comparável lado a lado com o nosso artefato. Todo crítico
visual DEVE abrir a referência da sua peça antes de emitir veredito; se não
conseguir abrir, PARA e reporta (não aprova).

## Modo PESQUISA — barra "resposta completa e simples"

### R1 — TabNet/DATASUS · Óbitos infantis — Mato Grosso
- URL: http://tabnet.datasus.gov.br/cgi/deftohtm.exe?sim/cnv/inf10mt.def
- Verificado: abre; painel de tabulação com Linha/Coluna/Conteúdo.
- Dimensões confirmadas na tela: Município, Região de Saúde (CIR), Macrorregião,
  **Capítulo CID-10, Categoria CID-10, Lista Mort CID-10, Causas evitáveis 0–4
  anos**, Ano/mês do óbito, faixas etárias detalhadas (componentes neonatais),
  sexo, cor/raça, peso ao nascer, óbito investigado.
- Períodos: 1996–2026. "Dados finais disponíveis até 2024 e atualizados em
  02/12/2025. Dados de 2025 – 3ª prévia (02/04/2026); 2026 – 1ª prévia (01/06/2026)."
- Fonte declarada: MS/SVSA/CGIAE — SIM.
- Export: formatos "Colunas separadas por ;" (CSV) na própria tela.
- Papel no gauntlet: barra de COMPLETUDE do modo Pesquisa (tudo isso existe;
  nossa tela precisa vencer em CLAREZA sem perder a completude essencial).

### R2 — IBGE Cidades · Sinop (MT) · Panorama
- URL: https://cidades.ibge.gov.br/brasil/mt/sinop/panorama
- Verificado: abre; cards de indicadores (População censo 2022: 196.312;
  estimada 2025: 223.780; etc.), com ano de referência entre colchetes e fonte.
- Papel no gauntlet: barra de SIMPLICIDADE/legibilidade de página de indicador
  municipal (card + valor + ano + fonte).

## Modo IA XINGÚ — barra "painel de gestão que um secretário usaria"

### R3 — Painel de Monitoramento da Mortalidade Infantil e Fetal (SVS/MS)
- URL: http://plataforma.saude.gov.br/mortalidade/infantil-e-fetal/
  (alias: https://svs.aids.gov.br/daent/centrais-de-conteudos/paineis-de-monitoramento/mortalidade/infantil-e-fetal/)
- Verificado: abre; filtros de Ano (até 2026*), Local de registro
  (residência/ocorrência), Abrangência (País→Localidade), **Indicador (inclui
  Causas evitáveis)**, Grupo etário, Raça/Cor, Sexo, visualização linha/coluna,
  Exportar/Compartilhar, notas metodológicas numeradas.
- Papel no gauntlet: barra do dashboard explicativo do Xingú (multi-visão,
  filtros, notas de método). Nossa tela precisa VENCER em capacidade de decisão:
  o painel do MS mostra, mas não recomenda nem prioriza.

### R4 — Boletim Epidemiológico de Mortalidade Infantil — SES-MT (PDF)
- URL: https://www.saude.mt.gov.br/storage/files/FCllc87MAg1RkWYmqTRn7MwNZqsT13ggcb5vikSw.pdf
- Cópia local: `docs/gauntlet/referencias/R4-boletim-ses-mt-mortalidade-infantil.pdf` (1,1 MB)
- Verificado: URL responde o PDF (download). Conteúdo a extrair na rodada do
  crítico de gestão pública (texto via skill de PDF).
- Papel no gauntlet: barra das SUGESTÕES do Xingú — linguagem, fundamentação e
  formato de recomendação que uma secretaria estadual realmente publica.

### R5 (opcional) — Observatório de referência
- Não capturado nesta rodada ("se disponível" no prompt). Candidato: painéis
  Fiocruz/Icict. Registrar aqui se algum crítico precisar de barra adicional.

## Limitação registrada
Screenshots desktop/mobile pedidos no prompt: o ambiente salva texto e permite
abrir as telas ao vivo (pane do navegador), mas não exporta screenshot como
arquivo. Os críticos comparam AO VIVO (abrindo a URL) — o que é mais forte que
screenshot estático. Os extratos textuais acima registram o que cada referência
continha na data de verificação.
