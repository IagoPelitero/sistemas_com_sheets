# PortoBank Performance

**Gestão de Vendas, Retenção e Comissionamento para N1, N2 e N2 digital**

Sistema web completo construído com **Google Apps Script + HTML + CSS + JavaScript**, usando **Google Sheets como único banco de dados**. Toda regra de negócio vive no backend (Apps Script) — a planilha não contém nenhuma fórmula.

---

## Sumário

1. [Arquitetura](#arquitetura)
2. [Estrutura de pastas](#estrutura-de-pastas)
3. [Banco de dados (abas do Sheets)](#banco-de-dados)
4. [Perfis e permissões](#perfis-e-permissões)
5. [Motor de comissão](#motor-de-comissão)
6. [Metas, semáforo e projeção](#metas-semáforo-e-projeção)
7. [Segurança e auditoria](#segurança-e-auditoria)
8. [Performance](#performance)
9. [Visual e temas](#visual-e-temas)
10. [Instalação e deploy](#instalação-e-deploy)
11. [Como publicar este projeto no GitHub](#como-publicar-este-projeto-no-github)

---

## Arquitetura

```
┌────────────────────────────────────────────┐
│  Front-end (SPA)                           │
│  Index.html · Styles.html · JsApp · JsViews│
│  Google Charts · Material Icons · 4 temas  │
└───────────────┬────────────────────────────┘
                │ google.script.run (Promises)
┌───────────────▼────────────────────────────┐
│  Fachada da API — Code.js (api_*)          │
│  Envelope padrão { ok, dados | erro }      │
├────────────────────────────────────────────┤
│  Módulos de negócio                        │
│  Auth · Sales · Retention · Commission     │
│  Goals · Ranking · Dashboard · Users       │
│  Settings · Reports · Audit · Utils        │
├────────────────────────────────────────────┤
│  Camada de dados — Db.js                   │
│  CRUD genérico · cache · paginação · lock  │
└───────────────┬────────────────────────────┘
                │
        Google Sheets (banco)
```

Princípios:

- **Responsabilidade única por arquivo.** Cada módulo faz uma coisa.
- **Nenhuma fórmula na planilha.** Percentuais, somas, projeções e rankings são calculados pelo Apps Script.
- **Nenhuma regra fixa no código.** Percentuais, faixas, bônus e metas moram em tabelas editáveis pelas telas de Configurações.
- **O front só conhece a fachada `api_*`.** Módulos internos nunca são chamados diretamente pela interface.

## Estrutura de pastas

```
src/
├── appsscript.json          # manifesto do Apps Script
├── server/
│   ├── Code.js              # doGet + fachada da API (api_*)
│   ├── Config.js            # constantes, abas, matriz de permissões
│   ├── Setup.js             # cria o banco (abas + cabeçalhos)
│   ├── Db.js                # camada de dados (CRUD, cache, paginação)
│   ├── Auth.js              # login Google + escopos de visualização
│   ├── Audit.js             # auditoria campo a campo + logs
│   ├── Sales.js             # vendas
│   ├── Retention.js         # retenções
│   ├── Commission.js        # motores de comissão (Digital e Fone)
│   ├── Goals.js             # metas + semáforo + próxima faixa
│   ├── Ranking.js           # rankings (sem expor valores)
│   ├── Dashboard.js         # payload único do dashboard
│   ├── Users.js             # usuários, supervisores, equipes
│   ├── Settings.js          # CRUD de configurações + Reports (export)
│   └── Utils.js             # utilitários puros (CPF, datas, projeção)
└── client/
    ├── Index.html           # SPA com HTML semântico
    ├── Styles.html          # design system (4 temas por CSS vars)
    ├── JsApp.html           # núcleo: router, API client, tema, menu
    └── JsViews.html         # telas (dashboard, formulários, CRUDs)
```

## Banco de dados

Uma planilha Google criada automaticamente pelo `setupInicial()`. A linha 1 de cada aba é o schema. Principais abas:

| Aba | Papel |
|---|---|
| `Usuarios` | e-mail Google → perfil → permissões |
| `Supervisores`, `Equipes` | estrutura hierárquica |
| `Produtos` | catálogo de produtos |
| `Metas` | metas mensais por equipe/supervisor/atendente/canal/produto/tipo |
| `RegrasComissao` | **motor Digital**: métrica + faixaMin/Max + valor + unidade |
| `RegrasFone` | **motor Fone**: percentualMin/percentualMax + valor + tipo + produto + canal |
| `RegrasRetencao`, `Bonificacoes`, `Faixas`, `Campanhas` | demais parametrizações |
| `Vendas`, `Retencoes` | registros operacionais |
| `Comissoes` | snapshots consolidados por competência |
| `Auditoria`, `Logs` | trilha de alterações e ações |
| `Configuracoes` | parâmetros chave/valor (ex.: `SEMAFORO_AMARELO`) |

## Perfis e permissões

Login **exclusivamente pela conta Google** (`Session.getActiveUser()`), sem senha. O e-mail é procurado na aba `Usuarios`; o perfil define as permissões via matriz `CONFIG.PERMISSOES`.

| Perfil | Registra | Escopo de visualização |
|---|---|---|
| **Administrador** | tudo | tudo (usuários, regras, metas, qualquer comissão, exportação) |
| **Supervisor** | — | apenas sua equipe (vendas, retenções, %, comissão dos liderados, ranking, metas); edita só registros da equipe |
| **Atendente Vendas Digital** | Venda Cartão, Retenção Conta | apenas os próprios dados |
| **Atendente Vendas + Retenção Digital** | Venda Cartão, Retenção Cartão, Retenção Conta | apenas os próprios dados |
| **Atendente Retenção + Vendas Fone** | Retenção Cartão, Retenção Conta, Venda Cartão | apenas os próprios dados — **usa o motor Fone** |

Regras de ouro aplicadas no servidor (não só na tela):

- Agente **nunca** vê comissão, salário, valor ou premiação de colegas — o ranking é sanitizado antes de sair do servidor.
- Agente pode ver quantidade total e percentual da equipe, e o ranking.
- Supervisor não enxerga equipes de outros supervisores.

## Motor de comissão

Dois motores independentes, **100% dirigidos por tabela**. Não existe um único percentual, valor ou meta hardcoded.

### Motor Digital (`RegrasComissao`)

Cada linha é uma regra: `metrica` (ex.: `VENDAS_CARTAO_DE_CREDITO`, `RETENCOES_TIPO_CASHBACK`, `PERCENTUAL_RETENCAO`), `faixaMin`/`faixaMax`, `valor` e `unidade`:

- `FIXO` — soma o valor uma vez quando a métrica cai na faixa;
- `POR_ITEM` — valor × quantidade da métrica;
- `PERCENTUAL` — percentual sobre a métrica.

Vendas coletivas, argumentação, cashback, incentivo financeiro, conta digital, upgrade, CPCP, massificados e bônus do programa de remuneração variável são modelados como linhas dessa tabela (e de `Bonificacoes`), conforme o documento do programa.

### Motor Fone (`RegrasFone`)

Estrutura dinâmica preparada para faixas percentuais que serão cadastradas depois (73%, 74%, 75%, 76%…):

| percentualMin | percentualMax | valor | unidade | tipo | produto | canal |
|---|---|---|---|---|---|---|
| 73 | 74.99 | … | FIXO ou POR_ITEM | … | Conta/Cartão/* | Fone |

O motor lê o `% de retenção` do atendente na competência e aplica a(s) faixa(s) correspondente(s).

**Mudou uma meta ou percentual?** Edite a linha na tela de Configurações. O código não muda.

## Metas, semáforo e projeção

A cada venda/retenção registrada, o dashboard recalcula (no servidor):

- **% de retenção atual** — retidas ÷ tratativas;
- **quanto falta para a próxima faixa** — menor `percentualMin` acima do % atual em `RegrasFone`;
- **comissão acumulada** — motores + bonificações;
- **projeção de fechamento** — acumulado ÷ dias corridos × dias do mês;
- **semáforo** — verde (≥ 100% da meta), amarelo (≥ limiar configurável `SEMAFORO_AMARELO`, padrão 80) e vermelho (abaixo).

## Segurança e auditoria

- Toda escrita gera linhas em `Auditoria` com: usuário, data, hora, tabela, registro, **campo alterado, valor anterior, novo valor** e campo de IP (preenchível quando disponível — o Apps Script não expõe o IP do cliente nativamente).
- Ações relevantes (exportações, consolidações) vão para `Logs`.
- Autorização é verificada **no servidor** em todas as funções (`Auth.exigir`, `Auth.exigirPerfil`, `Auth.filtroEscopo`) — esconder botão no front não é segurança.

## Performance

Pensado para ~50 usuários simultâneos e 100 mil+ registros:

- **Cache** de leitura por aba (`CacheService`, TTL 120 s) — invalidação automática após escrita;
- **Paginação** em todas as listagens (`Db.query`);
- **Escrita em lote** (`setValues`) e IDs sequenciais com `LockService` (evita corrida);
- **Dashboard em uma única chamada** (menos round-trips);
- **Índices em memória** por coluna (`Db.indexBy`) para buscas O(1);
- **Lazy loading** de telas (cada rota busca só o que exibe) e busca com debounce;
- Formulários de registro mantêm o foco e a data preenchidos: o atendente registra e já está pronto para o próximo cliente.

> Dica de escala: quando `Vendas`/`Retencoes` passarem de ~100 mil linhas, arquive competências fechadas em planilhas-histórico e mantenha a consolidação em `Comissoes`.

## Visual e temas

- Interface inspirada na Porto Bank: navy `#001E64` + azul `#00A1FC`, cards com cantos generosos, sombras suaves, animações discretas (`rise`, `pulse`), ícones **Material Design**, **menu lateral recolhível**, gráficos **Google Charts** (linha, pizza, colunas, gauge e heatmap).
- **4 temas trocáveis em um clique** (persistidos em `localStorage`): **PortoBank** (azul), **Rosa**, **Brasil** e **Dark**.
- **Responsivo** (sidebar vira drawer no mobile) e **semântico/acessível**: `nav/main/header/section/article`, `aria-label`, `role`, foco visível, `aria-live` para feedback e `prefers-reduced-motion` respeitado.

## Instalação e deploy

### Opção A — pelo editor do Apps Script

1. Acesse [script.google.com](https://script.google.com) → **Novo projeto**.
2. Crie os arquivos com os mesmos nomes de `src/server` (podem ficar na raiz do projeto) e os HTML de `src/client` como **Arquivo → HTML** com os nomes `client/Index`, `client/Styles`, `client/JsApp`, `client/JsViews` (o Apps Script aceita `/` no nome).
3. Cole o conteúdo de `appsscript.json` em **Configurações do projeto → Mostrar manifesto**.
4. No editor, execute **uma vez** a função `setupInicial()` (arquivo `Code.js`) e autorize os escopos. Isso cria a planilha-banco e cadastra você como **ADMIN**.
5. **Implantar → Nova implantação → App da Web**:
   - Executar como: **Usuário que acessa** (recomendado para identificar cada atendente) — nesse caso, compartilhe a planilha-banco com os usuários — ou **Eu** se preferir centralizar.
   - Acesso: **Qualquer pessoa no domínio** (ajuste conforme sua organização).
6. Abra a URL do app. Cadastre os demais usuários em **Cadastros** e as regras/faixas em **Configurações**.

### Opção B — com clasp (recomendada para versionar no GitHub)

```bash
npm install -g @google/clasp
clasp login
cd src
clasp create --type webapp --title "PortoBank Performance" --rootDir .
clasp push
clasp deploy
```

O `.clasp.json` gerado guarda o `scriptId`; adicione-o ao `.gitignore` se não quiser versioná-lo.

## Como publicar este projeto no GitHub

O repositório de destino é `https://github.com/IagoPelitero/sistemas_com_sheets`. Nos passos abaixo, quem envia é você, com a sua conta (nenhuma autorização extra é necessária, pois o repo é seu):

```bash
# 1. Clone o repositório
git clone https://github.com/IagoPelitero/sistemas_com_sheets.git
cd sistemas_com_sheets

# 2. Copie a pasta do projeto para dentro dele
#    (descompacte o zip entregue e mova a pasta)
cp -r /caminho/para/portobank-performance ./portobank-performance

# 3. Commit e push
git add portobank-performance
git commit -m "feat: PortoBank Performance (Apps Script + Sheets)"
git push origin main
```

Se o Git pedir credenciais no push, use um **Personal Access Token** do GitHub (Settings → Developer settings → Personal access tokens) no lugar da senha.

Para manter o Apps Script e o GitHub sincronizados no dia a dia, use `clasp pull` / `clasp push` dentro de `portobank-performance/src` e versione normalmente com git.

---

## Licença e observações

- Projeto entregue com todas as tabelas de regras **vazias por design**: cadastre as faixas (73%, 75%, 78%, 82%…), valores e metas pelas telas de Configurações, conforme o programa de remuneração variável vigente.
- O documento do programa de remuneração citado no levantamento não acompanhou este pacote; quando disponível, basta traduzi-lo em linhas de `RegrasComissao`/`Bonificacoes` — sem tocar no código.
