jsconst SPREADSHEET_ID = 'id_sheets'; 

const SHEETS = {
  VENDAS: "vendas_ativas",
  PRODUTOS: "produtos_comissao",
  USUARIOS: "equipes_e_usuarios",
  METAS: "metas_e_resumo",
  LOGS: "logs_auditoria"
};

function getSpreadsheet() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate().setTitle('Sistema de Vendas Porto')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// --- UTILITÁRIOS E SEGURANÇA ---

// NOVO: Wrapper de Cache para reduzir leituras da planilha
function getCachedData(key, callback, expiration = 900) { // 15 minutos por padrão
  const cache = CacheService.getScriptCache();
  const cachedValue = cache.get(key);
  if (cachedValue) {
    return JSON.parse(cachedValue);
  }
  const freshData = callback();
  if (freshData && !freshData.error) {
    cache.put(key, JSON.stringify(freshData), expiration);
  }
  return freshData;
}

function registrarLog(acao, detalhes) {
  try {
    const ss = getSpreadsheet();
    let ws = ss.getSheetByName(SHEETS.LOGS);
    if (!ws) { ws = ss.insertSheet(SHEETS.LOGS); ws.appendRow(["DATA/HORA", "USUÁRIO", "AÇÃO", "DETALHES"]); }
    const agora = Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy HH:mm:ss");
    ws.appendRow([agora, Session.getActiveUser().getEmail(), acao, detalhes]);
  } catch(e) {
    console.error("Falha ao registrar log: " + e.message);
  }
}

function getUserDetails() {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const cacheKey = `user_details_${userEmail}`;

    return getCachedData(cacheKey, () => {
      const ws = getSpreadsheet().getSheetByName(SHEETS.USUARIOS);
      const data = ws.getRange(2, 1, ws.getLastRow() - 1, 4).getValues();
      const found = data.find(row => row[0].toString().toLowerCase() === userEmail.toLowerCase());
      
      if (found) {
        const user = { email: found[0], nome: found[1], equipe: found[2], cargo: found[3], supervisor: "" };
        if (['atendente', 'operador'].includes(user.cargo.toLowerCase())) {
          const supRow = data.find(r => r[2] === user.equipe && r[3].toLowerCase() === 'supervisor');
          user.supervisor = supRow ? supRow[1] : "Não atribuído";
        }
        return user;
      }
      return { email: userEmail, nome: "Visitante", equipe: "Geral", cargo: "Visitante" };
    }, 3600); // Cache de 1 hora para detalhes do usuário
  } catch (e) { return { error: e.message }; }
}

function getUniqueTeams() {
  return getCachedData('unique_teams', () => {
    const ws = getSpreadsheet().getSheetByName(SHEETS.USUARIOS);
    const data = ws.getRange(2, 3, ws.getLastRow()-1, 1).getValues().flat();
    return [...new Set(data)].filter(String).sort();
  });
}

function getProductList() {
  return getCachedData('product_list', () => {
    const ws = getSpreadsheet().getSheetByName(SHEETS.PRODUTOS);
    return ws ? ws.getRange(3, 1, ws.getLastRow()-2, 1).getValues().flat().filter(String) : [];
  });
}

// --- METAS E PROJEÇÃO ---
function getMetaPorEquipe(nomeEquipe) {
  try {
    const ws = getSpreadsheet().getSheetByName(SHEETS.METAS);
    if (!ws || ws.getLastRow() < 1) return 50;
    const dados = ws.getRange(1, 1, ws.getLastRow(), 2).getValues();
    const found = dados.find(r => r[0].toString().trim() === nomeEquipe?.trim());
    return (found && found[1]) ? parseInt(found[1]) : (parseInt(ws.getRange("B1").getValue()) || 50);
  } catch (e) { return 50; }
}

function calcularProjecao(totalVendas, meta) {
  const hoje = new Date();
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const diasRestantes = (ultimoDia - hoje.getDate()) + 1;
  const falta = Math.max(0, meta - totalVendas);
  return { diasRestantes, mediaNecessaria: falta > 0 ? (falta / diasRestantes).toFixed(1) : 0 };
}

function getCommissionRules() {
  return getCachedData('commission_rules', () => {
    const ws = getSpreadsheet().getSheetByName(SHEETS.PRODUTOS);
    const rules = {};
    if(!ws) return {};
    ws.getRange(2, 1, ws.getLastRow()-1, 7).getValues().forEach(r => {
      if(r[0]) rules[r[0].toString().toUpperCase().trim()] = { tipo: r[1].toString().toUpperCase().trim(), faixas: [Number(r[2]), Number(r[3]), Number(r[4]), Number(r[5])], fixo: Number(r[6]) };
    });
    return rules;
  });
}

