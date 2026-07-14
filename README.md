# Pelitero Labs

Soluções desenvolvidas em **Google Apps Script** para automação de processos, gestão operacional, indicadores e performance — 100% serverless, com o Google Sheets como banco de dados. Sem hospedagem, sem instalação: tudo roda dentro da conta Google da empresa.

Este repositório reúne a família **Prisma** e seus módulos precursores, evidenciando a evolução do produto: dos módulos legados monolíticos até um sistema modular com cache em camadas, permissões por cargo e comissionamento configurável.

---

## Projetos

### 🔷 [Prisma Performance](prisma-performance) — produto principal

Sistema completo de gestão de performance operacional:

- **Gestão de equipes** — 7 perfis de acesso (ADMIN, supervisores e atendentes), com escopo validado no servidor;
- **Dashboards e KPIs** — evolução diária, retenção por produto, comissão do mês, tudo calculado no servidor em uma chamada;
- **Metas** — por pessoa ou equipe, por mês, com valores vigentes no modal e progresso em tempo real;
- **Comissões** — motores Fone/Digital para Cartão de Crédito, vendas por faixa de atingimento, massificados por conversão, Conta Digital e Cashback — regras 100% editáveis pela interface;
- **Ranking** — mensal e semanal, anonimizado para atendentes;
- **Relatórios** — 7 tipos em CSV, com proteção anti-injeção de fórmulas;
- **Vendas e Retenção** unificadas, com autonomia de correção (exclusão dos próprios lançamentos recentes) e proteção anti-duplicidade em 4 camadas;
- **Importação dos módulos legados** com validação linha a linha e idempotência;
- **Auditoria** completa com rotação automática para planilhas de arquivo.

→ [Documentação completa](prisma-performance/README.md) · [Histórico de versões](prisma-performance/CHANGELOG.md)

### 📦 [Módulo Legado – Vendas](modulo-legado-vendas)

Sistema precursor de controle operacional de **vendas**: registro, metas, comissão por faixa e gestão de equipe. Mantido como registro da evolução; seu histórico é importável pelo Prisma. → [Documentação](modulo-legado-vendas/README.md)

### 📦 [Módulo Legado – Retenção](modulo-legado-retencao)

Sistema precursor de controle operacional de **retenção de clientes**: atendimentos, conversão por produto, comissões e ranking. Mantido como registro da evolução; seu histórico é importável pelo Prisma. → [Documentação](modulo-legado-retencao/README.md)

---

## Tecnologias

| Camada | Stack |
|---|---|
| Backend | Google Apps Script (V8), Google Sheets como banco de dados |
| Frontend | JavaScript, HTML5, CSS3 (SPA servida por HtmlService), Chart.js |
| Infraestrutura Google | CacheService (cache em chunks com version token), LockService (concorrência), PropertiesService (migrações e estado) |
| Qualidade | Migrações automáticas auditadas, trilha de auditoria, commits semânticos, CHANGELOG (SemVer) |

## Destaques de engenharia

- **Endpoint único** (`api(action, payload)`): toda chamada autentica, autoriza e responde em envelope `{ok, data|error}`.
- **Camada de dados única** com cache em três níveis (memo por execução → CacheService → Sheets) e invalidação O(1) por aba.
- **Nada derivado é gravado**: comissões, percentuais e rankings são recalculados a cada leitura — mudanças de regra valem retroativamente, sem migração de dados.
- **IDs crescentes** (timestamp + aleatório em hex) ordenáveis por texto, com colisão desprezível.
- **Idempotência de escrita** (reqId + bloqueio de conteúdo idêntico + LockService): nenhum registro entra duas vezes.
- **Segurança**: permissões no servidor, CPF mascarado (LGPD), validação de entrada e de JSON de configuração, CSV protegido contra fórmulas.

## Começando

Cada projeto tem instruções próprias de instalação e publicação no seu README. Em resumo: crie uma Planilha Google, cole os arquivos no editor do Apps Script (`Extensões → Apps Script`) e publique como App da Web — o primeiro acesso cria o administrador automaticamente (Prisma).

---

**Pelitero Labs** · Licença MIT — uso livre.
