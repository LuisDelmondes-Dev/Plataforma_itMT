'use client';

/**
 * Índice das fichas municipais (Onda D): o menu apontava para um município
 * hardcoded — agora a pessoa escolhe entre os 142, por busca ou lista.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiGet, ErroApi } from '@/lib/api';
import { REGIAO } from '@/lib/regiao';
import { CabecalhoPagina } from '@/components/CabecalhoPagina';
import { ComboboxMunicipio, type MunicipioOpcao } from '@/components/ComboboxMunicipio';
import { EstadoDado } from '@/components/EstadoDado';

export default function IndiceMunicipios() {
  const router = useRouter();
  const [municipios, setMunicipios] = useState<MunicipioOpcao[] | null>(null);
  const [erro, setErro] = useState<unknown>(null);

  function carregar() {
    setErro(null);
    apiGet<MunicipioOpcao[]>('/municipios', { revalidate: 3600 })
      .then(setMunicipios)
      .catch((e) => setErro(e));
  }
  useEffect(carregar, []);

  return (
    <div style={{ maxWidth: 900 }}>
      <CabecalhoPagina
        overline="Explorar dados"
        titulo="Fichas municipais"
        descricao={`Cada um dos ${REGIAO.municipiosEsperados} municípios de ${REGIAO.nome} tem uma ficha-síntese com indicadores, série histórica, comparação territorial e localização.`}
      />

      {erro instanceof ErroApi || erro ? (
        <EstadoDado estado="erro" erro={erro} aoTentarNovamente={carregar} />
      ) : municipios === null ? (
        <EstadoDado estado="carregando" />
      ) : (
        <>
          <div style={{ maxWidth: 420 }}>
            <ComboboxMunicipio
              municipios={municipios}
              rotulo="Abrir a ficha de um município"
              aoSelecionar={(m) => router.push(`/municipio/${m.codigo_ibge}`)}
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 4,
              marginTop: 24,
            }}
          >
            {municipios.map((m) => (
              <Link
                key={m.codigo_ibge}
                href={`/municipio/${m.codigo_ibge}`}
                className="opcao"
                style={{ textDecoration: 'none' }}
              >
                {m.nome}
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {m.codigo_ibge}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
