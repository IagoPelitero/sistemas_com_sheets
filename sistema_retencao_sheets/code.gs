// ============================================================================
// CONSTANTES E CONFIGURAÇÕES GLOBAIS
// ============================================================================
const ROLES = {
  ADMIN: 'ADM',
  SUPERVISOR: 'Supervisor',
  ATTENDANT: 'Atendente'
};

const CACHE_DURATION = {
  SHORT: 600,      // 10 minutos
  MEDIUM: 1800,    // 30 minutos
  LONG: 3600       // 1 hora
};

const LOCK_TIMEOUT = {
  SHORT: 5000,     // 5 segundos
  MEDIUM: 10000,   // 10 segundos
  LONG: 30000      // 30 segundos
};

// ============================================================================
// UTILITÁRIOS - CACHE, LOGGING E VALIDAÇÃO
// ============================================================================

/**
 * Wrapper para cache com callback - reutilizável em todas as funções
 */
function getCachedData(cacheKey, callback, expiration = CACHE_DURATION.MEDIUM) {
  const cache = CacheService.getScriptCache();
  const cachedValue = cache.get(cacheKey);
  
  if (cachedValue) {
    return JSON.parse(cachedValue);
  }
  
  const freshData = callback();
  
  if (freshData && !freshData.error) {
    cache.put(cacheKey, JSON.stringify(freshData), expiration);
  }
  
  return freshData;
}

/**
 * Registra ações no sheet de logs para auditoria
 */
function registrarLog(acao, detalhes) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logsSheet = ss.getSheetByName('Logs');
    
    if (!logsSheet) {
      logsSheet = ss.insertSheet('Logs');
      logsSheet.appendRow(['DATA/HORA', 'EMAIL', 'AÇÃO', 'DETALHES']);
    }
    
    const agora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    const email = Session.getActiveUser().getEmail();
    
    logsSheet.appendRow([agora, email, acao, detalhes]);
  } catch (e) {
    console.error("Falha ao registrar log: " + e.message);
  }
}

/**
 * Valida formato de email
 */
function validarEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida dados de cadastro de usuário
 */
function validarCadastro(dados) {
  if (!dados.email || !validarEmail(dados.email)) {
    return "Email inválido";
  }
  if (!dados.nome || dados.nome.trim().length < 2) {
    return "Nome deve ter pelo menos 2 caracteres";
  }
  if (!dados.sobrenome || dados.sobrenome.trim().length < 2) {
    return "Sobrenome deve ter pelo menos 2 caracteres";
  }
  if (!Object.values(ROLES).includes(dados.cargo)) {
    return `Cargo inválido. Deve ser um de: ${Object.values(ROLES).join(', ')}`;
  }
  return null; // Válido
}

/**
 * Verifica se usuário tem permissão de admin ou supervisor
 */
function isAdmin(user) {
  return user.cargo === ROLES.ADMIN;
}

function isSupervisor(user) {
  return [ROLES.ADMIN, ROLES.SUPERVISOR].includes(user.cargo);
}

/**
 * Invalida caches relacionados a usuários
 */
function invalidarCacheUsuarios() {
  try {
    const cache = CacheService.getScriptCache();
    cache.removeAll(['supervisores_list', 'dashboard_data', 'supervisor_data', 'ranking_data']);
  } catch (e) {
    console.error("Erro ao invalidar cache: " + e.message);
  }
}

// ============================================================================
// 1. RENDERIZAÇÃO E SISTEMA
// ============================================================================

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate().setTitle('Retenção')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getUserInfo() {
  const email = Session.getActiveUser().getEmail();
  const cacheKey = `user_info_${email}`;
  
  return getCachedData(cacheKey, () => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
    
    if (!sheet) return { error: "Aba 'Usuarios' não encontrada.", email: email };

    const data = sheet.getDataRange().getValues();
    
    // Pula cabeçalho (i=1)
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == email) {
        return {
          email: email, 
          nome: data[i][1], 
          sobrenome: data[i][2],
          cargo: data[i][3], 
          supervisor: data[i][4]
        };
      }
    }
    return { error: "Usuário não encontrado.", email: email };
  }, CACHE_DURATION.LONG);
}

