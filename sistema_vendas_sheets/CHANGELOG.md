# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).
Versionamento: [SemVer](https://semver.org/lang/pt-BR/).

## [1.3.2] — 2026-07-09
### Alterado
- Teto de R$530 agora se aplica EXCLUSIVAMENTE à retenção de Cartão de Crédito do perfil DIGITAL (pontos de argumentação + incentivo). Cashback, Conta Digital, massificados e o perfil fone ficam fora do teto.

## [1.3.1] — 2026-07-09
### Corrigido
- Comissão do perfil DIGITAL: os prêmios por faixa de Conta Digital e Cashback estavam sendo pagos também aos atendentes digitais — com 1 conta retida (100% → R$350) + 1 cashback (R$130) + pontos, o total chegava a R$530 "sem explicação". Agora o DIGITAL ganha exclusivamente POR RETENÇÃO: pontos do cartão (arg R$1,50 / inc R$0,50) e, opcionalmente, valores unitários configuráveis para Conta e Cashback (padrão R$0). Prêmios por faixa ficam restritos ao perfil FONE.

### Adicionado
- Chaves `comissao.digital.contaPorRetencao` e `comissao.digital.cashbackPorConversao` (R$ por retenção/conversão no digital; padrão 0).
- Chave `comissao.faixas.minimoCasos`: volume mínimo de casos/mês para os prêmios por faixa do FONE (evita 1 caso = 100% = prêmio máximo; padrão 0 = desativado).

## [1.3.0] — 2026-07-09
### Alterado
- Faixa da comissão de vendas agora usa o atingimento INDIVIDUAL (vendas do usuário ÷ meta individual), definida por ADMIN ou supervisor; removida a chave de atingimento coletivo.
- Metas reformuladas: quantidade de vendas (sem valor em R$) + % de retenção individual POR PRODUTO (Cartão e Conta) — formulário, planilha Goals, relatório e telas.
- Dashboard 100% individual para todos os perfis (inclusive ADMIN): cada registro conta uma única vez, no dashboard de quem preencheu.
- Retenção dia a dia separada em duas tabelas (Cartão de Crédito e Conta Digital); %s de Cartão e Conta separadas também na aba Equipe e no Ranking (colunas próprias).
- Datas exibidas no padrão brasileiro (dd/mm/aaaa) e data padrão dos formulários no fuso local (corrige o dia errado de madrugada).
- Aba Cadastro lista todos os usuários (Nome, Equipe, E-mail, Cargo) com edição e exclusão permanente.
- Trava de envio nos formulários: impede duplo clique/Enter de registrar duas vezes.

## [1.2.0] — 2026-07-09
### Adicionado
- Auto-refresh do dashboard (~60s) com travas: endpoint `version` ultraleve (só CacheService), pausa em segundo plano/fora do dashboard/modal aberto, sem sobreposição de chamadas, circuit breaker com backoff (60s→8min) e jitter.
- Rotação da auditoria: registros com mais de 30 dias movidos para nova planilha de arquivo (sem perda), via gatilho de 30 dias (`auditRotationInstall()`) ou manualmente em Configurações → Auditoria.
- Painel de Auditoria para o ADMIN com contagem de registros e link do último arquivo.
- IDs de registro exclusivamente hexadecimais.

### Alterado
- Layout adaptado ao design de referência: sidebar navy recolhível, Material Icons, fontes Sora/Inter, ações rápidas e temas na topbar, toasts centralizados.
- Dashboard dos perfis com retenção compactado: vendas em quantidade + %s de retenção (cartão, conta, cashback) + bloco único de comissão com barra de progresso.
- Configurações com editores visuais (tabelas de faixas) — o usuário não vê mais JSON.
- Chip do usuário exibe nome, cargo e supervisão (atendentes/ADMIN) ou equipe (supervisores).

### Removido
- Card "Restante (R$)" do dashboard (meta é definida em quantidade).

## [1.1.0] — 2026-07-08
### Alterado
- Regras de comissão atualizadas conforme o PDF oficial "Programa de Remuneração Variável" (vigência 01/01/2026):
  - Vendas coletivas por faixa de atingimento (até 60 / 60–79,99 / 80–100 / >100) para os 8 produtos do mix, sem teto.
  - Cartão digital: Argumentação R$1,50 e Incentivo R$0,50 por retido (valor do ponto = R$1,00).
  - Cashback por faixa de conversão: 36%→R$50, 39%→R$70, 42%→R$100, 45%→R$130.
  - Teto de R$530 no bloco argumentação + incentivo + cashback.
  - Conta Digital: 30%→R$100, 50%→R$150, 75%→R$200, bônus 76%→+R$100 e 78%→+R$150.
  - Retenção de massificados por produto e faixa de conversão, separada em Argumentação e Incentivo.
- Produtos seed substituídos pelo mix oficial + indicadores CPCP (R$30) e Upgrades Platinum (R$2) / Black-Infinite (R$4).
- Retenção de massificados agora registra o produto específico (Perda e Roubo, Identidade Protegida, Vida, Martelinho, RE) e o tipo de retenção.

### Removido
- Chaves provisórias `comissao.global.*` (substituídas pelas regras oficiais).

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
