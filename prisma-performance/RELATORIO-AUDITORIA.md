# Relatório de Auditoria — PortoBank Performance v1.4.0

Data: 09/07/2026 · Escopo: manutenção corretiva (sem refatoração, sem mudança de arquitetura, telas preservadas)

---

## 1. Bugs encontrados e corrigidos

| # | Bug | Causa raiz | Correção | Arquivos |
|---|---|---|---|---|
| 1 | Comissão do DIGITAL contabilizava só o Cartão | Composição zerava Conta/Cashback para o perfil digital (valores unitários padrão R$0) | Todos os perfis somam Cartão + Conta + Cashback + Vendas + Massificados; muda apenas a regra do Cartão por perfil | Commission.gs |
| 2 | Teto aplicado fora do Cartão | Cap antigo misturava cashback no núcleo | Teto de R$530 EXCLUSIVO da comissão de Cartão do digital; demais modalidades sem limite | Commission.gs |
| 3 | Registros gravados com o dia anterior | `new Date('yyyy-MM-dd')` = meia-noite UTC = 21h do dia anterior em São Paulo | `toDateKey_` usa a string do formulário como está (sem conversão UTC); `toDateBR_` deriva dela | Utils.gs |
| 4 | Percentuais "fixos" (ex.: 75%) nos cards | Leitura/escrita mapeada pela constante HEADERS do código: planilha com ordem/colunas diferentes desalinhava `resultado`/metas (e o valor 75 exibido era a meta padrão) | Camada de dados lê/escreve pelos cabeçalhos REAIS da planilha (`headersOf_`); reconcilia colunas novas ao final sem tocar nas existentes | Utils.gs |
| 5 | Risco de sobrescrita no Sheets | Mesmo item 4: updates por posição fixa podiam gravar em colunas erradas | Idem — mapeamento por cabeçalho real; nada é renomeado, movido ou apagado | Utils.gs |
| 6 | Ranking incluía ADMIN e supervisores | Filtro `|| isAdmin_(me)` incluía todos quando o visualizador era ADMIN | Filtro estrito por ATTENDANT_ROLES — só atendentes, para qualquer visualizador | Ranking.gs |
| 7 | % de comissão errada | Consequência dos itens 3+4 (registros no mês errado e meta lida da coluna errada distorciam o atingimento → faixa errada) | Resolvido pelas correções acima; faixa de vendas usa atingimento individual (vendas ÷ meta individual) | Utils.gs, Commission.gs |
| 8 | Registro em duplicidade no cálculo | Dashboard do ADMIN agregava escopo geral; formulário aceitava duplo envio | Dashboard 100% individual para todos os perfis; trava `inflight` no envio (bloqueia duplo clique/Enter) | Dashboard.gs, App.html |

## 2. Melhorias realizadas

- **Nomenclatura**: Cartão de Crédito usa `Retido por Incentivo` (inputs, tabelas, dashboards, relatórios). `Retido por Argumentação` e a retenção geral da Conta Digital (`Retido`) preservados.
- **Migração automática**: registros legados de Cartão `Retido` → `Retido por Incentivo`, executada uma única vez sob lock, auditada na aba Audit, com verificação barata por sessão (CacheService 6h + ScriptProperties). Conta Digital intocada.
- **Tabela diária do Cartão**: acrescentadas as colunas Atendidos, Retidos, Por Incentivo e Por Argumentação — nada foi removido.
- **KPI do Cartão**: subtexto com contagens (X inc · Y arg) complementando as %s.
- **Sincronização por design**: valores derivados (comissões, %s, ranking) nunca são persistidos — recalculados a cada leitura; mudanças de regra em Configurações aplicam-se retroativamente e na hora.
- **Compatibilidade retroativa**: pontos do cartão digital aceitam a nomenclatura legada até a migração rodar; metas antigas (campo único) caem nos campos por produto.

## 3. Verificações de auditoria (sem problemas encontrados)

- **Cache**: toda escrita invalida somente a aba alterada; leituras via CacheService com chunking; endpoint `version` do auto-refresh não toca o Sheets; nenhuma consulta desnecessária identificada (leituras em massa passam todas por `readAll_`).
- **Permissões**: `visibleUsers_` restringe supervisor/atendente à própria equipe; ADMIN irrestrito; ações de escrita validam escopo no servidor (`assertCanManage_`, checagens por módulo); Configurações/Cadastro/auditoria exclusivas do ADMIN.
- **Dashboards**: escopo individual em todos os perfis; %s de Cartão e Conta calculadas separadamente e nunca somadas; tabelas diárias por produto.
- **Órfãos**: removida a descrição da chave extinta `comissao.vendas.atingimentoColetivo`; sem referências a `metaComissao`/`comissao.digital.*` no código ativo.
- **Sintaxe**: todos os `.gs` e o JS da SPA validados; simulações numéricas dos cálculos bateram com as regras (composição digital 65+350+130+21+6=572 ✓; teto 600→530 com Conta intacta ✓; legado `Retido` = R$0,50 ✓; faixas individuais 20%/60%/110% → colunas corretas ✓).

## 4. Arquivos e funções alterados