// --- 2. CADASTRO E GOVERNANÇA ---

function getSupervisoresList() {
  return getCachedData('supervisores_list', () => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getValues();
    // Filtra quem é supervisor ou ADM
    return data.slice(1)
      .filter(r => r[3] === ROLES.SUPERVISOR || r[3] === ROLES.ADMIN)
      .map(r => r[1] + ' ' + r[2]); // Retorna Nome + Sobrenome
  }, CACHE_DURATION.LONG);
}

function cadastrarUsuario(dados) {
  // Validação de entrada
  const erroValidacao = validarCadastro(dados);
  if (erroValidacao) {
    registrarLog('CADASTRO_ERRO', `Email: ${dados.email} - ${erroValidacao}`);
    return { error: erroValidacao };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_TIMEOUT.MEDIUM);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Usuarios');
    const data = sheet.getDataRange().getValues();
    
    let linhaDoUsuario = -1;
    
    // Procura se o e-mail já está cadastrado
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === dados.email) {
        linhaDoUsuario = i + 1;
        break;
      }
    }

    if (linhaDoUsuario !== -1) {
      // Atualiza usuário existente
      sheet.getRange(linhaDoUsuario, 2, 1, 4).setValues([[
        dados.nome,
        dados.sobrenome,
        dados.cargo,
        dados.supervisor
      ]]);
      
      SpreadsheetApp.flush();
      invalidarCacheUsuarios();
      registrarLog('CADASTRO_ATUALIZAR', `Email: ${dados.email} | Cargo: ${dados.cargo}`);
      
      return { success: true, message: "Usuário atualizado com sucesso!" };
    } else {
      // Cria novo usuário
      sheet.appendRow([
        dados.email,
        dados.nome,
        dados.sobrenome,
        dados.cargo,
        dados.supervisor 
      ]);
      
      SpreadsheetApp.flush();
      invalidarCacheUsuarios();
      registrarLog('CADASTRO_NOVO', `Email: ${dados.email} | Nome: ${dados.nome} | Cargo: ${dados.cargo}`);
      
      return { success: true, message: "Usuário cadastrado com sucesso!" };
    }
  } catch (e) {
    registrarLog('CADASTRO_ERRO_SISTEMA', `Email: ${dados.email} - ${e.message}`);
    return { error: "Erro no cadastro: " + e.message };
  } finally {
    lock.releaseLock();
  }
}

function excluirUsuario(email) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_TIMEOUT.MEDIUM);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
    const data = sheet.getDataRange().getValues();
    
    for(let i = 1; i < data.length; i++){
      if(data[i][0] == email) {
        sheet.deleteRow(i+1);
        
        SpreadsheetApp.flush();
        invalidarCacheUsuarios();
        registrarLog('USUARIO_EXCLUIDO', `Email: ${email}`);
        
        return { success: true, message: "Usuário excluído com sucesso." };
      }
    }
    
    registrarLog('USUARIO_EXCLUIR_ERRO', `Email: ${email} - Não encontrado`);
    return { error: "Usuário não encontrado." };
  } catch (e) {
    registrarLog('USUARIO_EXCLUIR_ERRO_SISTEMA', `Email: ${email} - ${e.message}`);
    return { error: "Erro ao excluir: " + e.message };
  } finally {
    lock.releaseLock();
  }
}

