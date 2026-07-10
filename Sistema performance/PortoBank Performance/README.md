# PortoBank Performance

Sistema corporativo de gestão de performance para a operação PortoBank: vendas, retenções, comissão automática, ranking, dashboards, metas, usuários e relatórios — 100% sobre Google Apps Script + Google Sheets, sem servidor externo.

---

## 1. Visão geral

- **SPA** servida via `HtmlService` (interface SaaS moderna, responsiva, com animações suaves e 4 temas).
- **Google Sheets** como banco de dados, com **cache inteligente** (`CacheService`) — o sistema **não** lê a planilha inteira a cada clique.
- **Permissões por cargo** aplicadas no servidor (nunca só na interface).
- **Comissões calculadas automaticamente** a partir de regras editáveis em Configurações.
- Preparado para **centenas de usuários simultâneos**: `LockService` em toda escrita, leituras servidas do cache, uma única chamada de servidor por página.

## 2. Arquitetura

```
Cliente (SPA)                       Servidor (Apps Script)
┌────────────────────┐   api()    ┌──────────────────────────────┐
│ Index.html         │ ─────────► │ API.gs  (roteador único)     │
│ Styles.html        │            │  ├─ Auth.gs   (sessão/perms) │
│ App.html (JS)      │ ◄───────── │  ├─ Users.gs  Sales.gs       │
└────────────────────┘  JSON      │  ├─ Retention.gs Goals.gs    │
                                  │  ├─ Commission.gs Dashboard  │
                                  │  ├─ Ranking.gs Reports.gs    │
                                  │  ├─ Settings.gs              │
                                  │  └─ Cache.gs + Utils.gs (DB) │
                                  └───────────┬──────────────────┘
                                              │ readAll_/append/update/delete
                                       CacheService ⇄ Google Sheets
```

Princípios:
1. **Um único endpoint** — o cliente só chama `api(action, payload)`. Toda chamada autentica, autoriza e devolve `{ok, data|error}`.
2. **Camada de dados única** — `Utils.gs` concentra `readAll_` (leitura cacheada), `appendRow_`, `updateRowById_` e `deleteRowById_` (com `LockService` e invalidação de cache). Nenhum módulo toca `SpreadsheetApp` diretamente para CRUD.
3. **Cache por aba com version token** — cada escrita invalida somente o cache da aba alterada (O(1)); dados grandes são divididos em chunks de 90KB.
4. **Cálculo no servidor** — dashboards chegam prontos ao cliente em uma chamada; o cliente apenas renderiza.

## 3. Estrutura das planilhas (criadas automaticamente)

| Aba | Colunas |
|---|---|
| `Users` | id, nome, email, cargo, equipe, status, tema, criadoEm, atualizadoEm |
| `Sales` | id, data, cpf, produto, quantidade, obs, userId, equipe, criadoEm |
| `Retention` | id, data, cpf, produto, resultado, obs, userId, equipe, criadoEm |
| `Goals` | id, tipo (user/team), alvoId, metaVendas, metaComissao, metaRetencao, mes, atualizadoEm |
| `Settings` | chave, valor, descricao, atualizadoEm |
| `Products` | id, nome, categoria, comissaoUnitaria, ativo |
| `Teams` | id, nome, supervisorId, tipo, ativo |
| `Reports` | id, tipo, solicitante, parametros, status, criadoEm |
| `Audit` | id, quando, quem, acao, detalhe |

> Nunca reordene colunas manualmente — os cabeçalhos oficiais estão em `Config.gs` (`HEADERS`).

## 4. Fluxo dos usuários

### Primeiro login (bootstrap)
Se **nenhum usuário existir** na aba `Users`, o primeiro acesso:
1. cria automaticamente o usuário logado;
2. define como **ADMIN**;
3. registra **normalmente e visivelmente** na aba `Users`;
4. popula Settings/Products com os padrões (comissões já prontas).

### Logins seguintes
O e-mail da conta Google é comparado com a aba `Users`. Não cadastrado ou inativo → tela de acesso negado.

### Exclusão de usuário
Exclusão é **definitiva**: a linha é removida da planilha (`deleteRow`). Sem soft delete, sem lixo de dados.

## 5. Cargos e permissões

