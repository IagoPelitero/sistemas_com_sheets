# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).
Versionamento: [SemVer](https://semver.org/lang/pt-BR/).

## [1.0.0] — 2026-07-08
### Adicionado
- Primeiro login com bootstrap automático do ADMIN (visível na aba Users).
- CRUD completo de usuários com exclusão definitiva (deleteRow).
- Registro de vendas (massificados) e retenções (Cartão, Conta Digital, Cashback, Massificado).
- Cálculo automático de comissões: Cartão FONE (faixas + bônus argumentação + bônus premium), Cartão DIGITAL (pontos 0,5 / 1,5) e comissões globais editáveis.
- Dashboards por perfil (atendente vendas, vendas+retenção, supervisor, ADMIN).
- Aba Equipe anonimizada (sem nomes), gráficos pizza e tabelas.
- Ranking TOP 10 com ordenação automática.
- Relatórios exportáveis em CSV: Performance, Vendas, Retenção, Comissão, Equipe, Ranking, Metas.
- Metas por usuário e por equipe (mensal).
- Configurações completas via interface (ADMIN) — sem abrir o Sheets.
- 4 temas (PortoBank, Rosa, Brasil, Dark) com preferência persistida por usuário.
- Cache inteligente (CacheService com chunking + invalidação por aba) e LockService em toda escrita.
- Auditoria de operações (aba Audit).

### Pendente
- Ajustar valores das comissões globais conforme o PDF oficial (padrões provisórios em Configurações).
