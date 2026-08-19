# Coletores — fontes que exigem download (CNES e Inep)

Fontes que **não** têm API limpa (CNES/DATASUS via TabNet, INEP via Sinopse em
Excel) entram por aqui. O Python faz só o que o Node não faz bem — raspar/ler o
arquivo oficial e normalizar para `codigo_ibge;valor` — e **delega a importação
ao pipeline auditado** `api/scripts/ingestar-csv.mjs` (Bronze→Prata→Ouro).

Princípios preservados:

- **Só importa o que falta.** O upsert do conector é idempotente
  (RF-INGEST-006); e `ja_importado()` ainda pula o trabalho quando a referência
  já está no banco. Rodar todo dia é seguro.
- **Invisível ao usuário.** É operação de dados, agendada. O indicador nasce
  `EM_ANALISE` — publicar continua sendo ato humano (RG-09).
- **Auditoria intacta.** Toda escrita passa pelo conector Node (cadeia SHA-256,
  procedência, quarentena). O Python nunca escreve direto na tabela.

## Instalar e rodar

```bash
cd coletores
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # Windows
# banco: use o dono (as migrações do conector rodam como itmt)
set DATABASE_URL=postgres://itmt:itmt@localhost:5432/itmt

cd ..
coletores/.venv/Scripts/python -m coletores.coletar_fontes            # todas as fontes
coletores/.venv/Scripts/python -m coletores.coletar_fontes --fonte cnes-estabelecimentos
coletores/.venv/Scripts/python -m coletores.coletar_fontes --fonte inep --ano 2024
```

Pré-requisito de catálogo: os subtemas `Matrículas — rede pública` e
`Número de leitos / vagas de UTI` devem existir em `SubtemaConsulta` (senão o
conector aborta) — mesmo padrão dos demais.

## Agendamento diário no backend (automático)

Já está ligado no backend: o serviço **`rotinas`** (loop diário do
`docker-compose.prod.yml`) chama `node scripts/coletar-fontes.mjs`, que
dispara este coletor — ao lado de `refrescar-fontes` e `verificar-cadeia`.
O wrapper resolve o venv, degrada com elegância (sem Python instalado,
avisa e não derruba o loop) e é desligável por `COLETORES_AUTO=0`.

```bash
cd api && node scripts/coletar-fontes.mjs   # o que o rotinas roda 1×/dia
# ou: npm run coletar:fontes
```

> A imagem do serviço `rotinas` é construída por `coletores/Dockerfile` e já
> inclui Python, dependências e os scripts Node do pipeline.

**Dev no Windows (sem Docker):** agende o mesmo wrapper com o Task
Scheduler (`pythonw` roda sem janela):

```bat
schtasks /Create /TN "ITMT-coletores" /SC DAILY /ST 05:30 /F ^
  /TR "cmd /c cd /d C:\DevClaude\Plataforma itMT\api && set DATABASE_URL=postgres://itmt:itmt@localhost:5432/itmt && node scripts\coletar-fontes.mjs"
```

## Pontos de calibração (uma vez, contra o endpoint ao vivo)

O download real depende do layout de cada fonte — isolei isso para ser um ajuste
de **uma linha**, não mudança de código:

- **CNES leitos** (`fetch_cnes`): funcionamento validado contra o TabNet.
  Jun/2026). Fluxo real do TabNet: lê o formulário (`deftohtm.exe`), POSTa a
  consulta em `tabcgi.exe` (arquivo `ltmt<AAMM>.dbf`, `Incremento=Qtd_existente`,
  cada dimensão em "todas as categorias", corpo latin-1 codificado UMA vez) e
  **segue o link do CSV** que o TabNet gera (`/csv/…leiintmt<hash>.csv`) — a
  forma limpa de obter os dados. Alimenta o indicador **"Leitos de internação"**.
  **UTI ainda pendente:** `leiintmt.def` é **internação**, não UTI — o cubo de
  UTI/complementares tem outro `.def` (não localizado com nomes padrão:
  `leicompmt`/`leicomplmt`/`complbr` retornam erro). Quando a fonte de UTI for
  achada, entra como coletor/indicador separado, sem misturar com internação.
- **CNES estabelecimentos** (`fetch_cnes_estabelecimentos`): funcionamento
  validado ao vivo com 141 municípios e competência junho/2026.
- **INEP** (`fetch_inep`): usa a Sinopse Estatística oficial. O arquivo anual
  é grande (centenas de MB) e a origem pode encerrar conexões; retries e TLS pelo
  repositório de certificados do sistema estão habilitados. A detecção da aba
  (`matríc`) e das colunas
  (`_coluna(...)` com as pistas "código do município" e "pública") cobre o
  layout recente; a Sinopse muda de forma entre anos.

Rode uma vez, e se algo não casar o log diz exatamente qual coluna/campo ler —
me mande essa linha que eu finalizo a calibração.