function arquivarMes(idPlanilhaDestino) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_TIMEOUT.LONG);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheetByName('Dados');
    const data = sourceSheet.getDataRange().getValues();

    if (data.length <= 1) {
      registrarLog('ARQUIVAMENTO_ERRO', 'Nenhum dado para arquivar');
      return { error: "Não há dados para arquivar." };
    }

    const destSS = SpreadsheetApp.openById(idPlanilhaDestino);
    let destSheet = destSS.getSheetByName('Historico');
    if (!destSheet) destSheet = destSS.insertSheet('Historico');

    const rows = data.slice(1);
    const lastRow = destSheet.getLastRow();
    
    if (lastRow === 0) {
      destSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    } else {
      destSheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    SpreadsheetApp.flush();
    sourceSheet.deleteRows(2, rows.length);
    
    invalidarCacheUsuarios();
    registrarLog('ARQUIVAMENTO_SUCESSO', `${rows.length} registros movidos para ${idPlanilhaDestino}`);
    
    return { success: true, message: "Sucesso! Dados movidos para o arquivo." };
  } catch (e) {
    registrarLog('ARQUIVAMENTO_ERRO_SISTEMA', `ID: ${idPlanilhaDestino} - ${e.message}`);
    return { error: "Erro no arquivamento: " + e.message };
  } finally {
    lock.releaseLock();
  }
}

// --- 3. REGISTRO DE DADOS ---

function salvarRetencao(form) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_TIMEOUT.LONG);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Dados');
    const user = getUserInfo();
    
    if (user.error) {
      registrarLog('RETENCAO_ERRO', 'Usuário não encontrado');
      return { error: user.error };
    }

    // Usa a data enviada pelo formulário, corrigindo problemas de fuso horário
    const dateParts = form.dataAtendimento.split('-');
    const dataCorreta = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 12, 0, 0);
    const dataFormatada = Utilities.formatDate(dataCorreta, Session.getScriptTimeZone(), "dd/MM/yyyy");

    sheet.appendRow([
      dataFormatada,
      user.email, 
      user.nome,
      user.supervisor || '-',
      form.tipo,
      form.subProduto || '-',
      form.resultado,
      'Ativo'
    ]);

    SpreadsheetApp.flush();
    invalidarCacheUsuarios();
    registrarLog('RETENCAO_SALVA', `${form.tipo} - ${form.resultado} | ${user.email}`);
    
    return { success: true, message: "Registro salvo com sucesso!" };
  } catch (e) {
    registrarLog('RETENCAO_ERRO_SISTEMA', `${form.tipo} - ${e.message}`);
    return { error: "Erro ao salvar: " + e.message };
  } finally {
    lock.releaseLock();
  }
}

function getUltimosRegistros() {
  try {
    const user = getUserInfo();
    if (!user || user.error) {
      return { error: "Usuário não encontrado" };
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Dados');
    const data = sheet.getDataRange().getValues();
    let ultimos = [];
    
    const userEmail = String(user.email).trim().toLowerCase();
    
    for (let i = data.length - 1; i >= 1; i--) {
      let rowEmail = String(data[i][1] || '').trim().toLowerCase();
      
      if (rowEmail === userEmail) {
        let dataOriginal = data[i][0];
        let dataFormatada = (dataOriginal instanceof Date) ? dataOriginal.toLocaleDateString('pt-BR') : dataOriginal;

        ultimos.push({
          linha: i + 1, 
          data: dataFormatada,
          produto: String(data[i][4] || ''),
          subProduto: String(data[i][5] || ''),
          resultado: String(data[i][6] || '')
        });
        
        if (ultimos.length === 5) break;
      }
    }
    
    return { success: true, data: ultimos };
  } catch (e) {
    registrarLog('ULTIMOS_REGISTROS_ERRO', e.message);
    return { error: "Falha ao buscar registros: " + e.message };
  }
}

function excluirRegistro(linha) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_TIMEOUT.MEDIUM);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Dados');
    const user = getUserInfo();
    
    // Trava de segurança: garante que a pessoa só exclua o próprio registro
    const emailDaLinha = sheet.getRange(linha, 2).getValue();
    if(emailDaLinha !== user.email && !isAdmin(user)) {
      registrarLog('REGISTRO_EXCLUSAO_NEGADA', `Linha: ${linha} - Email: ${emailDaLinha} - Tentativa de: ${user.email}`);
      return { error: "Erro: Você só pode excluir os seus próprios registros." };
    }
    
    sheet.deleteRow(linha);
    invalidarCacheUsuarios();
    registrarLog('REGISTRO_EXCLUIDO', `Linha: ${linha} | Por: ${user.email}`);
    
    return { success: true, message: "Registro excluído com sucesso!" };
  } catch(e) {
    registrarLog('REGISTRO_EXCLUSAO_ERRO_SISTEMA', `Linha: ${linha} - ${e.message}`);
    return { error: "Erro ao excluir: " + e.message };
  } finally {
    lock.releaseLock();
  }
}