| Cargo | Escopo | Menu |
|---|---|---|
| ADMIN | tudo | todas as 9 abas |
| Supervisor de vendas | própria equipe | Dashboard, Nova Venda, Equipe, Ranking, Gestão, Relatórios |
| Supervisor de retenção e vendas fone | própria equipe | + Nova Retenção |
| Supervisor de vendas e retenção digital | própria equipe | + Nova Retenção |
| Atendente de vendas | próprios dados | Dashboard, Nova Venda, Equipe, Ranking |
| Atendente de vendas e retenção fone | próprios dados | + Nova Retenção |
| Atendente de retenção e vendas digital | próprios dados | + Nova Retenção |

Regras-chave:
- Supervisor **nunca** vê equipes de outros supervisores.
- Supervisor cadastra/edita/exclui membros e altera metas **apenas da própria equipe**; não pode criar ADMIN nem supervisores.
- Na aba **Equipe** e no **Ranking** de atendentes, colegas aparecem **sem nomes** (rótulos anônimos; a própria linha aparece como "Você").
- **Ranking: somente atendentes participam.** ADMIN e todos os perfis de supervisor são excluídos automaticamente, para qualquer visualizador. A ordenação usa vendas + %s de retenção (Cartão e Conta, separadas).
- Toda regra é validada **no servidor** (`assertCanManage_`, checagens em cada módulo).

## 6. Regras de comissão

Todas em `Settings` (chaves `comissao.*`) — **editáveis em Configurações, sem código**. Regras de retenção e vendas seguem o PDF oficial **"Programa de Remuneração Variável"** (vigência 01/01/2026).

### Vendas coletivas (PDF 6.3.1) — sem teto
R$/venda conforme a faixa de atingimento da meta coletiva do mês:

| Produto | Até 60% | 60–79,99% | 80–100% | >100% |
|---|---|---|---|---|
| Seguro Perda e Roubo | 2,00 | 2,50 | 3,00 | 4,00 |
| Adicional / Seguro Vida / Identidade Protegida / Seguro RE | 1,00 | 1,50 | 2,00 | 3,00 |
| Martelinho de Ouro / Guincho | 3,00 | 3,50 | 4,00 | 5,00 |
| Quitação fatura | 2,00 | 2,50 | 3,00 | 4,00 |

> A faixa vigente é escolhida pelo **atingimento individual** do usuário no mês: vendas realizadas ÷ meta individual de vendas (definida pelo ADMIN ou pelo supervisor em Gestão da Equipe).

Indicadores de valor fixo: **CPCP R$30** (pago só com proposta formalizada após contato + link), **Upgrade Platinum R$2**, **Upgrade Black/Infinite R$4** — cadastrados como produtos com valor unitário.

### Composição da comissão (TODOS os perfis)
A comissão total soma automaticamente **Cartão + Conta Digital + Cashback + Vendas + Retenção de Massificados** — no card do dashboard e em todos os relatórios. O que muda por perfil é apenas a **regra do Cartão**:

### Cartão de Crédito — DIGITAL (PDF 6.3.2)
- Retenção por **Argumentação** = 1,5 ponto = **R$1,50**/retida.
- Retenção por **Incentivo** = 0,5 ponto = **R$0,50**/retida.
- **TETO: a comissão do Cartão nunca ultrapassa R$530,00** (`comissao.retencao.teto`). O corte é automático e vale SÓ para o Cartão — Conta, Cashback, Vendas e Massificados não são limitados.

### Cartão de Crédito — FONE (especificação do sistema)
73% → R$150 · 74% → R$180 · 75% → R$200.
Bônus argumentação: 35–37% → +R$100 · 38–39% → +R$150 · ≥40% → +R$200.
Bônus premium: 76%/42% → R$100 · 78%/44% → R$200 (prevalece o maior).

### Conta Digital (PDF 6.6) — prêmio fixo
30% → R$100 · 50% → R$150 · 75% → R$200.
Bônus adicional: 76% → +R$100 · 78% → +R$150.

### Retenção de Massificados (PDF 6.5) — R$/retido por faixa de conversão
Por **Argumentação** (faixas 15/30/50/60%):

