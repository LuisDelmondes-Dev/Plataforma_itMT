# GIS_PIPELINE.md — Pipeline de Mapeamento Digital

> ✅ Os documentos detalham 4 frentes simultâneas de mapeamento digital de todo o Estado. Este arquivo organiza o pipeline técnico e os produtos gerados.

## 1. Frentes de mapeamento (✅)
1. **Geoprocessamento (GIS)** — sistemas de informação georreferenciada.
2. **Projetos Estruturantes MT** — registro de empreendimentos/infraestrutura fora do perímetro urbano.
3. **Registro Cinegráfico e Fotojornalístico** — portfólio institucional e turístico dos municípios.
4. **Mapeamento Estatístico** — pesquisa domiciliar demográfica (2º ano).

## 2. Levantamento aéreo — VANT/Drone (✅)
- Sobrevoo de **todas as cidades** do Estado.
- Produtos: dados topográficos precisos das 142 sedes municipais e principais distritos; mapas com curvas de nível; **ortomosaico**, **modelo digital de superfície (MDS)** e **modelo digital de terreno (MDT)**, renderizáveis em **3D**.
- Animações geradas a partir do mapeamento aéreo.

**Pipeline técnico 🧩:**
```
Voo (drone) → captura de imagens → fotogrametria → nuvem de pontos →
  ├─ ortomosaico (GeoTIFF)
  ├─ MDS / MDT (raster)
  └─ malha 3D (tiles 3D / Cesium)
→ armazenamento (object storage) → publicação (GeoServer/MapLibre/Cesium)
```

## 3. Street View 360º / 8K (✅)
- Hoje apenas **39 dos 142 municípios** têm ruas no Street View do Google.
- Meta: mapear os **103 restantes** com câmera 360º em qualidade **8K**.
- Após as cidades: principais rios, trilhas, rotas turísticas, bacias pantaneiras, estradas vicinais, assentamentos rurais, comunidades indígenas e quilombolas.
- Imagens disponibilizadas no **Google Maps** (universalização do acesso) e na plataforma.

## 4. Registro Cinegráfico e Fotojornalístico (✅)
- Entrevistas com autoridades municipais e população (gravadas).
- Vídeos institucionais de **15–20 min** por município (portfólio econômico/turístico) — publicados na plataforma, mídia local e redes sociais.
- Captura com câmeras 3D 360º 8K + drone profissional.
- **MT Imagens** — app/banco de imagens e vídeos (inclusive 3D); população e instituições convidadas a contribuir.

## 5. Mapeamento Estatístico — Pesquisa Domiciliar (✅)
- **2º ano**, em convênio com prefeituras.
- MT possui **5.107 agentes comunitários de saúde** e **2.041 agentes de combate a endemias**.
- Agentes voluntários aplicam **questionário resumido** via app durante visitas; **recompensa financeira** como contrapartida.
- App com modo **offline** e sincronização (ver USER_FLOWS §11).

## 6. Camadas GIS na plataforma
- Relevo, hidrografia, clima/pluviometria, jazidas (tema Geografia).
- Infraestrutura macro/urbana georreferenciada.
- Ortomosaicos, MDS/MDT, 3D por município.
- Street View integrado.

## 7. Tecnologias sugeridas 🧩
- **Banco geoespacial:** PostGIS.
- **Servidor de mapas/tiles:** GeoServer.
- **Visualização:** MapLibre (2D), Cesium (3D).
- **Fotogrametria:** ferramentas de processamento de nuvem de pontos/ortomosaico.
- **Armazenamento:** object storage para rasters, nuvens de pontos e mídia (com CDN).

## 8. Considerações
- Volume de dados elevado (rasters/3D/vídeo) → storage + CDN + tiles.
- Direitos de imagem e consentimento para entrevistas/contribuições (ver SECURITY_LGPD.md).
- Priorização: cidades → rotas/elementos rurais → campo estatístico.