// --- 4. DASHBOARD E RELATÓRIOS ---

function getDashboardData() {
  return getCachedData('dashboard_data', () => {
    const user = getUserInfo();
    if(user.error) {
      registrarLog('DASHBOARD_ERRO', 'Usuário não encontrado');
      return { error: user.error };
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Dados');
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1);

    // 1. Dados Pessoais
    const meusDados = rows.filter(row => row[1] === user.email);
    const statsPessoal = processarEstatisticas(meusDados);
    const comissaoPessoal = calcularComissoes(statsPessoal);

    // 2. Dados da Equipe (Se tiver supervisor)
    let statsEquipe = null;
    let comissaoEquipe = null;
    if (user.supervisor && user.supervisor !== '-') {
       const dadosEquipe = rows.filter(row => row[3] === user.supervisor);
       statsEquipe = processarEstatisticas(dadosEquipe);
       comissaoEquipe = calcularComissoes(statsEquipe);
    }

    return {
      pessoal: { stats: statsPessoal, comissao: comissaoPessoal },
      equipe: statsEquipe ? { stats: statsEquipe, comissao: comissaoEquipe } : null
    };
  }, CACHE_DURATION.MEDIUM);
}

function processarEstatisticas(rows) {
  let stats = {
    cartao: { total: 0, retidoTotal: 0, retidoArg: 0, retidoInc: 0, cancelado: 0 },
    conta: { total: 0, retido: 0, cancelado: 0 },
    pontos: { cashback: 0, milhas: 0 },
    massificado: {},
    lista: [] 
  };

  rows.forEach(r => {
    // Índices: [0]Data, [4]Tipo, [5]Sub, [6]Res
    let dataReg = r[0];
    let dataStr = "";

    if (dataReg instanceof Date) {
      // Utilities.formatDate garante que 21:00 continue sendo o dia de HOJE
      dataStr = Utilities.formatDate(dataReg, Session.getScriptTimeZone(), "dd/MM/yyyy");
    } else {
      dataStr = String(dataReg);
    }

    let tipo = r[4]; 
    let sub = r[5]; 
    let res = r[6];

    stats.lista.push({
        data: dataStr,
        produto: tipo,
        subProduto: sub,
        resultado: res
    });

    // KPI
    if (tipo === 'Cartão de Crédito') {
      stats.cartao.total++;
      if (res.includes('Retido')) {
        stats.cartao.retidoTotal++;
        if (res.includes('Argumentação')) stats.cartao.retidoArg++;
        if (res.includes('Incentivo')) stats.cartao.retidoInc++;
      }
      else if (res.includes('Cancelado')) stats.cartao.cancelado++;
    }
    else if (tipo === 'Troca de Pontos') {
        if (res.includes('Cashback')) stats.pontos.cashback++;
        if (res.includes('Milhas')) stats.pontos.milhas++;
    }
    else if (tipo === 'Conta Digital') {
      stats.conta.total++;
      if (res.includes('Retido')) stats.conta.retido++;
      else stats.conta.cancelado++;
    }
    else if (tipo === 'Massificado') {
       const nomeM = sub || 'Outros';
       if (!stats.massificado[nomeM]) stats.massificado[nomeM] = { arg: 0, troca: 0, canc: 0 };

       if (res.includes('Argumentação')) stats.massificado[nomeM].arg++;
       else if (res.includes('Troca')) stats.massificado[nomeM].troca++;
       else if (res.includes('Cancelado')) stats.massificado[nomeM].canc++;
    }
  });
  
  return stats;
}


