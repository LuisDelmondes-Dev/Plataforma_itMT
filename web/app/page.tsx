import Image from 'next/image';
import { REGIAO } from '@/lib/regiao';
import { PesquisaPrincipal } from '@/components/PesquisaPrincipal';

/**
 * Home minimalista: só a marca e o campo de pesquisa, centrados —
 * o portal se apresenta como um buscador territorial.
 */
export default function Home() {
  return (
    <div className="home-minima">
      <Image
        className="home-minima-logo"
        src="/itmt-horizontal.png"
        alt={`Plataforma itMT — inteligência territorial ${REGIAO.nome}`}
        width={720}
        height={272}
        priority
      />
      <PesquisaPrincipal />
    </div>
  );
}
