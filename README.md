# Sistemas de Gestão de Vendas e Retenção (Google Planilhas)

Este repositório reúne sistemas prontos para controlar **vendas** e **retenção de clientes** de uma equipe, direto pelo navegador, usando o **Google Planilhas** como "banco de dados". Não é preciso contratar servidor, hospedagem ou instalar nada: tudo roda dentro da conta Google da empresa, de graça, com o Google Apps Script.

Este documento foi escrito em linguagem simples, para qualquer pessoa entender o que o sistema faz, mesmo sem experiência técnica.

---

## 1. Para que serve

No dia a dia de uma equipe de vendas/atendimento, é comum controlar tudo em planilhas soltas, cadernos ou grupos de mensagens — o que gera erros, retrabalho e falta de visão do time. Este projeto resolve isso oferecendo:

- Uma **tela única** (como um site) onde cada pessoa registra vendas, retenções e acompanha seus números.
- **Cálculo automático de comissão**, sem depender de planilha manual.
- **Metas** por pessoa ou por equipe, com acompanhamento do progresso.
- **Ranking** dos melhores desempenhos do mês.
- **Relatórios** prontos para baixar (CSV), sem precisar mexer na planilha.
- **Controle de acesso**: cada pessoa só vê o que pode ver (atendente vê o próprio desempenho; supervisor vê a própria equipe; administrador vê tudo).
- **Histórico de tudo** (quem fez o quê e quando), para consulta e auditoria.

## 2. O que tem neste repositório

O repositório contém mais de um sistema, em pastas separadas. Você pode usar apenas um deles ou todos, dependendo da necessidade:

| Pasta | O que faz |
|---|---|
| [sistema_vendas_sheets/](sistema_vendas_sheets) | Sistema focado em **registro de vendas**, comissões, metas e relatórios. |
| [sistema_retencao_sheets/](sistema_retencao_sheets) | Sistema focado em **registro de retenção de clientes** (evitar cancelamentos), com dashboards e ranking por equipe. |
| *(pasta adicional)* | Versão mais recente e completa, que junta **vendas + retenção + comissões + metas + relatórios** em um único sistema, com temas visuais e mais opções de configuração. |

Cada pasta é independente e pode ser publicada separadamente como o seu próprio "site" (aplicativo web) dentro do Google.

## 3. Como o sistema funciona, de forma simples

1. A empresa cria uma Planilha Google normal — ela vai guardar todos os dados (vendas, retenções, usuários, metas etc.), como se fossem "tabelas" de um banco de dados.
2. O código do sistema é colado dentro dessa planilha (usando o recurso gratuito **Apps Script**, do próprio Google).
3. O Google gera um **link de acesso** (parecido com um site) que pode ser aberto por qualquer pessoa autorizada, direto do navegador, sem instalar nada.
4. A pessoa faz login com a própria conta Google da empresa — não existe usuário e senha separados para lembrar.
5. Tudo o que é digitado na tela é salvo automaticamente na planilha, com validações para evitar erro de digitação e duplicidade.

## 4. Perfis de acesso (quem pode ver o quê)

| Perfil | O que consegue fazer |
|---|---|
| **Administrador** | Acesso completo: cadastra pessoas, equipes, metas, produtos e comissões; vê tudo; gera qualquer relatório. |
| **Supervisor** | Vê e gerencia **apenas a própria equipe**: cadastra vendas/retenções do time, ajusta metas do time, acompanha ranking e retira relatórios da equipe. |
| **Atendente** | Registra as **próprias** vendas/retenções e acompanha o próprio desempenho e ranking (sem ver dados de outras pessoas). |

Regra importante: um supervisor nunca enxerga a equipe de outro supervisor, e um atendente nunca vê os números individuais dos colegas — apenas a própria posição no ranking.

## 5. Comissões e metas

- As **regras de comissão** ficam guardadas dentro do próprio sistema e podem ser alteradas pelo administrador a qualquer momento, sem precisar mexer em código.
- O sistema calcula a comissão de cada pessoa automaticamente, com base nas vendas/retenções lançadas no mês.
- As **metas** podem ser definidas por pessoa ou por equipe, e o painel mostra o progresso em tempo real (quanto falta para bater a meta).

## 6. Primeiros passos (visão geral, sem termos técnicos)

1. Crie uma Planilha Google nova (ela será o "banco de dados" do sistema).
2. Abra o menu **Extensões → Apps Script** dentro dessa planilha.
3. Copie os arquivos da pasta do sistema escolhido para dentro do editor que abrir.
4. Clique em **Implantar → Novo app da web** e siga as opções sugeridas na tela.
5. Acesse o link gerado: a primeira pessoa a entrar vira automaticamente **Administrador**.

Depois disso, o administrador pode cadastrar o restante da equipe direto pelo sistema, sem precisar repetir os passos técnicos.

## 7. Segurança e privacidade

- O acesso é sempre pela conta Google da própria empresa — ninguém de fora consegue entrar sem ser cadastrado.
- Dados sensíveis (como CPF) aparecem parcialmente ocultos nas telas e relatórios.
- Todas as ações importantes (cadastros, edições, exclusões) ficam registradas em um histórico, para consulta futura.

## 8. Dúvidas frequentes

- **Preciso pagar algo para usar?** Não. O sistema roda com ferramentas gratuitas do Google (Planilhas + Apps Script).
- **Preciso instalar algum programa?** Não. Tudo funciona pelo navegador.
- **Posso mudar as regras de comissão depois?** Sim, direto pela tela de configurações, sem precisar de suporte técnico.
- **Os dados ficam salvos onde?** Na própria Planilha Google criada pela empresa — ela continua sendo dona de todos os dados.

---

Licença: MIT (uso livre, veja o arquivo de licença de cada pasta).
