# Contribuindo — Prisma Performance

## Estrutura de branches
- `main` — produção. Somente merges de `release/*` ou hotfixes.
- `develop` — integração contínua do próximo release.
- `feature/<nome>` — novas funcionalidades (a partir de `develop`).
- `fix/<nome>` — correções (a partir de `develop`).
- `hotfix/<nome>` — correções urgentes em produção (a partir de `main`).
- `release/x.y.z` — estabilização antes do deploy.

## Commits semânticos (Conventional Commits)
```
feat: nova funcionalidade
fix: correção de bug
docs: documentação
style: formatação (sem mudança de lógica)
refactor: refatoração
perf: melhoria de desempenho
test: testes
chore: build, deps, tarefas
```
Exemplos:
- `feat(commission): bônus premium cartão fone`
- `fix(cache): invalidar somente aba alterada`
- `docs(readme): passos de publicação`

## Fluxo de trabalho
1. Crie a branch a partir de `develop`.
2. Desenvolva com `clasp push` para um script de teste.
3. Abra PR para `develop` com descrição do que mudou.
4. Após revisão, merge com squash.
5. Releases: `develop` → `release/x.y.z` → `main` + tag `vX.Y.Z` + entrada no CHANGELOG.

## Padrões de código
- Funções internas terminam com `_` (não expostas ao cliente).
- Toda leitura em massa passa por `readAll_` (cache); toda escrita por `appendRow_`/`updateRowById_`/`deleteRowById_` (lock + invalidação).
- O cliente só chama `api(action, payload)`. Nunca exponha funções internas.
- Documente toda função com JSDoc em português.
- Sem duplicação: lógica compartilhada vai para `Utils.gs`.
