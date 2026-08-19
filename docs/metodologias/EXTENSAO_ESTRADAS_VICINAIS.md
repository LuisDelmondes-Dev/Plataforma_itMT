# Extensão de estradas vicinais

## Definição

Comprimento, em quilômetros, do eixo de vias municipais rurais classificadas como
vicinais dentro do recorte e da data de referência. Rodovias federais/estaduais,
vias urbanas e duplicações geométricas não integram o total.

## Método de cálculo

1. Receber malha vetorial com identificador da via, jurisdição, classe, geometria,
   município, data de levantamento, CRS, origem e licença.
2. Validar geometria, remover segmentos duplicados e transformar para uma projeção
   métrica adequada, preservando o original soberano.
3. Recortar segmentos na divisa municipal e calcular o comprimento geodésico.
4. Somar os segmentos por município; Estado, regiões e consórcios usam `SOMA`.
5. Publicar cobertura, data, precisão, limitações e quinteto de procedência.

## Gate de dados

O indicador permanece `SEM_FONTE` e não publica valor até que o Comitê de Dados:

- homologue fonte oficial ou levantamento ITMT;
- aprove licença/base legal e Data Owner;
- valide amostra contra imagens/levantamento de campo;
- confirme cobertura dos dez municípios piloto;
- aprove incerteza e regra de atualização.

Ausência de dado deve produzir resposta explícita; estimativas não podem ser
apresentadas como extensão observada.

