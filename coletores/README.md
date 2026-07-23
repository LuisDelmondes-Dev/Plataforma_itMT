# Coletores — fontes que exigem download (CNES, INEP)

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

python -m coletores.coletar_fontes            # todas as fontes
python -m coletores.coletar_fontes --fonte inep --ano 2023
```

Pré-requisito de catálogo: os subtemas `Matrículas — rede pública` e
`Número de leitos / vagas de UTI` devem existir em `SubtemaConsulta` (senão o
conector aborta) — mesmo padrão dos demais.

## Agendamento diário, invisível (Windows)

`pythonw` roda sem janela; o Task Scheduler dispara 1×/dia:

```bat
schtasks /Create /TN "ITMT-coletores" /SC DAILY /ST 05:30 /F ^
  /TR "cmd /c cd /d C:\DevClaude\Plataforma itMT && set DATABASE_URL=postgres://itmt:itmt@localhost:5432/itmt && coletores\.venv\Scripts\pythonw.exe -m coletores.coletar_fontes"
```

Em produção (Linux/compose), o mesmo comando entra no serviço `rotinas`
(cron `30 5 * * *`), ao lado de `refrescar:fontes` e `verificar-cadeia`.

## Pontos de calibração (uma vez, contra o endpoint ao vivo)

O download real depende do layout de cada fonte — isolei isso para ser um ajuste
de **uma linha**, não mudança de código:

- **CNES** (`fetch_cnes`, dict `params`): os campos do formulário TabNet
  (`Arquivos`, `Incremento`, `SLeito_UTI`). O `.def` de MT (`leiintmt.def`) está
  no ar; confirme os nomes exatos abrindo o formulário uma vez.
- **INEP** (`fetch_inep`): a detecção da aba (`matríc`) e das colunas
  (`_coluna(...)` com as pistas "código do município" e "pública") cobre o
  layout recente; a Sinopse muda de forma entre anos.

Rode uma vez, e se algo não casar o log diz exatamente qual coluna/campo ler —
me mande essa linha que eu finalizo a calibração.