// =======================================================================================
// ======================= FUNÇÃO CENTRAL DE CÁLCULO DE COMISSÃO =======================
// =======================================================================================
//  TODA A LÓGICA DE COMISSIONAMENTO ESTÁ AQUI. 
//  Para alterar valores, metas ou regras de bônus, modifique esta função.
//  Ela recebe as estatísticas de um usuário ou equipe e retorna um objeto com os valores de comissão.
// =======================================================================================
function calcularComissoes(stats) {
    const calcPct = (num, den) => (den && den > 0) ? (num / den) * 100 : 0;
    
    let comissao = { cc: 0, cd: 0, cashback: 0, massificado: 0, total: 0 };
    let valorCashback = 0;

    // --- 1. CARTÃO DE CRÉDITO ---
    const totalCC = stats.cartao.retidoTotal + stats.cartao.cancelado; // Base de cálculo: atendimentos finalizados
    const retidoCC = stats.cartao.retidoTotal;
    const argCC = stats.cartao.retidoArg;

    const pctCC = calcPct(retidoCC, totalCC);
    const pctArg = calcPct(argCC, retidoCC);

    const incCC = retidoCC - argCC;

    const VALOR_ARGUMENTACAO = 1.50;
    const VALOR_INCENTIVO = 0.50;

    const comissaoArg = argCC * VALOR_ARGUMENTACAO;
    const comissaoInc = incCC * VALOR_INCENTIVO;

    comissao.cc = comissaoArg + comissaoInc;

    // --- 2. CONTA DIGITAL ---
    const totalCD = stats.conta.retido + stats.conta.cancelado; // Base de cálculo: atendimentos finalizados
    const pctConta = calcPct(stats.conta.retido, totalCD); 
    
    let comissaoConta = 0, bonusConta = 0; 
    if (pctConta >= 75) comissaoConta = 200; 
    else if (pctConta >= 50) comissaoConta = 150; 
    else if (pctConta >= 30) comissaoConta = 100; 
    
    if (pctConta >= 78) bonusConta = 150; 
    else if (pctConta >= 76) bonusConta = 100;

    comissao.cd = comissaoConta + bonusConta;

    // --- 3. CASHBACK ---
    const qtdCashback = stats.pontos.cashback || 0; // Quantidade absoluta
    const qtdMilhas = stats.pontos.milhas || 0
    const totalTrocas = qtdCashback + qtdMilhas;
    
    const pctCashback = calcPct(qtdCashback, totalTrocas);

    if (pctCashback >= 45) valorCashback = 130;
    else if (pctCashback >= 42) valorCashback = 100;
    else if (pctCashback >= 39) valorCashback = 70;
    else if (pctCashback >= 36) valorCashback = 50;
    
    comissao.cashback = valorCashback;

    // --- 4. MASSIFICADOS ---
    // Esta é a lógica de comissão "por retenção".
    // O valor pago por cada retenção (vArg, vInc) depende da % de performance do produto.
    const listaPadrao = ["SPPR / Bolsa Protegida", "Adicional", "Acidentes Pessoais", "Identidade protegida", "Seguro RE", "Martelinho de Ouro", "Quitação fatura"];
    let totalMass = 0;

    listaPadrao.forEach(nome => {
        const p = stats.massificado[nome] || { arg: 0, troca: 0, canc: 0 };
        const pTotal = p.arg + p.troca + p.canc; // Total do produto específico
        const pPctArg = calcPct(p.arg, pTotal);
        const pPctInc = calcPct(p.troca, pTotal);

        // Define o valor a ser pago por CADA retenção em argumentação
        let vArg = 0;
        if (pPctArg >= 60) vArg = 3.00;
        else if (pPctArg >= 50) vArg = 2.50;
        else if (pPctArg >= 30) vArg = 2.00;
        else if (pPctArg >= 15) vArg = 1.50;
        totalMass += (p.arg * vArg);

        // Define o valor a ser pago por CADA retenção em troca/incentivo
        let vInc = 0;
        if (pPctInc >= 75) vInc = 2.00;
        else if (pPctInc >= 70) vInc = 1.50;
        else if (pPctInc >= 65) vInc = 1.25;
        else if (pPctInc >= 60) vInc = 1.00;
        totalMass += (p.troca * vInc);
    });
    
    comissao.massificado = totalMass;

    // --- 5. TOTALIZAÇÃO ---
    comissao.total = comissao.cc + comissao.cd + comissao.cashback + comissao.massificado;

    return comissao;
}

