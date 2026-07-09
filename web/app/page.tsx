import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ maxWidth: 720, margin: '64px auto', textAlign: 'center' }}>
      <div className="overline">Inteligência Territorial de Mato Grosso</div>
      <h1
        style={{
          fontSize: 44,
          lineHeight: '48px',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          margin: '16px 0',
        }}
      >
        142 municípios. Cada número com a sua origem.
      </h1>
      <p style={{ fontSize: 18, lineHeight: '28px', color: 'var(--ink-2)' }}>
        Indicadores socioeconômicos, geográficos e institucionais sob um recorte
        territorial canônico — com procedência clicável até o arquivo bruto.
      </p>
      <form
        action="/consulta"
        style={{ display: 'flex', gap: 8, marginTop: 32, justifyContent: 'center' }}
      >
        <input
          className="campo"
          style={{ maxWidth: 420 }}
          name="q"
          placeholder="Indique o local de sua pesquisa"
          aria-label="Indique o local de sua pesquisa"
        />
        <button className="btn primaria" type="submit">
          Consultar
        </button>
      </form>
      <p style={{ marginTop: 24, fontSize: 14 }}>
        <Link href="/municipio/5103403">Ver uma ficha municipal →</Link>
      </p>
    </div>
  );
}