| Arquivo | Funções |
|---|---|
| Utils.gs | `headersOf_` (nova), `ensureSheet_`, `readAll_`, `appendRow_`, `updateRowById_`, `deleteRowById_`, `toDateKey_`, `toDateBR_` |
| Commission.gs | `commissionForUser_` (composição + teto só cartão), `commissionCartaoDigital_` (nomenclatura) |
| Config.gs | `RETENTION_PRODUCTS` (cartão), `DEFAULT_SETTINGS` (remoção de chaves extintas), versão |
| Retention.gs | `retentionStats_` (contador de incentivos exposto) |
| Ranking.gs | `rankingBuild_` (filtro estrito de atendentes; contagem com incentivo) |
| Dashboard.gs | `dailyRetentionTable_` (indicadores), `teamBuild_`/`dailySeries_` (contagem com incentivo) |
| Maintenance.gs | `migrationEnsure_`, `migrateRetidoIncentivo_` (novas) |
| API.gs | `api` (hook da migração) |
| Settings.gs | descrições (limpeza) |
| App.html | tabela diária do cartão, KPI do cartão |
| README.md / CHANGELOG.md | documentação v1.4.0 |

## 5. Possíveis melhorias futuras

- Paginação server-side para bases com dezenas de milhares de linhas por aba.
- Exportação de relatórios em XLSX/PDF além de CSV.
- Notificações (e-mail) de meta batida e fechamento mensal.
- Painel de comparação entre meses e metas coletivas por produto.
- Edição/estorno de lançamentos com trilha de aprovação.
- Volume mínimo para prêmios por faixa do fone (`comissao.faixas.minimoCasos`) — já disponível, desativado por padrão; recomendável definir para evitar 1 caso = 100% = prêmio máximo.

---

## 6. Validação por perfil de usuário

### ADMIN
- **Abas**: Dashboard, Nova Venda, Nova Retenção, Equipe, Ranking, Gestão da Equipe, Relatórios, Cadastro, Configurações (todas as 9).
- **Funcionalidades**: CRUD completo de usuários (qualquer equipe/cargo) e equipes; metas individuais e de equipe de qualquer pessoa; parâmetros de comissão; produtos; auditoria (status + arquivar); relatórios de tudo.
- **Restrições**: não pode excluir a si mesmo; não aparece no Ranking.
- **Indicadores**: Dashboard mostra apenas os PRÓPRIOS registros (se preencher, conta 1 vez, no dele); cards de vendas, %s de Cartão/Conta/Cashback separadas, comissão composta pelas 5 modalidades.
- **Cálculos**: comissão automática pelas mesmas regras dos atendentes (cargo ADMIN não é fone nem digital → cartão pelas faixas fone; sem teto de digital).
- **Permissões**: ✓ corretas — únicas telas exclusivas: Cadastro/Configurações; escopo irrestrito nas demais.

### Supervisor de vendas
- **Abas**: Dashboard, Nova Venda, Equipe, Ranking, Gestão da Equipe, Relatórios (sem Nova Retenção; sem Cadastro/Configurações).
- **Funcionalidades**: gerir SOMENTE a própria equipe — cadastrar/editar/excluir atendentes (nunca ADMIN/supervisores), metas individuais e da equipe (quantidade de vendas + % retenção Cartão e Conta), indicadores individuais, relatórios da equipe.
- **Restrições**: nunca vê outras equipes; não participa do Ranking; chip mostra "Equipe: <nome>".
- **Indicadores/Cálculos**: mesmos cálculos dos atendentes aplicados aos membros; dashboard pessoal individual.
- **Permissões**: ✓ corretas.

### Supervisor de retenção e vendas fone / Supervisor de vendas e retenção digital
- Igual ao Supervisor de vendas + aba **Nova Retenção**.
- Ranking: também excluídos. Escopo: apenas a própria equipe. ✓

### Atendente de vendas
- **Abas**: Dashboard, Nova Venda, Equipe, Ranking (sem retenção).
- **Indicadores**: vendas (quantidade vs meta individual), comissão automática, progresso da meta de vendas; sem blocos de retenção.
- **Cálculos**: vendas por faixa de atingimento INDIVIDUAL + indicadores de valor fixo (CPCP/Upgrades).
- **Restrições**: só os próprios dados; Equipe/Ranking anonimizados ("Você" destacado); supervisão exibida no chip.
- **Permissões**: ✓ corretas.

### Atendente de vendas e retenção fone
- **Abas**: + Nova Retenção (Cartão com Retido por Incentivo/Argumentação/Cancelado; Conta; Cashback; Massificados por produto).
- **Indicadores**: vendas + % Retenção Cartão (com contagens inc/arg), % Retenção Conta, % Cashback — cada uma contra a própria meta; tabelas diárias separadas (Cartão com os 4 indicadores; Conta); comissão composta pelas 5 modalidades.
- **Cálculos**: Cartão por faixas fone (73/74/75% + bônus argumentação + premium); Conta por faixas (30/50/75% + bônus); Cashback por faixas; Massificados por conversão; Vendas por faixa individual. Sem teto.
- **Permissões**: ✓ corretas.

### Atendente de retenção e vendas digital
- **Abas**: idênticas ao fone.
- **Cálculos**: Cartão por PONTOS (argumentação R$1,50 · incentivo R$0,50) com **teto automático de R$530 só no Cartão**; Conta, Cashback, Vendas e Massificados pelas mesmas regras acima, **sem limite**; total = soma das 5 modalidades.
- **Permissões**: ✓ corretas.

**Conclusão**: todas as regras de negócio validadas sem regressões — telas, arquitetura e funcionalidades preservadas.