function getSupervisorData(filtroEmail) {
  return getCachedData(`supervisor_data_${filtroEmail || 'geral'}`, () => {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const wsUsers = ss.getSheetByName("Usuarios");
      const emailLogado = Session.getActiveUser().getEmail();

      const usersData = wsUsers.getRange(2, 1, wsUsers.getLastRow() - 1, 5).getValues();
      const userLogado = usersData.find(u => u[0] === emailLogado);

      if (!userLogado) {
        registrarLog('SUPERVISOR_DATA_ERRO', 'Usuário não encontrado');
        return { error: "Usuário não encontrado" };
      }

      const nomeSupervisor = userLogado[1] + ' ' + userLogado[2];
      let equipeEmails = [];
      let listaMembros = [];

      if (userLogado[3] === ROLES.ADMIN) {
          equipeEmails = usersData.map(u => u[0]);
          listaMembros = usersData.map(u => ({ email: u[0], nome: u[1] + ' ' + u[2] }));
      } else if (userLogado[3] === ROLES.SUPERVISOR) {
          const equipe = usersData.filter(u => u[4] === nomeSupervisor);
          equipeEmails = equipe.map(u => u[0]);
          listaMembros = equipe.map(u => ({ email: u[0], nome: u[1] + ' ' + u[2] }));
          if (!equipeEmails.includes(emailLogado)) equipeEmails.push(emailLogado);
      } else {
          registrarLog('SUPERVISOR_DATA_ACESSO_NEGADO', `Email: ${emailLogado} - Cargo: ${userLogado[3]}`);
          return { error: "Acesso negado" };
      }

      const wsDados = ss.getSheetByName("Dados");
      const todosOsDados = wsDados.getDataRange().getValues();
      todosOsDados.shift();

      const dadosFiltrados = todosOsDados.filter(row => {
          const emailAtendente = row[1];
          if (!equipeEmails.includes(emailAtendente)) return false;
          if (filtroEmail && emailAtendente !== filtroEmail) return false;
          return true;
      });

      const statsGeral = processarEstatisticas(dadosFiltrados);

      return { geral: statsGeral, equipe: listaMembros };
    } catch (e) {
      registrarLog('SUPERVISOR_DATA_ERRO_SISTEMA', e.message);
      return { error: e.message };
    }
  }, CACHE_DURATION.MEDIUM);
}

