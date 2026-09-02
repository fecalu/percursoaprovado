# Checklist Antes de Publicar

Use este checklist antes de tornar o repositório público ou divulgar o projeto.

## Já Coberto no Repositório

- `.env`, bancos locais, backups, arquivos compactados e storage gerado estão protegidos pelo `.gitignore`.
- Fontes proprietárias removidas do app Figurinhas.
- O backend do Figurinhas usa fonte livre do sistema no Docker (`fonts-dejavu-core`).
- README principal revisado para não expor credenciais padrão.
- Não há workflows do GitHub Actions versionados neste repositório.

## Conferir Antes de Publicar

- Confirmar que imagens públicas não usam marcas, artes ou personagens protegidos.
- Confirmar que PDFs, figurinhas, uploads de usuários e bancos locais continuam fora do Git.
- Revisar se os documentos em `docs/` e `deploy/` podem ser públicos ou se devem ficar apenas como material interno.
- Evitar divulgar a plataforma como produto oficial, afiliado ou autorizado por marcas de terceiros.

## Fazer Fora do Git

- Trocar a senha da VPS.
- Trocar a senha do e-mail usado pelo sistema.
- Rotacionar chaves da OpenAI.
- Rotacionar tokens do Mercado Pago, se ainda forem usados.
- Conferir no GitHub se o repositório está privado antes do push final.
- Após o push, decidir conscientemente quando alterar a visibilidade para público.

## Sugestão Para Divulgação

Descreva o projeto como uma experiência técnica ou estudo de produto. Evite prometer disponibilidade, suporte comercial ou associação com marcas de álbuns, editoras, seleções, federações ou campeonatos.
