import LegalPageLayout from '../components/LegalPageLayout'

const sections = [
  {
    title: '1. Dados coletados',
    paragraphs: [
      'Podemos coletar dados informados pelo próprio usuário no cadastro, como nome, e-mail e informações de acesso, além de dados relacionados a compras, uso da plataforma e progresso dentro dos conteúdos.',
      'Quando o acesso é feito com Google, também podemos receber dados autorizados pela conta, como nome, e-mail, identificador da conta e imagem de perfil.',
    ],
  },
  {
    title: '2. Finalidade do uso dos dados',
    paragraphs: [
      'Os dados são utilizados para criar e manter a conta do usuário, liberar acessos comprados, exibir o conteúdo contratado, prestar suporte, prevenir fraude e melhorar a experiência de uso da plataforma.',
      'Também podem ser usados para comunicações operacionais relacionadas a acesso, pagamentos, segurança da conta e atendimento.',
    ],
  },
  {
    title: '3. Pagamentos e terceiros',
    paragraphs: [
      'Pagamentos podem ser processados por provedores terceirizados integrados ao checkout. Nesses casos, dados necessários para processar a compra podem ser compartilhados com o provedor correspondente.',
      'Serviços de autenticação, hospedagem, armazenamento e analytics também podem tratar dados estritamente necessários ao funcionamento do sistema.',
    ],
  },
  {
    title: '4. Armazenamento e segurança',
    paragraphs: [
      'Adotamos medidas técnicas e operacionais razoáveis para proteger os dados contra acessos não autorizados, perda, alteração ou divulgação indevida.',
      'Mesmo assim, nenhum ambiente digital é totalmente imune a riscos, e por isso recomendamos que o usuário mantenha suas credenciais em sigilo.',
    ],
  },
  {
    title: '5. Direitos do usuário',
    paragraphs: [
      'O usuário pode solicitar informações sobre seus dados, correção de dados incompletos ou desatualizados e esclarecimentos sobre o tratamento realizado pela plataforma.',
      'Solicitações relacionadas à privacidade podem ser encaminhadas para suporte@percursoaprovado.com.br.',
    ],
  },
  {
    title: '6. Retenção',
    paragraphs: [
      'Os dados podem ser mantidos pelo período necessário para execução do serviço, cumprimento de obrigações legais, defesa em processos e prevenção a fraudes.',
    ],
  },
  {
    title: '7. Atualizações desta política',
    paragraphs: [
      'Esta Política de Privacidade pode ser atualizada periodicamente para refletir mudanças na plataforma, nos processos internos ou em exigências legais aplicáveis.',
      'A versão mais recente será sempre publicada nesta página.',
    ],
  },
]

export default function PoliticaPrivacidade() {
  return (
    <LegalPageLayout
      title="Política de Privacidade"
      intro="Aqui explicamos quais dados podem ser tratados pela plataforma, para que eles são usados e como o usuário pode buscar suporte sobre privacidade."
      updatedAt="1 de abril de 2026"
      sections={sections}
    />
  )
}
