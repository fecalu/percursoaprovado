import LegalPageLayout from '../components/LegalPageLayout'

const sections = [
  {
    title: '1. Sobre a plataforma',
    paragraphs: [
      'O Percurso Aprovado é uma plataforma digital de apoio ao estudo para prova prática de direção, com conteúdos organizados por local de exame, módulos, percursos, vídeos e materiais complementares.',
      'Ao criar uma conta ou utilizar a plataforma, você concorda com estas condições de uso.',
    ],
  },
  {
    title: '2. Cadastro e acesso',
    paragraphs: [
      'Para acessar áreas protegidas, compras e conteúdos, o usuário deve fornecer informações verdadeiras, atualizadas e de sua titularidade.',
      'O acesso é pessoal e não deve ser compartilhado com terceiros. O usuário é responsável por manter sua senha e seus dados de autenticação em segurança.',
    ],
  },
  {
    title: '3. Compras e liberação de acesso',
    paragraphs: [
      'Os planos vendidos na plataforma correspondem a acessos por período determinado, de acordo com a oferta exibida no momento da compra.',
      'A liberação do acesso ocorre após a confirmação do pagamento, conforme retorno do provedor de pagamento utilizado no checkout.',
    ],
  },
  {
    title: '4. Uso permitido',
    paragraphs: [
      'O usuário pode utilizar os conteúdos exclusivamente para estudo próprio, dentro das funcionalidades disponibilizadas pela plataforma.',
      'Não é permitido copiar, redistribuir, gravar, vender, sublicenciar ou republicar vídeos, áudios, percursos, textos ou qualquer outro material disponibilizado no sistema sem autorização expressa.',
    ],
  },
  {
    title: '5. Suspensão ou encerramento',
    paragraphs: [
      'A plataforma pode suspender ou encerrar contas em casos de uso indevido, fraude, tentativa de burlar o sistema, compartilhamento indevido de acesso ou violação destes termos.',
      'Também poderá haver indisponibilidade temporária por manutenção, evolução técnica ou fatores externos.',
    ],
  },
  {
    title: '6. Responsabilidades e limites',
    paragraphs: [
      'O Percurso Aprovado oferece apoio ao estudo, mas não substitui aulas práticas, instrução profissional, regras do órgão examinador ou critérios oficiais da banca.',
      'A aprovação do aluno depende de diversos fatores, incluindo desempenho individual e avaliação do exame prático.',
    ],
  },
  {
    title: '7. Alterações',
    paragraphs: [
      'Estes termos podem ser atualizados para refletir mudanças na plataforma, nos fluxos de compra ou em exigências operacionais e legais.',
      'Quando houver alterações relevantes, a nova versão passará a valer a partir de sua publicação nesta página.',
    ],
  },
  {
    title: '8. Contato',
    paragraphs: [
      'Em caso de dúvidas sobre estes Termos de Uso, o usuário pode entrar em contato pelo e-mail suporte@percursoaprovado.com.br.',
    ],
  },
]

export default function TermosDeUso() {
  return (
    <LegalPageLayout
      title="Termos de Uso"
      intro="Estas regras explicam como a plataforma funciona, quais são as condições de acesso e como os conteúdos podem ser utilizados."
      updatedAt="1 de abril de 2026"
      sections={sections}
    />
  )
}
