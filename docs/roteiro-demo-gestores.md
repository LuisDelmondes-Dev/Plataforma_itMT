# Roteiro de demonstração — Plataforma ITMT para gestores

> **Duração:** ~15 minutos + perguntas.
> **Público:** gestores públicos, secretários, equipes de planejamento.
> **Preparação:** API e portal no ar (`:3001` / `:3000`); banco dev com as cargas do IBGE.
> Todos os números deste roteiro são **reais** (IBGE, ref. indicada) e estarão na tela.

**A tese em uma frase:** *o gestor decide com quatro perguntas — onde estamos, onde dói,
para onde vamos e como eu provo — e a plataforma responde as quatro, com fonte em cada número.*

---

## 0. Abertura (1 min)

**Fala sugerida:**
> "Todo número que vocês vão ver nesta demonstração tem três propriedades: veio de uma
> fonte oficial identificada, tem a data de referência declarada, e é rastreável até o
> arquivo bruto de origem. Quando não temos um dado, a plataforma diz 'não temos' —
> ela nunca estima em silêncio. É essa disciplina que transforma informação em decisão
> defensável."

---

## 1. Onde estamos — Painel (2 min) · `/painel`

Abra o **Painel**. Mostre os KPIs estaduais com a régua de procedência embaixo de cada um:

| KPI na tela | Valor real | Fonte |
|---|---|---|
| PIB municipal (soma dos 141) | **R$ 273,0 bilhões** (2023) | IBGE agregado 5938 |
| População estimada | **3.893.659 hab** (2025) | IBGE agregado 6579 |
| Área plantada | **21,2 milhões ha** (2023) | IBGE PAM 1612 |

**Fala:** aponte a linha pequena sob cada número —
> "Isso é a régua de procedência: fonte, referência, extração, licença e o hash do
> arquivo bruto. Ela acompanha o número em toda a plataforma, inclusive na exportação."

Clique no chip **Área plantada**: tendência, ranking (1º Sorriso) e projeção tracejada
recarregam juntos.

## 2. Onde dói — Mapa (2 min) · `/mapa`

Selecione **PIB municipal**. O coroplético abre com as 5 classes.

**Fala:**
> "A média estadual esconde o território. Aqui: Cuiabá tem PIB de R$ 39 bilhões;
> Araguainha, R$ 31 milhões — uma razão de mais de mil vezes. Política regional começa
> enxergando isso."

Passe o mouse (tooltip com valor + fonte), clique num município → cai na **ficha
municipal** (use Sorriso: PIB R$ 13,7 bi, 124,7 mil hab, 1,22 mi ha plantados).
Troque o ano para 2019 e volte a "mais recente" — a evolução espacial aparece.

Detalhe técnico que agrada auditoria: o mapa é servido pelo próprio portal — nenhum
dado do usuário vai a servidores de terceiros.

## 3. Isso é muito ou pouco? — Consulta comparada (2 min) · `/consulta`

Busque **Sorriso** → tema Agronegócio → Área plantada. Mostre a comparação
Município × Região Imediata × Intermediária × Estado na mesma tela, e a série 2019–2023.

**Fala:**
> "E uma garantia que evita um erro clássico: taxa aqui nunca é somada — é recalculada
> de numerador e denominador. A agregação honesta é regra do motor, não boa vontade
> do analista."

## 4. Para onde vamos — Cenários (3 min) · `/cenarios` ⭐

A peça de planejamento. Selecione **PIB municipal**, estado, horizonte 3 anos,
taxas `2.5, 5`. O gráfico mostra o observado (linha cheia) e três trajetórias tracejadas:

| Cenário | 2024 | 2025 | 2026 |
|---|---|---|---|
| **Tendência (OLS 2019–2023, R²=0,96)** | R$ 318,1 bi | R$ 352,0 bi | R$ 385,9 bi |
| **+2,5% a.a.** (conservador) | R$ 279,8 bi | R$ 286,8 bi | R$ 294,0 bi |
| **+5% a.a.** (moderado) | R$ 286,7 bi | R$ 301,0 bi | R$ 316,0 bi |