// --- DASHBOARD (RESUMO) ---
function getTab1Data() {
  try {
    const user = getUserDetails();
    if (user.error) throw new Error(user.error);

    const cacheKey = `tab1_data_${user.email}`;
    // Cache de 5 minutos para os dados do dashboard
    return getCachedData(cacheKey, () => {
      const metaIndividual = getMetaPorEquipe(user.equipe);
      const wsVendas = getSpreadsheet().getSheetByName(SHEETS.VENDAS);
      
      let totalIndiv = 0, totalEquipe = 0;
      const prodIndiv = {}, prodEquipe = {};

      const todosProdutos = getProductList();
      todosProdutos.forEach(p => {
        prodIndiv[p] = 0;
        prodEquipe[p] = 0;
      });

      if (wsVendas && wsVendas.getLastRow() >= 2) {
        wsVendas.getRange(2, 1, wsVendas.getLastRow() - 1, 6).getValues().forEach(row => {
          const prod = row[1].toString().trim();
          const qtd = parseInt(row[5]) || 0;
          if (!prod || qtd === 0) return;
          
          if (row[4].toString().trim() === user.equipe) { 
            totalEquipe += qtd; 
            prodEquipe[prod] = (prodEquipe[prod] || 0) + qtd; 
          }
          if (row[3].toString().trim() === user.email) { 
            totalIndiv += qtd; 
            prodIndiv[prod] = (prodIndiv[prod] || 0) + qtd; 
          }
        });
      }

      const rules = getCommissionRules();
      const percentualDecimal = metaIndividual > 0 ? totalIndiv / metaIndividual : 0;
      let faixaIdx = percentualDecimal < 0.6 ? 0 : (percentualDecimal < 0.8 ? 1 : (percentualDecimal <= 1.0 ? 2 : 3));

      const { comissaoCPCP, comissaoSemCPCP } = calcularComissoes(prodIndiv, rules, faixaIdx);

      return {
        user, meta: metaIndividual, totalVendas: totalIndiv, totalVendasEquipe: totalEquipe,
        percentual: percentualDecimal * 100, projecao: calcularProjecao(totalIndiv, metaIndividual),
        comissaoCPCP, comissaoSemCPCP,
        tabelaIndiv: Object.keys(prodIndiv).map(k => ({ prod: k, qtd: prodIndiv[k] })),
        tabelaEquipe: Object.keys(prodEquipe).map(k => ({ prod: k, qtd: prodEquipe[k] }))
      };
    }, 300); 
  } catch (e) { return { error: e.message }; }
}

function calcularComissoes(produtosVendidos, regrasComissao, faixaMeta) {
  let comissaoCPCP = 0;
  let comissaoSemCPCP = 0;

  for (const [prod, qtd] of Object.entries(produtosVendidos)) {
    if (qtd === 0) continue;
    const pUpper = prod.toUpperCase().trim();
    const regra = regrasComissao[pUpper];

    if (regra) {
      const valorUnitario = regra.tipo.includes("FIXO") ? regra.fixo : regra.faixas[faixaMeta];
      const valorTotal = qtd * valorUnitario;

      if (regra.tipo.includes("CPCP")) {
        comissaoCPCP += valorTotal;
      } else {
        comissaoSemCPCP += valorTotal;
      }
    }
  }
  return { comissaoCPCP, comissaoSemCPCP };
}

