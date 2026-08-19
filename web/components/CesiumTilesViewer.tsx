'use client';

import { useEffect, useRef, useState } from 'react';

interface CesiumTilesViewerProps {
  url: string;
  title: string;
}

export function CesiumTilesViewer({ url, title }: CesiumTilesViewerProps) {
  const container = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let viewer: { destroy(): void; isDestroyed(): boolean } | undefined;

    async function initialize() {
      try {
        (window as typeof window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = '/cesium/';
        const { Cesium3DTileset, Viewer } = await import('cesium');
        if (!container.current || disposed) return;
        const instance = new Viewer(container.current, {
          animation: false,
          baseLayer: false,
          baseLayerPicker: false,
          fullscreenButton: true,
          geocoder: false,
          homeButton: true,
          infoBox: false,
          navigationHelpButton: false,
          sceneModePicker: true,
          selectionIndicator: false,
          timeline: false,
        });
        viewer = instance;
        const tileset = await Cesium3DTileset.fromUrl(url);
        if (disposed) return;
        instance.scene.primitives.add(tileset);
        await instance.zoomTo(tileset);
      } catch {
        if (!disposed) setFailure('O modelo 3D não pôde ser carregado neste dispositivo ou a origem está indisponível.');
      }
    }

    void initialize();
    return () => {
      disposed = true;
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
    };
  }, [url]);

  return (
    <section className="cesium-painel" aria-label={`Visualização 3D de ${title}`}>
      {failure ? (
        <div className="cesium-fallback" role="status">
          <strong>Visualização 3D indisponível</strong>
          <span>{failure}</span>
          <a href={url}>Abrir o tileset diretamente</a>
        </div>
      ) : (
        <div ref={container} className="cesium-canvas" aria-label={`Modelo tridimensional: ${title}`} />
      )}
    </section>
  );
}