**Fala:**
> "Três leituras para a mesma decisão de orçamento. E repare no rótulo: cada linha
> declara o próprio método, e o aviso diz com todas as letras — isto é hipótese para
> planejar, não dado observado. A plataforma nunca deixa uma projeção se vestir de fato."

Troque o local para um município (ex.: Sorriso) e mostre que a simulação desce ao
recorte municipal na hora.

## 5. Pergunte com suas palavras — IA Xingú (2 min) · `/xingu`

Digite: **"qual a área plantada de Sorriso?"**
Resposta na tela: *"Em Sorriso, Área plantada registrava 1.217.801 hectares (ref. 2023)."*
— com o bloco **✛ PLANO** acima e a citação da fonte.

**Fala:**
> "O modelo de linguagem entende a pergunta e narra a resposta — mas o número vem
> sempre do motor determinístico. Existe um auditor interno que veta qualquer numeral
> que o modelo invente. E se a IA estiver indisponível, o chat continua funcionando
> no modo determinístico: o portal nunca depende dela."

Se quiser provar a honestidade: pergunte algo sem dado (ex.: "leitos de UTI de Cuiabá")
→ a resposta explica a ausência em vez de chutar.

## 6. Como eu provo — governança (2 min) · `/transparencia`, dossiê

Para fechar, o que sustenta tudo em auditoria (TCE/MP/imprensa):

1. **Publicação é ato humano**: indicador novo nasce "em análise" e só aparece após
   parecer assinado com justificativa. A validação técnica automática produz um
   *dossiê* de 6 checagens — insumo, nunca decisão.
2. **Trilha imutável**: cada consulta, carga, parecer e veto entra numa cadeia
   SHA-256 que nem o administrador consegue reescrever (INSERT-only no banco).
3. **Exportação com procedência linha a linha** (CSV/XLSX/PDF na tela de consulta) —
   o anexo do processo administrativo sai pronto.
4. **Co-produção governada**: universidades e parceiros têm papel próprio para
   submeter estudos e dados — que também só publicam após curadoria.

**Fala de fechamento:**
> "Onde estamos, onde dói, para onde vamos, e como eu provo. As quatro respostas, na
> mesma plataforma, com fonte em cada número. É isso que a gente chama de inteligência
> territorial."

---

## Perguntas frequentes de gestor (e as respostas honestas)

**"E os temas que não vi — saúde, educação, segurança?"**
A infraestrutura está pronta e os conectores existem; essas fontes exigem o arquivo
oficial (CNES, INEP, SESP). Cada CSV baixado vira indicador em minutos — e entra pelo
mesmo funil de curadoria.

**"Quem garante que ninguém altera um número?"**
O papel de banco da aplicação não tem permissão de UPDATE na auditoria — a
imutabilidade é do PostgreSQL, não de uma promessa. O verificador de cadeia recomputa
os hashes de ponta a ponta e roda na esteira de testes.

**"A IA pode alucinar um número?"**
Pode tentar — e é vetada. O auditor A06 compara todo numeral do texto com o conjunto
autorizado pelo motor; divergiu, a resposta é substituída pela narrativa determinística
e o veto entra na trilha. Isso é testado com sabotagem deliberada na suíte.

**"Posso confiar na projeção para orçamento?"**
Para horizonte curto e com o R² na tela, ela é um instrumento — declarado e
reproduzível (mesma série, mesma projeção, sempre). A decisão continua sua; a
plataforma garante que você sabe exatamente no que está se apoiando.

**"Quanto disso depende de internet ou de terceiros?"**
O portal responde 100% do próprio banco. A internet só é usada pelos agentes de fonte,
nos bastidores, para atualizar dados vencidos — e o mapa não usa nenhum serviço externo.
