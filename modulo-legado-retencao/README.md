# Módulo Legado – Retenção

> Desenvolvido por **Pelitero Labs** · Sucedido pelo [Prisma Performance](../prisma-performance)

Sistema precursor de **controle operacional de retenção de clientes** (evitar cancelamentos), construído sobre Google Apps Script + Google Sheets. Segunda geração da família de produtos deste repositório, mantido como registro da evolução do software.

## Objetivo

Registrar cada atendimento de retenção (Cartão de Crédito, Conta Digital, Troca de Pontos e Massificados), medir conversão por produto e calcular a comissão da operação automaticamente, direto do navegador.

## Funcionalidades

- **Registro de retenções** com produto, subproduto e resultado, com data corrigida por fuso (`salvarRetencao`).
- **Últimos 5 registros com exclusão segura** pelo próprio usuário (`getUltimosRegistros`, `excluirRegistro`) — recurso que inspirou a autonomia de correção do Prisma.
- **Dashboard pessoal e da equipe** com estatísticas por produto (`getDashboardData`, `processarEstatisticas`).
- **Cálculo central de comissões** (`calcularComissoes`): Cartão (argumentação/incentivo), Conta Digital e Cashback por faixa, e Massificados por conversão — tudo em uma única função documentada.
- **Visão do supervisor** filtrada por equipe (`getSupervisorData`) e **ranking** semanal/mensal (`getRankingData`).
- **Relatório CSV** por período e escopo (`gerarRelatorioCSV`), **arquivamento mensal** (`arquivarMes`) e **logs de auditoria** (`registrarLog`).
- **Cache** (CacheService) com invalidação após escrita e **LockService** em todas as gravações.

## Estrutura da planilha

| Aba | Conteúdo |
|---|---|
| `Dados` | Data, Email, Nome, Supervisor, Tipo, SubProduto, Resultado, Status |
| `Usuarios` | Email, Nome, Sobrenome, Cargo, Supervisor |
| `Logs` | Trilha de auditoria |

## Limitações (motivos da sucessão)

- Separado do sistema de vendas — sem visão unificada de performance e comissão total.
- Valores de comissão fixos no código (alterar regra exigia editar a função).
- Ranking ordenado por comissão total, sem os recortes por produto do Prisma.
- Sem metas individuais por mês, sem motor Fone/Digital, sem importação nem anti-duplicidade em camadas.

## Relação com o Prisma Performance

O [Prisma Performance](../prisma-performance) substitui este módulo com regras editáveis em Configurações, permissões por cargo e recálculo automático. O histórico deste módulo pode ser **importado pelo Prisma** em `Configurações → Importar sistemas antigos` (aba `Dados`), com tradução automática de vocabulário e proteção contra duplicidade.

## Instalação

1. Crie uma Planilha Google com as abas acima (o sistema usa a planilha ativa).
2. `Extensões → Apps Script`: cole `Code.gs` e `Index.html`.
3. `Implantar → App da web` (executar como "Usuário que acessa o app").

---

Pelitero Labs · Licença MIT