function getRankingData(periodo) {
  return getCachedData(`ranking_data_${periodo}`, () => {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const wsUsers = ss.getSheetByName("Usuarios");
      const emailLogado = Session.getActiveUser().getEmail();

      const usersData = wsUsers.getRange(2, 1, wsUsers.getLastRow() - 1, 5).getValues();
      const userLogado = usersData.find(u => u[0] === emailLogado);

      if (!userLogado || !isSupervisor(userLogado)) {
        registrarLog('RANKING_ACESSO_NEGADO', `Email: ${emailLogado}`);
        return [];
      }

      const nomeSupervisor = userLogado[1] + ' ' + userLogado[2];
      let listaMembros = [];

      if (userLogado[3] === ROLES.ADMIN) {
          listaMembros = usersData.map(u => ({ email: u[0], nome: u[1] + ' ' + u[2] }));
      } else {
          listaMembros = usersData
            .filter(u => u[4] === nomeSupervisor)
            .map(u => ({ email: u[0], nome: u[1] + ' ' + u[2] }));
      }

      const wsDados = ss.getSheetByName("Dados");
      const todosOsDados = wsDados.getDataRange().getValues();
      todosOsDados.shift();

      let dadosFiltrados = todosOsDados;
      const hoje = new Date();

      const parseDateSegura = (d) => {
        if (d instanceof Date) return d;
        if (typeof d === 'string' && d.includes('/')) {
          const p = d.split('/');
          return new Date(p[2], p[1] - 1, p[0]);
        }
        return new Date(d);
      };

      if (periodo === 'mensal') {
        const inicioDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dadosFiltrados = todosOsDados.filter(row => parseDateSegura(row[0]) >= inicioDoMes);
      } else if (periodo === 'semanal') {
        const seteDiasAtras = new Date();
        seteDiasAtras.setHours(0, 0, 0, 0);
        seteDiasAtras.setDate(hoje.getDate() - 7);
        dadosFiltrados = todosOsDados.filter(row => parseDateSegura(row[0]) >= seteDiasAtras);
      }

      const ranking = [];
      const calcPct = (num, den) => (den && den > 0) ? (num / den) * 100 : 0;

      listaMembros.forEach(membro => {
        const dadosDoMembro = dadosFiltrados.filter(row => row[1] === membro.email);
        
        if (dadosDoMembro.length > 0) {
          const stats = processarEstatisticas(dadosDoMembro);
          const comissao = calcularComissoes(stats);
          const pctRetCC = calcPct(stats.cartao.retidoTotal, stats.cartao.retidoTotal + stats.cartao.cancelado);
          const pctRetCD = calcPct(stats.conta.retido, stats.conta.retido + stats.conta.cancelado);

          ranking.push({ 
            email: membro.email,
            nome: membro.nome, 
            pctRetCC: pctRetCC, 
            pctRetCD: pctRetCD, 
            comissaoTotal: comissao.total 
          });
        }
      });

      ranking.sort((a, b) => b.comissaoTotal - a.comissaoTotal);

      return ranking;
    } catch (e) {
      registrarLog('RANKING_ERRO_SISTEMA', e.message);
      return [];
    }
  }, CACHE_DURATION.MEDIUM);
}
// --- 5. EXPORTAÇÃO DE RELATÓRIO (CSV) ---

function gerarRelatorioCSV(inicio, fim, tipoRelatorio) {
  try {
    const user = getUserInfo(); 
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Dados'); 
    
    if(!sheet) {
      registrarLog('RELATORIO_ERRO', 'Aba de Dados não encontrada');
      return { error: "Erro: Aba de Dados não encontrada." };
    }

    const data = sheet.getDataRange().getValues();
    
    const dInicio = new Date(inicio); 
    dInicio.setHours(0,0,0,0);
    const dFim = new Date(fim); 
    dFim.setHours(23,59,59,999);

    let csvContent = "Data,Email,Nome,Supervisor,Produto,SubProduto,Resultado\n";

    const parseDateSegura = (d) => {
      if (d instanceof Date) return d;
      if (typeof d === 'string' && d.includes('/')) {
        const p = d.split('/');
        return new Date(p[2], p[1] - 1, p[0]);
      }
      return new Date(d);
    };

    const filtrados = data.slice(1).filter(row => {
      const dataRow = parseDateSegura(row[0]); 
      if (dataRow < dInicio || dataRow > dFim) return false;

      if (tipoRelatorio === 'Pessoal') {
         return row[1] === user.email;
      } 
      else if (tipoRelatorio === 'Equipe') {
         if (isAdmin(user)) return true;
         const nomeCompleto = user.nome + ' ' + user.sobrenome;
         return row[3] === nomeCompleto || row[1] === user.email;
      }
      return false;
    });

    if (filtrados.length === 0) {
      registrarLog('RELATORIO_VAZIO', `Tipo: ${tipoRelatorio} | Período: ${inicio} a ${fim}`);
      return { error: "Vazio" };
    }

    filtrados.forEach(row => {
      csvContent += `"${row[0]}","${row[1]}","${row[2]}","${row[3]}","${row[4]}","${row[5]}","${row[6]}"\n`;
    });

    registrarLog('RELATORIO_EXPORTADO', `Tipo: ${tipoRelatorio} | ${filtrados.length} linhas | ${user.email}`);
    
    return { success: true, content: csvContent, filename: `Relatorio_${tipoRelatorio}_${inicio}.csv` };
  } catch (e) {
    registrarLog('RELATORIO_ERRO_SISTEMA', e.message);
    return { error: "Erro ao gerar relatório: " + e.message };
  }
}