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
function registrarLog(acao, detalhes) {
  try {
    const ss = getSpreadsheet();
    let ws = ss.getSheetByName(SHEETS.LOGS);
    if (!ws) { ws = ss.insertSheet(SHEETS.LOGS); ws.appendRow(["DATA/HORA", "USUÁRIO", "AÇÃO", "DETALHES"]); }
    const agora = Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy HH:mm:ss");
    ws.appendRow([agora, Session.getActiveUser().getEmail(), acao, detalhes]);
  } catch(e) {}
}

function getUserDetails() {
  try {
    const userEmail = Session.getActiveUser().getEmail();
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
  } catch (e) { return { error: e.message }; }
}

function getUniqueTeams() {
  const ws = getSpreadsheet().getSheetByName(SHEETS.USUARIOS);
  const data = ws.getRange(2, 3, ws.getLastRow()-1, 1).getValues().flat();
  return [...new Set(data)].filter(String).sort();
}

function getProductList() {
  const ws = getSpreadsheet().getSheetByName(SHEETS.PRODUTOS);
  return ws ? ws.getRange(3, 1, ws.getLastRow()-2, 1).getValues().flat().filter(String) : [];
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
  const ws = getSpreadsheet().getSheetByName(SHEETS.PRODUTOS);
  const rules = {};
  if(!ws) return {};
  ws.getRange(2, 1, ws.getLastRow()-1, 7).getValues().forEach(r => {
    if(r[0]) rules[r[0].toString().toUpperCase().trim()] = { tipo: r[1].toString().toUpperCase().trim(), faixas: [Number(r[2]), Number(r[3]), Number(r[4]), Number(r[5])], fixo: Number(r[6]) };
  });
  return rules;
}

// --- DASHBOARD (RESUMO) ---
function getTab1Data() {
  try {
    const user = getUserDetails();
    if (user.error) throw new Error(user.error);

    const metaIndividual = getMetaPorEquipe(user.equipe);
    const wsVendas = getSpreadsheet().getSheetByName(SHEETS.VENDAS);
    
    let totalIndiv = 0, totalEquipe = 0;
    const prodIndiv = {}, prodEquipe = {};

    // NOVO: Busca todos os produtos e inicializa as tabelas com zero
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
    
    let comissaoCPCP = 0, comissaoSemCPCP = 0;
    for (const [prod, qtd] of Object.entries(prodIndiv)) {
       if (qtd === 0) continue; // Pula cálculos matemáticos desnecessários
       const pUpper = prod.toUpperCase().trim(); 
       let val = 0;
       
       if (pUpper === "CPCP") { val = qtd * 30.00; comissaoCPCP += val; } 
       else if (["UPGRADE PLATINUM", "UPGRADE ULTRA", "UPGRADE ULTRA (BLACK OU INFINITE)"].includes(pUpper)) { val = qtd * (pUpper === "UPGRADE PLATINUM" ? 2.00 : 4.00); comissaoSemCPCP += val; } 
       else if (rules[pUpper]) {
         val = qtd * (rules[pUpper].tipo.includes("FIXO") ? rules[pUpper].fixo : rules[pUpper].faixas[faixaIdx]);
         comissaoSemCPCP += val;
       }
    }

    return {
      user, meta: metaIndividual, totalVendas: totalIndiv, totalVendasEquipe: totalEquipe,
      percentual: percentualDecimal * 100, projecao: calcularProjecao(totalIndiv, metaIndividual),
      comissaoCPCP, comissaoSemCPCP,
      tabelaIndiv: Object.keys(prodIndiv).map(k => ({ prod: k, qtd: prodIndiv[k] })),
      tabelaEquipe: Object.keys(prodEquipe).map(k => ({ prod: k, qtd: prodEquipe[k] }))
    };
  } catch (e) { return { error: e.message }; }
}

// --- EQUIPE ---
function getTeamData(filtroEmail) {
  try {
    const user = getUserDetails();
    if (!['supervisor', 'adm'].includes(user.cargo.toLowerCase())) return { error: "Acesso Negado." };

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
    
    // NOVO: Inicializa a tabela da equipe com todos os produtos zerados também
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
        ws.deleteRow(i + 1); registrarLog("EXCLUIR_USUARIO", `Email: ${emailAlvo} | Por: ${u.email}`);
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