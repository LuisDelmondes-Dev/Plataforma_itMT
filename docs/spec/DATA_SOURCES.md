# DATA_SOURCES.md — Catálogo de Fontes de Dados

> ✅ Os documentos preveem coleta de "todos os dados disponíveis em fontes governamentais, privadas, institucionais e acadêmicas", via parcerias, convênios ou prospecção (mineração) digital, mantida atualizada. 🧩 Este catálogo organiza o levantamento; URLs/acessos específicos ⚠️ a confirmar.

## 1. Tipos de fonte
- **Governamental** (federal/estadual/municipal).
- **Privada** (instituições, empresas, cooperativas).
- **Institucional/Acadêmica** (universidades, conselhos).
- **Própria** (mapeamento digital realizado pela plataforma — ver GIS_PIPELINE.md).

## 2. Modelo de registro (por fonte)
Cada fonte deve registrar: nome · tipo · tema(s) coberto(s) · forma de acesso (API/portal/scraping/convênio) · licença de uso · periodicidade de atualização · contato/parceiro · status.

## 3. Fontes candidatas por tema (a validar ⚠️)

| Tema | Fonte candidata | Acesso provável | Observações |
|------|-----------------|-----------------|-------------|
| Demografia | IBGE (Censos 1990/2000/2010/2022) | API/portal público | Base do tema Demografia ✅ |
| Geografia | IBGE, órgãos estaduais de geo | API/portal | Mapas, relevo, hidrografia |
| Imprensa Oficial | Diário Oficial de MT / municípios | Portal/scraping | ✅ Exceto atos de RH |
| Economia Setor Público | Portais de transparência (estado/municípios), Tesouro | Portal/API/convênio | Arrecadação, repasses, obras |
| Economia Setor Privado | Juntas comerciais, entidades setoriais | Convênio/portal | Indústria, comércio, serviços |
| Saúde | DATASUS/CNES, Secretaria de Saúde MT | API/portal | Unidades, leitos, indicadores |
| Segurança Pública | SESP-MT, órgãos federais | Convênio/portal | Delegacias, unidades |
| Educação | INEP/Censo Escolar, SEDUC-MT | API/portal | Escolas, indicadores |
| Agronegócio | IMEA, IBGE-PAM/PPM, IMEA/MAPA | Convênio/portal | Área plantada, rebanho |
| Infraestrutura Macro/Urbana | DNIT, SINFRA-MT, prefeituras, agências | Convênio/portal | Rodovias, energia, saneamento |
| Assistência Social | MDS/CadÚnico, secretarias | Convênio/portal | CRAS, vulnerabilidade |
| Instituições | Cadastros oficiais | Portal | Órgãos, cartórios, conselhos |
| Registros Históricos | Arquivos públicos, IPHAN, acervos | Convênio | Patrimônio, ciclos econômicos |

> ⚠️ A existência de fonte estruturada para **"estradas vicinais"** (caso de referência) precisa ser confirmada (candidatas: SINFRA-MT, prefeituras, mapeamento próprio via GIS).

## 4. Estratégias de ingestão
- **APIs públicas:** conectores diretos (preferencial).
- **Portais sem API:** scraping responsável + parsing (✅ "prospecção/mineração por meios digitais").
- **Convênios:** cessão periódica de dados por instituições (✅ "instadas a participar, cedendo e atualizando").
- **Conteúdo próprio:** mapeamento digital (GIS, drone, Street View, estatístico).

## 5. Atualização e qualidade
- Periodicidade por fonte (SLA de atualização) — definir ⚠️.
- Registrar `data_atualizacao`, `versao` e `origem` em cada valor (RN05/RN07/RN13).
- Conflitos entre fontes: manter ambas, padrão = mais recente, sinalizar (RN12).
- Lacunas: declarar explicitamente; nunca supor (RN11).

## 6. Governança
- Respeitar licença/uso de cada fonte.
- Convênios podem impor restrição de uso/redistribuição.
- ✅ Acesso ao banco consolidado deve ser gratuito ao público (meta estratégica).
