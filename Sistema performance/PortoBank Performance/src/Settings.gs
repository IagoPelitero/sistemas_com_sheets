/**
 * ============================================================
 * PortoBank Performance — Settings.gs
 * ------------------------------------------------------------
 * Configurações do sistema — SOMENTE ADMIN.
 * Tudo configurável via interface, sem abrir o Sheets:
 * metas padrão, produtos, comissões, equipes, parâmetros.
 * ============================================================
 */

/**
 * Popula Settings e Products com os padrões, caso não existam.
 * Chamado automaticamente no primeiro login (bootstrap).
 * As comissões já vêm PRONTAS — depois podem ser editadas.
 */
function ensureDefaultSettings_() {
  const existing = readAll_(SHEETS.SETTINGS).map(function (r) { return String(r.chave); });
  Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
    if (existing.indexOf(key) === -1) {
      appendRow_(SHEETS.SETTINGS, {
        chave: key, valor: DEFAULT_SETTINGS[key],
        descricao: settingDescription_(key), atualizadoEm: nowIso_()
      });
    }
  });

  if (readAll_(SHEETS.PRODUCTS).length === 0) {
    DEFAULT_PRODUCTS.forEach(function (p) {
      appendRow_(SHEETS.PRODUCTS, {
        id: uid_(), nome: p.nome, categoria: p.categoria,
        comissaoUnitaria: p.comissaoUnitaria !== undefined ? p.comissaoUnitaria : '', ativo: 'Sim'
      });
    });
  }
}

/** Descrição amigável de cada chave de configuração. */
function settingDescription_(key) {
  const map = {
    'comissao.cartaoFone.tiers': 'Faixas de comissão Cartão FONE (% retidos → R$)',
    'comissao.cartaoFone.bonusArg': 'Bônus por argumentação Cartão FONE',
    'comissao.cartaoFone.bonusPremium': 'Bônus premium Cartão FONE',
    'comissao.cartaoDigital.pontoIncentivo': 'Pontos por retenção incentivo (digital)',
    'comissao.cartaoDigital.pontoArgumentacao': 'Pontos por retenção argumentação (digital)',
    'comissao.cartaoDigital.valorPonto': 'Valor em R$ de cada ponto (PDF: R$1 → arg 1,50 / inc 0,50)',
    'comissao.cashback.faixas': 'Cashback (PDF 6.3.2): prêmio por faixa de conversão',
    'comissao.retencao.teto': 'Teto (R$) da retenção de CARTÃO do perfil DIGITAL — só cartão, demais produtos fora',
    'comissao.faixas.minimoCasos': 'Mínimo de casos/mês para prêmios por faixa — fone (0 = desativado)',
    'comissao.contaDigital.faixas': 'Conta Digital (PDF 6.6): prêmio por % de retenção',
    'comissao.contaDigital.bonus': 'Conta Digital (PDF 6.6): bônus 76% / 78%',
    'comissao.vendas.tabela': 'Vendas coletivas (PDF 6.3.1): R$/venda por faixa [até60, 60-79.99, 80-100, +100]',
    'comissao.massificados.faixasArg': 'Massificados (PDF 6.5): faixas de conversão — Argumentação (%)',
    'comissao.massificados.faixasInc': 'Massificados (PDF 6.5): faixas de conversão — Incentivo (%)',
    'comissao.massificados.arg': 'Massificados (PDF 6.5): R$/retido por Argumentação, por produto e faixa',
    'comissao.massificados.inc': 'Massificados (PDF 6.5): R$/retido por Incentivo, por produto e faixa',
    'meta.padrao.vendas': 'Meta padrão de vendas/mês',
    'meta.padrao.comissao': 'Meta padrão de comissão R$/mês',
    'meta.padrao.retencao': 'Meta padrão de % de retenção',
    'sistema.nome': 'Nome do sistema',
    'sistema.versao': 'Versão'
  };
  return map[key] || '';
}

/**
 * Atualiza uma configuração — SOMENTE ADMIN.
 */
function settingsUpdate_(me, chave, valor) {
  if (!isAdmin_(me)) throw new Error('Somente o ADMIN pode alterar configurações.');
  const rows = readAll_(SHEETS.SETTINGS);
  const found = rows.find(function (r) { return String(r.chave) === chave; });

  withLock_(function () {
    const sheet = ensureSheet_(SHEETS.SETTINGS);
    if (found) {
      const idCol = 1; // coluna 'chave'
      const lastRow = sheet.getLastRow();
      const keys = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
      for (let i = 0; i < keys.length; i++) {
        if (String(keys[i][0]) === chave) {
          sheet.getRange(i + 2, 2).setValue(valor);
          sheet.getRange(i + 2, 4).setValue(nowIso_());
          break;
        }
      }
    } else {
      sheet.appendRow([chave, valor, '', nowIso_()]);
    }
  });
  cacheInvalidate_(SHEETS.SETTINGS);
  audit_(me.email, 'SETTING_UPDATE', chave);
  return true;
}

/** CRUD de produtos — SOMENTE ADMIN. */
function productsSave_(me, data) {
  if (!isAdmin_(me)) throw new Error('Somente o ADMIN pode gerenciar produtos.');
  if (!data.nome) throw new Error('Nome do produto é obrigatório.');
  if (data.id) {
    updateRowById_(SHEETS.PRODUCTS, data.id, {
      nome: data.nome, categoria: data.categoria || 'Massificado',
      comissaoUnitaria: parseFloat(data.comissaoUnitaria) || 0, ativo: data.ativo || 'Sim'
    });
  } else {
    appendRow_(SHEETS.PRODUCTS, {
      id: uid_(), nome: data.nome, categoria: data.categoria || 'Massificado',
      comissaoUnitaria: parseFloat(data.comissaoUnitaria) || 0, ativo: 'Sim'
    });
  }
  audit_(me.email, 'PRODUCT_SAVE', data.nome);
  return true;
}

function productsDelete_(me, id) {
  if (!isAdmin_(me)) throw new Error('Somente o ADMIN pode excluir produtos.');
  if (!deleteRowById_(SHEETS.PRODUCTS, id)) throw new Error('Produto não encontrado.');
  audit_(me.email, 'PRODUCT_DELETE', id);
  return true;
}

/** CRUD de equipes — SOMENTE ADMIN. */
function teamsSave_(me, data) {
  if (!isAdmin_(me)) throw new Error('Somente o ADMIN pode gerenciar equipes.');
  if (!data.nome) throw new Error('Nome da equipe é obrigatório.');
  if (data.id) {
    updateRowById_(SHEETS.TEAMS, data.id, { nome: data.nome, supervisorId: data.supervisorId || '', tipo: data.tipo || '', ativo: data.ativo || 'Sim' });
  } else {
    appendRow_(SHEETS.TEAMS, { id: uid_(), nome: data.nome, supervisorId: data.supervisorId || '', tipo: data.tipo || '', ativo: 'Sim' });
  }
  audit_(me.email, 'TEAM_SAVE', data.nome);
  return true;
}

function teamsDelete_(me, id) {
  if (!isAdmin_(me)) throw new Error('Somente o ADMIN pode excluir equipes.');
  if (!deleteRowById_(SHEETS.TEAMS, id)) throw new Error('Equipe não encontrada.');
  audit_(me.email, 'TEAM_DELETE', id);
  return true;
}
