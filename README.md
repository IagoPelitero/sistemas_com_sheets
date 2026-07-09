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
- Toda regra é validada **no servidor** (`assertCanManage_`, checagens em cada módulo).

## 6. Regras de comissão

Todas em `Settings` (chaves `comissao.*`) — **editáveis em Configurações, sem código**.

### Cartão de Crédito (FONE)
| % Retidos | Comissão |
|---|---|
| 73% | R$150 |
| 74% | R$180 |
| 75% | R$200 |

Bônus por Argumentação: 35–37% → +R$100 · 38–39% → +R$150 · ≥40% → +R$200.
Bônus Premium: 76% retidos + 42% argumentação → R$100 · 78% + 44% → R$200 (prevalece o maior). Tudo automático.

### Cartão de Crédito (DIGITAL)
- Retenção incentivo = **0,5 ponto** · Retenção por argumentação = **1,5 ponto**.
- Somente Cartão possui regra de pontos. O valor R$/ponto é a chave `comissao.cartaoDigital.valorPonto`.

### Comissões globais (Conta Digital, Retenção Massificados, Milhas→Cashback, Venda Massificados)
Já vêm **cadastradas automaticamente** com valores padrão e são editáveis depois.
> ⚠️ **Ajustar conforme o PDF oficial**: o PDF de regras não foi anexado ao projeto, então os valores unitários dessas quatro comissões são provisórios. Atualize-os em **Configurações** (chaves `comissao.global.*`) assim que tiver os valores oficiais.

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

- **Regras de comissão:** Configurações (ADMIN) → chaves `comissao.*`. Faixas do cartão fone são JSON (ex.: `[{"pct":73,"valor":150},...]`).
- **Metas:** Gestão da Equipe → 🎯 (individual ou da equipe), ou metas padrão em `meta.padrao.*`.
- **Produtos:** Configurações → Produtos (nome, comissão unitária, ativo).
- **Novos cargos:** adicione em `ROLES` e `PERMISSIONS` (`Config.gs`) — nada mais é necessário; menu e regras derivam de `PERMISSIONS`.
- **Equipes:** aba Cadastro (ADMIN).

## 11. Cache — como funciona e como usar

- `readAll_(aba)` → tenta o cache; se vazio, lê a planilha **uma vez** e grava em chunks (TTL 5 min).
- Toda escrita (`appendRow_`, `updateRowById_`, `deleteRowById_`) troca o *version token* da aba → a próxima leitura recarrega **somente aquela aba**.
- O cliente mantém cache por página+mês e o limpa após qualquer escrita → **atualização imediata** após cadastrar venda/retenção/usuário/meta.
- Para forçar limpeza geral: execute `cacheFlushAll_()` no editor.

## 12. Boas práticas adotadas

- Funções internas com sufixo `_` (não invocáveis pelo cliente); único endpoint público `api()`.
- `LockService` em toda escrita (concorrência segura).
- Validação de entrada no servidor (CPF, produto/resultado, cargos, escopos).
- CPF mascarado na exibição e nos relatórios (LGPD).
- Auditoria de todas as operações relevantes (aba `Audit`).
- Zero duplicação: camada de dados única em `Utils.gs`.

## 13. Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| "Não foi possível identificar sua conta Google" | Web App publicado como "Executar como: eu" | Republicar como *Usuário que acessa o app* |
| "Seu e-mail não está cadastrado" | Usuário não existe na aba Users | ADMIN/Supervisor cadastra em Gestão/Cadastro |
| Dados desatualizados após edição manual no Sheets | Cache ainda válido (até 5 min) | Aguarde o TTL ou rode `cacheFlushAll_()` |
| Erro de lock/timeout em pico | Muitas escritas simultâneas | O lock espera até 20s; se persistir, reduza escritas em lote |
| Gráficos não aparecem | CDN do Chart.js bloqueada na rede | Liberar `cdnjs.cloudflare.com` |
| Comissão global "errada" | Valores provisórios do seed | Ajustar chaves `comissao.global.*` conforme o PDF oficial |

## 14. Roadmap

- [ ] Importar valores oficiais do PDF de comissões (chaves `comissao.global.*`).
- [ ] Exportação de relatórios em PDF/XLSX além de CSV.
- [ ] Notificações (e-mail) de meta batida e fechamento mensal.
- [ ] Histórico/gráfico comparativo entre meses.
- [ ] Edição/estorno de lançamentos com trilha de aprovação.
- [ ] Paginação server-side para bases com dezenas de milhares de linhas.

---

Licença MIT · Contribuições: ver `CONTRIBUTING.md` · Histórico: `CHANGELOG.md`
