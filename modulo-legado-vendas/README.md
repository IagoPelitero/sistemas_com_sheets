# Módulo Legado – Vendas

> Desenvolvido por **Pelitero Labs** · Sucedido pelo [Prisma Performance](../prisma-performance)

Sistema precursor de **controle operacional de vendas**, construído sobre Google Apps Script + Google Sheets. Foi a primeira geração da família de produtos deste repositório e permanece aqui como registro da evolução do software.

## Objetivo

Dar a uma equipe comercial uma tela única (Web App) para registrar vendas, acompanhar metas e calcular comissões automaticamente — sem servidor, sem instalação, usando a Planilha Google como banco de dados.

## Funcionalidades

- **Registro de vendas** com data, produto, protocolo e quantidade (`registerSale`).
- **Dashboard individual e da equipe**: total vendido, % da meta, projeção de fechamento e comissão estimada (`getTab1Data`).
- **Comissão por faixa de meta**: regras lidas da aba `produtos_comissao` (valor por faixa de atingimento ou valor fixo, incluindo regra CPCP) — `calcularComissoes`.
- **Gestão da equipe** para supervisor/ADM: vendas por membro, gráfico diário e meta da equipe (`getTeamData`, `updateMeta`).
- **Administração**: cadastro/exclusão de usuários, arquivamento de dados e logs de auditoria (`addUser`, `deleteUser`, `archiveData`, `getAuditLogs`).
- **Relatório da equipe** exportável (`exportarRelatorioEquipe`).
- **Cache** (CacheService) para dashboards e **LockService** em toda escrita.

## Estrutura da planilha

| Aba | Conteúdo |
|---|---|
| `vendas_ativas` | Data, Produto, Protocolo, Email, Equipe, Quantidade |
| `produtos_comissao` | Produto, tipo de regra, faixas de comissão, valor fixo |
| `equipes_e_usuarios` | Email, Nome, Equipe, Cargo |
| `metas_e_resumo` | Metas por equipe |
| `logs_auditoria` | Trilha de auditoria |

## Limitações (motivos da sucessão)

- Vendas e retenção viviam em **sistemas separados**, sem visão unificada de performance.
- Regras de comissão limitadas a faixas simples — sem os motores Fone/Digital, teto de retenção ou massificados por conversão.
- Código monolítico (um único `.gs`), sem camada de dados única nem cache por aba com invalidação O(1).
- Sem anti-duplicidade em camadas, sem importação, sem auditoria com rotação automática.

## Relação com o Prisma Performance

O [Prisma Performance](../prisma-performance) substitui este módulo com arquitetura modular, permissões por cargo validadas no servidor e comissionamento completo. O histórico deste módulo pode ser **importado pelo Prisma** em `Configurações → Importar sistemas antigos` (aba `vendas_ativas`), com validação linha a linha e proteção contra duplicidade.

## Instalação

1. Crie uma Planilha Google e anote o ID no topo do `code.gs` (`SPREADSHEET_ID`).
2. `Extensões → Apps Script`: cole `code.gs` e `Index.html`.
3. `Implantar → App da web` (executar como "Usuário que acessa o app").

---

Pelitero Labs · Licença MIT