// --- EQUIPE ---
function getTeamData(filtroEmail) {
  try {
    const user = getUserDetails();
    if (!['supervisor', 'adm'].includes(user.cargo.toLowerCase())) return { error: "Acesso Negado." };

    const cacheKey = `team_data_${user.email}_${filtroEmail || 'all'}`;
    // Cache de 5 minutos para os dados da equipe
    return getCachedData(cacheKey, () => {
      const ss = getSpreadsheet();
      const wsVendas = ss.getSheetByName(SHEETS.VENDAS);
      const wsUsers = ss.getSheetByName(SHEETS.USUARIOS);
      
      let membros = [];
      if(wsUsers) {
        wsUsers.getRange(2, 1, wsUsers.getLastRow()-1, 4).getValues().forEach(row => {
          if (user.cargo.toLowerCase() === 'adm' || row[2] === user.equipe) {
            membros.push({ email: row[0], nome: row[1], equipe: row[2], cargo: row[3] });
          }
        });
      }

      const diarias = {}, produtos = {};
      let total = 0;
      
      const todosProdutos = getProductList();
      todosProdutos.forEach(p => produtos[p] = 0);

      if (wsVendas && wsVendas.getLastRow() >= 2) {
        wsVendas.getRange(2, 1, wsVendas.getLastRow()-1, 6).getValues().forEach(row => {
          const emailVenda = row[3].toString().trim();
          const equipeVenda = row[4].toString().trim();
          let incluir = filtroEmail ? (emailVenda === filtroEmail) : (user.cargo.toLowerCase() === 'adm' || equipeVenda === user.equipe);
          
          if (incluir) {
            const dia = Utilities.formatDate(new Date(row[0]), "GMT-3", "dd/MM");
            const qtd = parseInt(row[5]) || 0;
            diarias[dia] = (diarias[dia] || 0) + qtd;
            produtos[row[1]] = (produtos[row[1]] || 0) + qtd;
            total += qtd;
          }
        });
      }

      return {
        membros, totalGeral: total, metaEquipe: getMetaPorEquipe(user.equipe),
        grafico: Object.keys(diarias).sort().map(d => ({ dia: d, qtd: diarias[d] })),
        listaProdutos: Object.keys(produtos).map(p => ({ prod: p, qtd: produtos[p] }))
      };
    }, 300);
  } catch (e) { return { error: e.message }; }
}

// --- ESCRITA NO BANCO ---
function registerSale(form) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const u = getUserDetails();
    const dataVenda = new Date(form.data + "T12:00:00");
    getSpreadsheet().getSheetByName(SHEETS.VENDAS).appendRow([dataVenda, form.produto, form.protocolo, u.email, u.equipe, parseInt(form.quantidade)]);
    
    // Invalida o cache para que os próximos carregamentos peguem os dados novos
    const cache = CacheService.getScriptCache();
    cache.remove(`tab1_data_${u.email}`);
    cache.remove(`team_data_${u.email}_all`);

    return { success: true };
  } catch (e) { return { error: "Erro: " + e.message }; }
  finally { lock.releaseLock(); }
}

function updateMeta(nomeEquipe, valorMeta) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const user = getUserDetails();
    if (user.cargo.toLowerCase() === 'atendente') return { error: "Sem permissão." };
    const equipeAlvo = nomeEquipe ? nomeEquipe : user.equipe;

    const ws = getSpreadsheet().getSheetByName(SHEETS.METAS);
    const data = ws.getRange(1, 1, ws.getLastRow() || 1, 1).getValues().flat();
    let rowIndex = data.findIndex(e => e.toString().trim() === equipeAlvo.trim()) + 1;

    if (rowIndex > 0) ws.getRange(rowIndex, 2).setValue(valorMeta);
    else ws.appendRow([equipeAlvo, valorMeta]);

    // Limpa o cache de todos os dados que podem ser afetados pela mudança de meta
    CacheService.getScriptCache().removeAll([`tab1_data_${user.email}`, `team_data_${user.email}_all`]);
    // Em um sistema mais complexo, seria necessário invalidar o cache de todos os usuários da equipe.

    registrarLog("ALTERAR_META", `Equipe: ${equipeAlvo} | Novo Valor: ${valorMeta} | Por: ${user.email}`);
    return { success: true, message: `Meta da equipe ${equipeAlvo} atualizada!` };
  } catch(e) { return { error: e.message }; }
  finally { lock.releaseLock(); }
}

function addUser(form) {
  try {
    const u = getUserDetails();
    const isAdm = u.cargo.toLowerCase() === 'adm', isSup = u.cargo.toLowerCase() === 'supervisor';
    if (!isAdm && !isSup) return { error: "Sem permissão." };

    const eqDestino = isAdm && form.equipe ? form.equipe : u.equipe;
    const cgDestino = isAdm && form.cargo ? form.cargo : "Atendente";
    getSpreadsheet().getSheetByName(SHEETS.USUARIOS).appendRow([form.email, form.nome, eqDestino, cgDestino]);
    
    // Invalida caches relacionados a listas de usuários e equipes
    CacheService.getScriptCache().removeAll(['unique_teams', `team_data_${u.email}_all`]);

    registrarLog("NOVO_USUARIO", `Nome: ${form.nome} | Eq: ${eqDestino} | Por: ${u.email}`);
    return { success: true };
  } catch (e) { return { error: e.message }; }
}

