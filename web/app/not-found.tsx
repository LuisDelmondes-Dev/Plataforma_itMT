import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ maxWidth: 640, margin: '48px auto' }}>
      <p className="overline">Página não encontrada</p>
      <h1 className="headline-lg">Este endereço não existe no portal</h1>
      <p style={{ color: 'var(--on-surface-variant)', margin: '8px 0 20px' }}>
        O conteúdo pode ter sido movido, ou o endereço foi digitado com alguma diferença.
      </p>
      <Link className="btn primaria" href="/">
        Ir para o início
      </Link>
    </div>
  );
}
