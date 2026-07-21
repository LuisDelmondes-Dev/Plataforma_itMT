import Link from 'next/link';
import { apiGet, Resultado } from '@/lib/api';
import { CartaoIndicador } from '@/components/CartaoIndicador';

interface Ficha {
  codigo_ibge: string;
  nome: string;
  area_km2: string;
  regiao_imediata: string;
  regiao_intermediaria: string;
}

const fmt = new Intl.NumberFormat('pt-BR');

/** Ficha-síntese municipal, renderizada no servidor (RF-PORTAL-013: SSR para SEO). */
export default async function FichaMunicipal({ params }: { params: { codigo: string } }) {
  let ficha: Ficha;
  try {
    ficha = await apiGet<Ficha>(`/municipios/${params.codigo}`);
  } catch {
    return (
      <div className="aviso">
        Município {params.codigo} não encontrado. Verifique o código municipal de 7 dígitos.{' '}
        <Link href="/consulta">Buscar por nome →</Link>
      </div>
    );
  }

  // RF-PORTAL-011: os indicadores da ficha vêm do catálogo (os publicados
  // que têm dado), não de uma lista fixa de ids.
  const chave = await apiGet<number[]>('/indicadores/destaque?limite=4').catch(() => [] as number[]);
  const resultados = await Promise.all(
    chave.map((id) =>
      apiGet<Resultado>(
        `/indicadores/${id}/consulta?recorte=MUNICIPIO&codigo=${params.codigo}`,
      ).catch(() => null),
    ),
  );

  return (
    <div>
      <nav className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
        Mato Grosso › {ficha.regiao_intermediaria} › {ficha.regiao_imediata} › {ficha.nome}
      </nav>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, margin: '16px 0 8px' }}>
        <h1 style={{ fontSize: 32, lineHeight: '40px', fontWeight: 600, margin: 0 }}>
          {ficha.nome}
        </h1>
        <span className="mono" style={{ fontSize: 14, color: 'var(--ink-3)' }}>
          {ficha.codigo_ibge}
        </span>
      </div>
      <p style={{ color: 'var(--ink-2)', marginTop: 0 }}>
        Região Imediata de {ficha.regiao_imediata} · Região Intermediária de{' '}
        {ficha.regiao_intermediaria} ·{' '}
        <span className="mono">{fmt.format(Number(ficha.area_km2))} km²</span>
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
          marginTop: 24,
        }}
      >
        {chave.length === 0 && (
          <div className="aviso">
            Ainda não há indicador publicado com dado para a ficha-síntese. A ausência de
            dado é uma resposta legítima — nada foi estimado.
          </div>
        )}
        {resultados.map((r, i) =>
          r ? (
            <CartaoIndicador key={chave[i]} resultado={r} />
          ) : (
            <div key={chave[i]} className="aviso">
              Sem dado publicado para este indicador. A ausência de dado é uma resposta
              legítima — nada foi estimado.
            </div>
          ),
        )}
      </div>

      <p style={{ marginTop: 24, fontSize: 14 }}>
        <Link href="/consulta">Consultar outros temas para {ficha.nome} →</Link>
      </p>
    </div>
  );
}