function deleteUser(emailAlvo) {
  try {
    const u = getUserDetails();
    const isAdm = u.cargo.toLowerCase() === 'adm', isSup = u.cargo.toLowerCase() === 'supervisor';
    if (!isAdm && !isSup) return { error: "Sem permissão." };

    const ws = getSpreadsheet().getSheetByName(SHEETS.USUARIOS);
    const data = ws.getRange(1, 1, ws.getLastRow(), 3).getValues(); 

    for(let i = 1; i < data.length; i++) {
      if(data[i][0] == emailAlvo) {
        if (!isAdm && data[i][2] !== u.equipe) return { error: "Usuário de outra equipe." };
        ws.deleteRow(i + 1);
        
        CacheService.getScriptCache().removeAll([`user_details_${emailAlvo}`, 'unique_teams', `team_data_${u.email}_all`]);

        registrarLog("EXCLUIR_USUARIO", `Email: ${emailAlvo} | Por: ${u.email}`);
        return { success: true }; 
      }
    }
    return { error: "Não encontrado." };
  } catch (e) { return { error: e.message }; }
}

function archiveData(urlDestino) {
  try {
    const user = getUserDetails();
    if (user.cargo.toLowerCase() !== 'adm') return { error: "Apenas ADM." };
    const wsVendas = getSpreadsheet().getSheetByName(SHEETS.VENDAS);
    if (wsVendas.getLastRow() < 2) return { error: "Sem vendas." };

    const valores = wsVendas.getRange(2, 1, wsVendas.getLastRow() - 1, 6).getValues();
    const ssDestino = SpreadsheetApp.openByUrl(urlDestino);
    let wsDestino = ssDestino.insertSheet("Bkp_" + Utilities.formatDate(new Date(), "GMT-3", "ddMM_HHmm"));
    wsDestino.appendRow(["DATA", "PRODUTO", "PROTOCOLO", "EMAIL", "EQUIPE", "QTD"]);
    wsDestino.getRange(2, 1, valores.length, 6).setValues(valores);
    wsVendas.deleteRows(2, wsVendas.getLastRow() - 1);

    CacheService.getScriptCache().flush(); // Limpa todo o cache do script

    registrarLog("ARQUIVAMENTO", "Salvo em: " + urlDestino);
    return { success: true, message: "Base de vendas limpa e arquivada!" };
  } catch (e) { return { error: e.message }; }
}

function exportarRelatorioEquipe() {
  try {
    const user = getUserDetails();
    if (!['supervisor', 'adm'].includes(user.cargo.toLowerCase())) return { error: "Sem permissão." };
    const dados = getSpreadsheet().getSheetByName(SHEETS.VENDAS).getRange(1, 1, getSpreadsheet().getSheetByName(SHEETS.VENDAS).getLastRow(), 6).getValues();
    const filtro = dados.filter((row, idx) => idx === 0 || row[4] === user.equipe || user.cargo.toLowerCase() === 'adm');
    const arquivo = DriveApp.createFile("Relatorio_" + user.equipe + ".csv", filtro.map(row => row.join(";")).join("\n"), MimeType.CSV);
    arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    registrarLog("EXPORTAR_RELATORIO", "Equipe: " + user.equipe);
    return { url: arquivo.getDownloadUrl(), id: arquivo.getId() };
  } catch (e) { return { error: e.message }; }
}
function deletarArquivoTemp(id) { try { DriveApp.getFileById(id).setTrashed(true); } catch(e) {} }

function getAuditLogs() {
  try {
    const user = getUserDetails();
    if (user.cargo.toLowerCase() !== 'adm') {
      return { error: "Acesso negado. Apenas administradores podem ver os logs." };
    }
    
    const ws = getSpreadsheet().getSheetByName(SHEETS.LOGS);
    if (!ws || ws.getLastRow() < 2) {
      return [];
    }
    
    const data = ws.getRange(2, 1, ws.getLastRow() - 1, 4).getValues();
    
    // Retorna os últimos 200 logs, em ordem decrescente (mais novos primeiro)
    return data.map(row => ({
      timestamp: Utilities.formatDate(new Date(row[0]), "GMT-3", "dd/MM/yy HH:mm"),
      user: row[1],
      action: row[2],
      details: row[3]
    })).reverse().slice(0, 200);
    
  } catch (e) { return { error: "Erro ao buscar logs: " + e.message }; }
}

/**
 * Função para ser executada por um gatilho de tempo para aquecer o cache.
 * Isso pré-carrega dados globais para garantir que o sistema esteja sempre rápido.
 */
function warmUpCache() {
  try {
    registrarLog("CACHE_WARMUP", "Iniciando aquecimento do cache...");
    
    // Chama as funções que buscam dados globais para popular o cache.
    getCommissionRules();
    getProductList();
    getUniqueTeams();
    
    registrarLog("CACHE_WARMUP", "Cache aquecido com sucesso.");
  } catch (e) {
    registrarLog("CACHE_WARMUP_ERROR", "Erro: " + e.message);
  }
}