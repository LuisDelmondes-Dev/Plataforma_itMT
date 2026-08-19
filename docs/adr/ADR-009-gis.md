# ADR-009 — PostGIS, GeoServer e Cesium/3D Tiles

**Status:** Proposta  
**Data:** 15/08/2026

## Contexto

OGC/GeoJSON atende o catálogo inicial, mas rasters, feições complexas, 360° e 3D
exigem pipeline geoespacial próprio.

## Decisão proposta

PostGIS armazena geometrias consultáveis; GeoServer publica WMS/WFS/WMTS; objetos
pesados ficam em S3; Cesium consome 3D Tiles derivados. SIRGAS 2000 permanece o
SRC de referência e toda derivação preserva lineage e versão.

## Consequências e riscos

Exige benchmark, simplificação por zoom, cache, controle de acesso espacial,
metadados de acurácia e processo independente de geração de tiles.