| Produto | 15% | 30% | 50% | 60% |
|---|---|---|---|---|
| Perda e Roubo / Identidade Protegida / Vida | 1,50 | 2,00 | 2,50 | 3,00 |
| Martelinho / RE | 1,00 | 1,50 | 2,00 | 2,50 |

Por **Incentivo** (faixas 60/65/70/75%):

| Produto | 60% | 65% | 70% | 75% |
|---|---|---|---|---|
| Perda e Roubo / Identidade Protegida / Vida | 1,00 | 1,25 | 1,50 | 2,00 |
| RE | 1,00 | 1,10 | 1,25 | 1,50 |
| Martelinho | 1,00 | 1,10 | 1,20 | 1,30 |

A conversão é calculada **por produto e por tipo** (retidos ÷ casos do produto no mês). Abaixo da primeira faixa, sem pagamento. O formulário Nova Retenção registra o massificado específico e o tipo (Argumentação/Incentivo).

## 7. Instalação

1. Crie uma nova Planilha Google (será o banco de dados).
2. `Extensões → Apps Script`.
3. Copie os arquivos de `src/` para o editor: todos os `.gs` como *scripts* e `Index.html`, `Styles.html`, `App.html` como *arquivos HTML* (mesmos nomes, sem extensão `.gs`/`.html` no editor).
4. Em `Configurações do projeto`, marque "Mostrar manifesto appsscript.json" e substitua pelo `src/appsscript.json`.
5. Salve.

**Com clasp (recomendado para versionamento):**
```bash
npm i -g @google/clasp
clasp login
cp .clasp.json.example .clasp.json   # cole o scriptId do seu projeto
clasp push
```

## 8. Publicação

1. `Implantar → Nova implantação → App da web`.
2. **Executar como:** *Usuário que acessa o app* (necessário para identificar o e-mail de cada pessoa).
3. **Quem pode acessar:** *Qualquer pessoa no domínio* (recomendado) ou *Qualquer pessoa com conta Google*.
4. Abra a URL gerada. O primeiro acesso cria o ADMIN automaticamente.

## 9. Atualização

- Editou código? `clasp push` (ou cole no editor) e depois `Implantar → Gerenciar implantações → ✏️ → Nova versão`. A URL não muda.
- Dados e configurações **não** exigem redeploy — tudo vem da planilha/cache.

## 10. Como alterar…

- **Regras de comissão:** Configurações (ADMIN) → chaves `comissao.*`. Faixas e tabelas são JSON (ex.: `[{"pct":73,"valor":150},...]`); a tabela de vendas coletivas fica em `comissao.vendas.tabela`.
- **Metas:** Gestão da Equipe → 🎯 (individual ou da equipe), ou metas padrão em `meta.padrao.*`.
- **Produtos:** Configurações → Produtos (nome, comissão unitária, ativo).
- **Novos cargos:** adicione em `ROLES` e `PERMISSIONS` (`Config.gs`) — nada mais é necessário; menu e regras derivam de `PERMISSIONS`.
- **Equipes:** aba Cadastro (ADMIN).

## 11. Auto-refresh e manutenção da auditoria

### Auto-refresh do dashboard
O dashboard se atualiza sozinho a cada ~60s, com travas para nunca pesar no sistema:
- O cliente consulta o endpoint `version`, que lê **apenas o CacheService** (não toca a planilha) e devolve um carimbo das versões dos dados. Só quando o carimbo muda é que os dados são rebuscados.
- Pausa automática com a aba em segundo plano, fora do Dashboard ou com modal aberto; ciclos nunca se sobrepõem.
- **Circuit breaker:** respostas lentas (>5s) ou erros dobram o intervalo (60s → 120s → … → 8min) até estabilizar; jitter aleatório evita que todos os clientes disparem juntos.

### Rotação da auditoria (a cada 30 dias, sem perda)
A aba `Audit` cresce continuamente; a rotação mantém a planilha principal leve **movendo** (nunca apagando) os registros com mais de 30 dias para uma **nova planilha de arquivo** ("PortoBank Performance — Audit AAAA-MM-DD"), criada no Drive de quem executa.
- **Automática:** execute **uma única vez** `auditRotationInstall()` no editor do Apps Script (como dono do projeto) para criar o gatilho de 30 dias.
- **Manual:** ADMIN → Configurações → card **Auditoria** → "Arquivar agora". O painel mostra quantos registros existem e o link do último arquivo gerado.
- A gravação no arquivo acontece **antes** da limpeza da principal — sem risco de perda.

