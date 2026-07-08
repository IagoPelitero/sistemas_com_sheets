/**
 * ============================================================
 * PortoBank Performance — Commission.js
 * ------------------------------------------------------------
 * Responsabilidade única: MOTOR DE REGRAS de comissionamento.
 *
 * PRINCÍPIO CENTRAL: nenhum valor, percentual ou meta é fixado
 * no código. Todo cálculo consulta as tabelas:
 *   Produtos · RegrasComissao · RegrasFone · Faixas ·
 *   Bonificacoes · Metas · Campanhas
 *
 * Dois motores independentes:
 *   MOTOR DIGITAL → aba RegrasComissao
 *     (vendas coletivas, argumentação, cashback, incentivo
 *      financeiro, conta digital, upgrade, CPCP, massificados,
 *      bônus — modeladas como linhas de regra via "metrica")
 *   MOTOR FONE → aba RegrasFone
 *     (faixas percentualMin/percentualMax → valor, por tipo,
 *      produto e canal — ex.: 73%, 75%, 78%, 82%...)
 *
 * Alterou meta ou percentual? Edita-se a TABELA. O código
 * não muda.
 * ============================================================
 */

var Commission = (function () {

  /* ---------------------------------------------------------
   * Coleta de métricas do atendente na competência (mês).
   * As métricas alimentam os dois motores.
   * --------------------------------------------------------- */
  function metricasDoAtendente_(email, competencia) {
    var periodo = Utils.periodoDaCompetencia(competencia); // {inicio, fim}
    var noPeriodo = Utils.filtroPeriodo(periodo.inicio, periodo.fim, 'data');
    var concluida = function (r) { return r.status === CONFIG.STATUS.CONCLUIDA; };

    var vendas = Db.readAll(CONFIG.SHEETS.VENDAS).filter(function (r) {
      return r.atendenteEmail === email && noPeriodo(r) && concluida(r);
    });
    var retencoes = Db.readAll(CONFIG.SHEETS.RETENCOES).filter(function (r) {
      return r.atendenteEmail === email && noPeriodo(r) && concluida(r);
    });
    var canceladas = Db.readAll(CONFIG.SHEETS.RETENCOES).filter(function (r) {
      return r.atendenteEmail === email && noPeriodo(r) && r.status === CONFIG.STATUS.CANCELADA;
    });

    var tratativas = retencoes.length + canceladas.length;
    var percRetencao = tratativas ? (retencoes.length / tratativas) * 100 : 0;

    // Contagem por produto (usada pelas regras cuja metrica = 'VENDAS_<PRODUTO>')
    var porProduto = {};
    vendas.forEach(function (v) {
      var k = 'VENDAS_' + Utils.slug(v.produto);
      porProduto[k] = (porProduto[k] || 0) + 1;
    });
    retencoes.forEach(function (r) {
      var k = 'RETENCOES_' + Utils.slug(r.produto);
      porProduto[k] = (porProduto[k] || 0) + 1;
    });
    retencoes.forEach(function (r) {
      var k = 'RETENCOES_TIPO_' + Utils.slug(r.tipoRetencao);
      porProduto[k] = (porProduto[k] || 0) + 1;
    });

    var metricas = {
      VENDAS_TOTAL: vendas.length,
      RETENCOES_TOTAL: retencoes.length,
      TRATATIVAS_TOTAL: tratativas,
      PERCENTUAL_RETENCAO: Utils.round2(percRetencao)
    };
    Object.keys(porProduto).forEach(function (k) { metricas[k] = porProduto[k]; });

    return { metricas: metricas, vendas: vendas, retencoes: retencoes, periodo: periodo };
  }

  /* ---------------------------------------------------------
   * Regra vigente? (datas de vigência + flag ativo)
   * --------------------------------------------------------- */
  function vigente_(regra, ref) {
    if (String(regra.ativo).toLowerCase() === 'false' || regra.ativo === false) return false;
    var d = ref || new Date();
    if (regra.vigenciaInicio && new Date(regra.vigenciaInicio) > d) return false;
    if (regra.vigenciaFim && new Date(regra.vigenciaFim) < d) return false;
    return true;
  }

  function matchProdutoCanal_(regra, produto, canal) {
    var okProduto = !regra.produto || regra.produto === '*' || regra.produto === produto;
    var okCanal   = !regra.canal   || regra.canal   === '*' || regra.canal   === canal;
    return okProduto && okCanal;
  }

  /* ---------------------------------------------------------
   * MOTOR DIGITAL — aba RegrasComissao
   * Cada regra: metrica + faixaMin/faixaMax + valor + unidade
   *   unidade = 'FIXO'      → soma `valor` uma vez se a métrica
   *                           cair na faixa
   *   unidade = 'POR_ITEM'  → valor × quantidade da métrica
   *   unidade = 'PERCENTUAL'→ valor% sobre base (valorConcedido
   *                           acumulado, quando aplicável)
   * --------------------------------------------------------- */
  function calcularDigital_(dados, canal) {
    var regras = Db.readAll(CONFIG.SHEETS.REGRAS_COMISSAO)
      .filter(function (r) { return vigente_(r) && (!r.canal || r.canal === '*' || r.canal === canal); })
      .sort(function (a, b) { return Number(a.prioridade || 0) - Number(b.prioridade || 0); });

    var itens = [], total = 0;

    regras.forEach(function (regra) {
      var metricaValor = Number(dados.metricas[regra.metrica] || 0);
      var min = regra.faixaMin === '' ? -Infinity : Number(regra.faixaMin);
      var max = regra.faixaMax === '' ?  Infinity : Number(regra.faixaMax);
      if (metricaValor < min || metricaValor > max) return;

      var valor = 0;
      if (regra.unidade === 'POR_ITEM')        valor = Number(regra.valor) * metricaValor;
      else if (regra.unidade === 'PERCENTUAL') valor = (Number(regra.valor) / 100) * metricaValor;
      else                                     valor = Number(regra.valor); // FIXO

      total += valor;
      itens.push({ regra: regra.nome, metrica: regra.metrica,
                   valorMetrica: metricaValor, valor: Utils.round2(valor) });
    });

    return { motor: 'DIGITAL', total: Utils.round2(total), itens: itens };
  }

  /* ---------------------------------------------------------
   * MOTOR FONE — aba RegrasFone
   * Estrutura dinâmica: percentualMin | percentualMax | valor |
   * tipo | produto | canal. Os percentuais (73%, 74%, 75%...)
   * serão cadastrados depois — o motor apenas os consome.
   * --------------------------------------------------------- */
  function calcularFone_(dados) {
    var regras = Db.readAll(CONFIG.SHEETS.REGRAS_FONE)
      .filter(function (r) { return vigente_(r); });

    var perc = dados.metricas.PERCENTUAL_RETENCAO;
    var itens = [], total = 0;

    regras.forEach(function (regra) {
      var min = Number(regra.percentualMin || 0);
      var max = regra.percentualMax === '' ? Infinity : Number(regra.percentualMax);
      if (perc < min || perc > max) return;
      if (!matchProdutoCanal_(regra, regra.produto, CONFIG.CANAIS.FONE)) return;

      var base;
      if (regra.unidade === 'POR_ITEM') {
        // valor × quantidade retida do produto da regra
        var chave = regra.produto && regra.produto !== '*'
          ? 'RETENCOES_' + Utils.slug(regra.produto)
          : 'RETENCOES_TOTAL';
        base = Number(dados.metricas[chave] || 0);
        total += Number(regra.valor) * base;
        itens.push({ regra: regra.nome, faixa: min + '–' + (max === Infinity ? '∞' : max) + '%',
                     quantidade: base, valor: Utils.round2(Number(regra.valor) * base) });
      } else {
        total += Number(regra.valor); // FIXO por atingimento da faixa
        itens.push({ regra: regra.nome, faixa: min + '–' + (max === Infinity ? '∞' : max) + '%',
                     valor: Utils.round2(Number(regra.valor)) });
      }
    });

    return { motor: 'FONE', percentualRetencao: perc, total: Utils.round2(total), itens: itens };
  }

  /* ---------------------------------------------------------
   * Bonificações e Campanhas (tabelas próprias, ambos motores)
   * --------------------------------------------------------- */
  function calcularBonificacoes_(dados, canal) {
    var bonus = Db.readAll(CONFIG.SHEETS.BONIFICACOES).filter(function (b) {
      return vigente_(b) && (!b.canal || b.canal === '*' || b.canal === canal);
    });
    var itens = [], total = 0;
    bonus.forEach(function (b) {
      var v = Number(dados.metricas[b.condicaoMetrica] || 0);
      var min = b.condicaoMin === '' ? -Infinity : Number(b.condicaoMin);
      var max = b.condicaoMax === '' ?  Infinity : Number(b.condicaoMax);
      if (v < min || v > max) return;
      var valor = (b.unidade === 'POR_ITEM') ? Number(b.valor) * v : Number(b.valor);
      total += valor;
      itens.push({ bonificacao: b.nome, valor: Utils.round2(valor) });
    });
    return { total: Utils.round2(total), itens: itens };
  }

  /* ---------------------------------------------------------
   * API pública do motor
   * --------------------------------------------------------- */

  /** Calcula a comissão de UM atendente numa competência */
  function calcular(email, competencia) {
    var usuarios = Db.indexBy(CONFIG.SHEETS.USUARIOS, 'email');
    var alvo = usuarios[email];
    if (!alvo) throw new Error('Atendente não cadastrado: ' + email);

    var perm = getPermissoesDoPerfil(alvo.perfil) || {};
    var canal = perm.canalFixo || CONFIG.CANAIS.DIGITAL;
    var dados = metricasDoAtendente_(email, competencia);

    var base = (perm.motorComissao === 'FONE')
      ? calcularFone_(dados)
      : calcularDigital_(dados, canal);

    var bon = calcularBonificacoes_(dados, canal);

    return {
      atendenteEmail: email,
      competencia: competencia,
      canal: canal,
      metricas: dados.metricas,
      comissao: base,
      bonificacoes: bon,
      total: Utils.round2(base.total + bon.total)
    };
  }

  /** Comissão do usuário logado + projeção de fechamento do mês */
  function minhaComissao(competencia) {
    var u = Auth.exigir();
    competencia = competencia || Utils.competenciaAtual();
    var res = calcular(u.email, competencia);

    // Projeção linear: (acumulado / dias úteis passados) × dias úteis do mês
    var proj = Utils.projecaoMensal(res.total, competencia);
    res.projecao = Utils.round2(proj);
    return res;
  }

  /** Consulta de comissão de terceiro — exige permissão de escopo */
  function comissaoDe(email, competencia) {
    var u = Auth.exigir();
    if (u.email !== email) {
      if (!u.permissoes.verComissaoDeTerceiros)
        throw new Error('Comissão individual de colegas não é visível para seu perfil.');
      if (u.permissoes.escopo === 'TEAM') {
        var alvo = Db.indexBy(CONFIG.SHEETS.USUARIOS, 'email')[email];
        if (!alvo || alvo.supervisorEmail !== u.email)
          throw new Error('Este atendente não pertence à sua equipe.');
      }
    }
    return calcular(email, competencia || Utils.competenciaAtual());
  }

  /** Consolida (grava snapshot) as comissões da competência — só ADMIN */
  function consolidar(competencia) {
    var u = Auth.exigirPerfil([CONFIG.PERFIS.ADMIN]);
    competencia = competencia || Utils.competenciaAtual();
    var usuarios = Db.readAll(CONFIG.SHEETS.USUARIOS)
      .filter(function (x) { return String(x.perfil).indexOf('ATENDENTE') === 0 && x.ativo !== false; });

    var linhas = usuarios.map(function (a) {
      var r = calcular(a.email, competencia);
      return {
        id: Db.nextId(CONFIG.SHEETS.COMISSOES),
        competencia: competencia,
        atendenteEmail: a.email,
        canal: r.canal,
        valorCalculado: r.total,
        detalheJson: JSON.stringify(r),
        calculadoEm: new Date()
      };
    });
    Db.insertMany(CONFIG.SHEETS.COMISSOES, linhas);
    Audit.log(u.email, 'CONSOLIDAR_COMISSAO', competencia + ' (' + linhas.length + ' atendentes)');
    return linhas.length;
  }

  return {
    calcular: calcular,
    minhaComissao: minhaComissao,
    comissaoDe: comissaoDe,
    consolidar: consolidar,
    _metricas: metricasDoAtendente_
  };
})();
