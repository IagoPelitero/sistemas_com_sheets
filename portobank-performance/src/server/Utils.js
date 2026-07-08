/**
 * ============================================================
 * PortoBank Performance — Utils.js
 * ------------------------------------------------------------
 * Responsabilidade única: funções utilitárias puras
 * (datas, CPF, arredondamento, competência, projeção).
 * Nenhum acesso a dados, nenhuma regra de negócio.
 * ============================================================
 */

var Utils = (function () {

  /** Arredonda para 2 casas decimais */
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  /** Remove máscara do CPF (000.000.000-00 → 00000000000) */
  function limparCpf(cpf) { return String(cpf || '').replace(/\D/g, ''); }

  /** Validação matemática de CPF (dígitos verificadores) */
  function cpfValido(cpf) {
    cpf = limparCpf(cpf);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    for (var t = 9; t < 11; t++) {
      var soma = 0;
      for (var i = 0; i < t; i++) soma += Number(cpf[i]) * ((t + 1) - i);
      var dig = (soma * 10) % 11 % 10;
      if (dig !== Number(cpf[t])) return false;
    }
    return true;
  }

  /** 'gg' → 'GG' sem acentos, para chaves de métrica */
  function slug(txt) {
    return String(txt || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_').toUpperCase();
  }

  /** Competência atual no formato yyyy-MM */
  function competenciaAtual() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
  }

  /** {inicio, fim} da competência yyyy-MM */
  function periodoDaCompetencia(comp) {
    var p = String(comp || competenciaAtual()).split('-');
    var ano = Number(p[0]), mes = Number(p[1]);
    return { inicio: new Date(ano, mes - 1, 1), fim: new Date(ano, mes, 0, 23, 59, 59) };
  }

  /** Filtro (row)=>bool por período em um campo de data */
  function filtroPeriodo(inicio, fim, campo) {
    var di = inicio ? new Date(inicio) : null;
    var df = fim ? new Date(fim) : null;
    if (df) df.setHours(23, 59, 59, 999);
    return function (r) {
      var d = r[campo] instanceof Date ? r[campo] : new Date(r[campo]);
      if (isNaN(d)) return false;
      if (di && d < di) return false;
      if (df && d > df) return false;
      return true;
    };
  }

  /** Projeção linear do mês: acumulado ÷ dias corridos × dias do mês */
  function projecaoMensal(acumulado, competencia) {
    var per = periodoDaCompetencia(competencia);
    var hoje = new Date();
    if (hoje > per.fim) return acumulado;                  // mês fechado
    var diasMes = per.fim.getDate();
    var diasCorridos = Math.max(1, Math.min(hoje.getDate(), diasMes));
    return (acumulado / diasCorridos) * diasMes;
  }

  return {
    round2: round2,
    limparCpf: limparCpf,
    cpfValido: cpfValido,
    slug: slug,
    competenciaAtual: competenciaAtual,
    periodoDaCompetencia: periodoDaCompetencia,
    filtroPeriodo: filtroPeriodo,
    projecaoMensal: projecaoMensal
  };
})();