## 12. Sincronização e recálculo automático

- **Nada derivado é gravado na planilha**: comissões, percentuais, rankings e indicadores são recalculados a cada leitura a partir dos registros brutos (Sales/Retention/Goals/Settings). Por isso, **qualquer mudança de regra em Configurações se aplica retroativamente e na hora** a todos os dados existentes — sem migração.
- **Percentuais 100% dinâmicos**: os cards de Cartão e Conta calculam retidos ÷ atendidos dos registros do Sheets; cada novo registro invalida o cache da aba e atualiza os indicadores imediatamente.
- **Migração automática de vocabulário**: quando a nomenclatura dos registros muda (ex.: Cartão `Retido` → `Retido por Incentivo`), o sistema roda uma migração única e auditada (`migrationEnsure_` em Maintenance.gs), verificada de forma barata a cada sessão via CacheService + ScriptProperties. Conta Digital não é alterada (lá `Retido` é retenção geral).
- **Cabeçalhos reconciliados**: o sistema lê/escreve pelas colunas REAIS da planilha (`headersOf_`); colunas novas de versões futuras são acrescentadas ao final sem tocar nas existentes — nada é sobrescrito.
- **Datas sem deslocamento**: `yyyy-MM-dd` do formulário é gravado exatamente como informado (nunca passa por conversão UTC que retrocederia um dia); exibição em `dd/MM/aaaa`.

## 13. Cache — como funciona e como usar

- `readAll_(aba)` → tenta o cache; se vazio, lê a planilha **uma vez** e grava em chunks (TTL 5 min).
- Toda escrita (`appendRow_`, `updateRowById_`, `deleteRowById_`) troca o *version token* da aba → a próxima leitura recarrega **somente aquela aba**.
- O cliente mantém cache por página+mês e o limpa após qualquer escrita → **atualização imediata** após cadastrar venda/retenção/usuário/meta.
- Para forçar limpeza geral: execute `cacheFlushAll_()` no editor.

## 14. Boas práticas adotadas

- Funções internas com sufixo `_` (não invocáveis pelo cliente); único endpoint público `api()`.
- `LockService` em toda escrita (concorrência segura).
- Validação de entrada no servidor (CPF, produto/resultado, cargos, escopos).
- CPF mascarado na exibição e nos relatórios (LGPD).
- Auditoria de todas as operações relevantes (aba `Audit`).
- Zero duplicação: camada de dados única em `Utils.gs`.

## 15. Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| "Não foi possível identificar sua conta Google" | Web App publicado como "Executar como: eu" | Republicar como *Usuário que acessa o app* |
| "Seu e-mail não está cadastrado" | Usuário não existe na aba Users | ADMIN/Supervisor cadastra em Gestão/Cadastro |
| Dados desatualizados após edição manual no Sheets | Cache ainda válido (até 5 min) | Aguarde o TTL ou rode `cacheFlushAll_()` |
| Erro de lock/timeout em pico | Muitas escritas simultâneas | O lock espera até 20s; se persistir, reduza escritas em lote |
| Gráficos não aparecem | CDN do Chart.js bloqueada na rede | Liberar `cdnjs.cloudflare.com` |
| Faixa de vendas desatualizada | Atingimento coletivo do mês não informado | Atualizar `comissao.vendas.atingimentoColetivo` em Configurações |

## 16. Roadmap

- [x] Valores oficiais do PDF de Remuneração Variável importados (v1.1.0).
- [ ] Exportação de relatórios em PDF/XLSX além de CSV.
- [ ] Notificações (e-mail) de meta batida e fechamento mensal.
- [ ] Histórico/gráfico comparativo entre meses.
- [ ] Edição/estorno de lançamentos com trilha de aprovação.
- [ ] Paginação server-side para bases com dezenas de milhares de linhas.

---

Licença MIT · Contribuições: ver `CONTRIBUTING.md` · Histórico: `CHANGELOG.md`
