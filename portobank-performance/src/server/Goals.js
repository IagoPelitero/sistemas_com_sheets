/**
 * ============================================================
 * PortoBank Performance — Goals.js
 * ------------------------------------------------------------
 * Responsabilidade única: METAS mensais.
 * Separadas por equipe, supervisor, atendente, canal, produto
 * e tipo. Metas moram na aba Metas — mudar meta = editar linha,
 * nunca editar código.
 * ============================================================
 */

var Goals = (function () {

  /** ADMIN cadastra/edita metas */
  function salvar(payload) {
    var u = Auth.exigirPerfil([CONFIG.PERFIS.ADMIN]);

    if (payload.id) {
      var res = Db.update(CONFIG.SHEETS.METAS, payload.id, payload);
      Audit.registrarAlteracao(u.email, CONFIG.SHEETS.METAS, payload.id, res.antes, res.depois);
      return res.depois;
    }
    payload.id = Db.nextId(CONFIG.SHEETS.METAS);
    payload.ativo = true;
    Db.insert(CONFIG.SHEETS.METAS, payload);
    Audit.registrarAlteracao(u.email, CONFIG.SHEETS.METAS, payload.id, null, payload);
    return payload;
  }

  /** Metas aplicáveis a um usuário na competência */
  function metasDoUsuario(email, competencia) {
    var user = Db.indexBy(CONFIG.SHEETS.USUARIOS, 'email')[email];
    if (!user) return [];
    return Db.readAll(CONFIG.SHEETS.METAS).filter(function (m) {
      if (m.ativo === false || String(m.ativo).toLowerCase() === 'false') return false;
      if (m.competencia !== competencia) return false;
      return (m.atendenteEmail && m.atendenteEmail === email) ||
             (m.equipeId && m.equipeId === user.equipeId) ||
             (m.supervisorEmail && m.supervisorEmail === user.supervisorEmail);
    });
  }

  /**
   * Progresso do usuário logado frente às metas:
   * quanto falta para a próxima faixa e status do semáforo
   * (verde ≥ 100%, amarelo ≥ limiar de "próximo", vermelho abaixo).
   * O limiar do amarelo vem da tabela Configuracoes
   * (chave SEMAFORO_AMARELO, padrão 80) — nada fixo no código.
   */
  function progresso(competencia) {
    var u = Auth.exigir();
    competencia = competencia || Utils.competenciaAtual();

    var limiarAmarelo = Number(Settings.get('SEMAFORO_AMARELO', 80));
    var m = Commission._metricas(u.email, competencia).metricas;
    var metas = metasDoUsuario(u.email, competencia);

    var itens = metas.map(function (meta) {
      var realizado, alvo;
      if (Number(meta.metaPercentual)) {
        realizado = m.PERCENTUAL_RETENCAO;
        alvo = Number(meta.metaPercentual);
      } else {
        var chave = meta.produto ? 'VENDAS_' + Utils.slug(meta.produto) : 'VENDAS_TOTAL';
        if (meta.tipo === 'Retenção') chave = meta.produto ? 'RETENCOES_' + Utils.slug(meta.produto) : 'RETENCOES_TOTAL';
        realizado = Number(m[chave] || 0);
        alvo = Number(meta.metaQuantidade || 0);
      }
      var pct = alvo ? (realizado / alvo) * 100 : 0;
      return {
        meta: meta,
        realizado: realizado,
        alvo: alvo,
        percentual: Utils.round2(pct),
        falta: Math.max(0, Utils.round2(alvo - realizado)),
        semaforo: pct >= 100 ? 'verde' : pct >= limiarAmarelo ? 'amarelo' : 'vermelho'
      };
    });

    // Próxima faixa de comissão (motor Fone): quanto falta de % retenção
    var proximaFaixa = null;
    var perc = m.PERCENTUAL_RETENCAO;
    var faixas = Db.readAll(CONFIG.SHEETS.REGRAS_FONE)
      .filter(function (f) { return f.ativo !== false && Number(f.percentualMin) > perc; })
      .sort(function (a, b) { return Number(a.percentualMin) - Number(b.percentualMin); });
    if (faixas.length) {
      proximaFaixa = {
        faixa: faixas[0].percentualMin + '%',
        faltaPontos: Utils.round2(Number(faixas[0].percentualMin) - perc)
      };
    }

    return { competencia: competencia, metricas: m, metas: itens, proximaFaixa: proximaFaixa };
  }

  function listar(opts) {
    Auth.exigir();
    return Db.query(CONFIG.SHEETS.METAS, opts || {});
  }

  return { salvar: salvar, metasDoUsuario: metasDoUsuario, progresso: progresso, listar: listar };
})();
