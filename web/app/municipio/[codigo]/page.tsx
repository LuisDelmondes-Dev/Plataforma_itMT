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

// Indicadores-chave da ficha-síntese (RF-PORTAL-011). No F1 completo esta
// lista vem do catálogo, não de constante — mantida aqui pela simplicidade do MVP.
const INDICADORES_CHAVE = [2, 1, 3, 4];

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

  const resultados = await Promise.all(
    INDICADORES_CHAVE.map((id) =>
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
        {resultados.map((r, i) =>
          r ? (
            <CartaoIndicador key={INDICADORES_CHAVE[i]} resultado={r} />
          ) : (
            <div key={INDICADORES_CHAVE[i]} className="aviso">
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
