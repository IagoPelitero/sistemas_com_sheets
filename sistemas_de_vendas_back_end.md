Back-end do codigo.gs do apps script de vendas pelo sheets

~~~js
/**
 * SISTEMA DE VENDAS - VERSÃO PORTO (V5 - GESTÃO DE METAS)
 */

const SPREADSHEET_ID = 'id_sheets'; 

const SHEETS = {
  VENDAS: "vendas_ativas",
  PRODUTOS: "produtos_comissao",
  USUARIOS: "equipes_e_usuarios",
  METAS: "metas_e_resumo"
};

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Sistema de Vendas Porto')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// --- LÓGICA DE USUÁRIOS ---
function getUserDetails() {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const ss = getSpreadsheet();
    const ws = ss.getSheetByName(SHEETS.USUARIOS);
    const data = ws.getRange(2, 1, ws.getLastRow() - 1, 4).getValues();
    
    const found = data.find(row => row[0].toString().toLowerCase() === userEmail.toLowerCase());

    if (found) {
      const user = {
        email: found[0],
        nome: found[1],
        equipe: found[2],
        cargo: found[3],
        supervisor: ""
      };
      if (['atendente', 'operador'].includes(user.cargo.toLowerCase())) {
        const supRow = data.find(r => r[2] === user.equipe && r[3].toLowerCase() === 'supervisor');
        user.supervisor = supRow ? supRow[1] : "Não atribuído";
      }
      return user;
    }
    return { email: userEmail, nome: "Visitante", equipe: "Geral", cargo: "Visitante" };
  } catch (e) { return { error: e.message }; }
}

function getMetaPorEquipe(nomeEquipe) {
  try {
    const ws = getSpreadsheet().getSheetByName(SHEETS.METAS);
    if (!ws || ws.getLastRow() < 1) return 50;
    const dados = ws.getRange(1, 1, ws.getLastRow(), 2).getValues();
    const found = dados.find(r => r[0].toString().trim() === nomeEquipe?.trim());
    return (found && found[1]) ? parseInt(found[1]) : (parseInt(ws.getRange("B1").getValue()) || 50);
  } catch (e) { return 50; }
}

// --- NOVA FUNÇÃO: LISTAR EQUIPES ÚNICAS (PARA O ADM) ---
function getUniqueTeams() {
  const ws = getSpreadsheet().getSheetByName(SHEETS.USUARIOS);
  const data = ws.getRange(2, 3, ws.getLastRow()-1, 1).getValues().flat();
  // Retorna lista única e remove vazios
  return [...new Set(data)].filter(String).sort();
}

// --- NOVA FUNÇÃO: ATUALIZAR META ---
function updateMeta(nomeEquipe, valorMeta) {
  try {
    const user = getUserDetails();
    
    // Verificação de segurança
    if (user.cargo.toLowerCase() === 'atendente') return { error: "Sem permissão." };
    if (user.cargo.toLowerCase() === 'supervisor' && user.equipe !== nomeEquipe) {
      return { error: "Supervisores só podem alterar a meta da própria equipe." };
    }

    const ws = getSpreadsheet().getSheetByName(SHEETS.METAS);
    const data = ws.getRange(1, 1, ws.getLastRow() || 1, 1).getValues().flat();
    
    let rowIndex = -1;
    // Procura a linha da equipe
    for (let i = 0; i < data.length; i++) {
      if (data[i].toString().trim() === nomeEquipe.trim()) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex > 0) {
      // Atualiza existente
      ws.getRange(rowIndex, 2).setValue(valorMeta);
    } else {
      // Cria nova linha se não existir
      ws.appendRow([nomeEquipe, valorMeta]);
    }

    return { success: true, message: `Meta da equipe ${nomeEquipe} atualizada para ${valorMeta}` };

  } catch(e) { return { error: e.message }; }
}

function getProductList() {
  const ws = getSpreadsheet().getSheetByName(SHEETS.PRODUTOS);
  return ws ? ws.getRange(3, 1, ws.getLastRow()-2, 1).getValues().flat().filter(String) : [];
}

function getCommissionRules() {
  const ws = getSpreadsheet().getSheetByName(SHEETS.PRODUTOS);
  const rules = {};
  if(!ws) return {};
  
  const rows = ws.getRange(2, 1, ws.getLastRow()-1, 7).getValues();
  
  rows.forEach(r => {
    if(r[0]) {
      const key = r[0].toString().toUpperCase().trim();
      rules[key] = { 
        tipo: r[1].toString().toUpperCase().trim(), 
        faixas: [Number(r[2]), Number(r[3]), Number(r[4]), Number(r[5])], 
        fixo: Number(r[6]) 
      };
    }
  });
  return rules;
}

// --- DADOS DO DASHBOARD ---
function getTab1Data() {
  try {
    const user = getUserDetails();
    if (user.error) throw new Error(user.error);

    const metaIndividual = getMetaPorEquipe(user.equipe);
    const ss = getSpreadsheet();
    const wsVendas = ss.getSheetByName(SHEETS.VENDAS);
    const rules = getCommissionRules();

    let totalVendasIndiv = 0;
    let totalVendasEquipe = 0;
    const vendasPorProdIndiv = {};
    const vendasPorProdEquipe = {};

    if (wsVendas && wsVendas.getLastRow() >= 2) {
      const dadosVendas = wsVendas.getRange(2, 1, wsVendas.getLastRow() - 1, 6).getValues();

      dadosVendas.forEach(row => {
        const prod = row[1].toString().trim();
        const email = row[3].toString().trim();
        const equipe = row[4].toString().trim();
        const qtd = parseInt(row[5]) || 0;

        if (!prod || qtd === 0) return;

        if (equipe === user.equipe) {
          totalVendasEquipe += qtd;
          vendasPorProdEquipe[prod] = (vendasPorProdEquipe[prod] || 0) + qtd;
        }

        if (email === user.email) {
          totalVendasIndiv += qtd;
          vendasPorProdIndiv[prod] = (vendasPorProdIndiv[prod] || 0) + qtd;
        }
      });
    }

    const percentual = metaIndividual > 0 ? totalVendasIndiv / metaIndividual : 0;
    let faixaIdx = percentual < 0.6 ? 0 : (percentual < 0.8 ? 1 : (percentual <= 1.0 ? 2 : 3));
    
    let comissaoCPCP = 0;
    let comissaoSemCPCP = 0;
    const PROD_CPCP = "CPCP";
    const PROD_UPGRADES = ["UPGRADE PLATINUM", "UPGRADE ULTRA", "UPGRADE ULTRA (BLACK OU INFINITE)"];

    for (const [prod, qtd] of Object.entries(vendasPorProdIndiv)) {
       const pUpper = prod.toUpperCase().trim(); 
       let val = 0;

       if (pUpper === PROD_CPCP) {
         val = qtd * 30.00;
         comissaoCPCP += val;
       } 
       else if (PROD_UPGRADES.includes(pUpper)) {
         val = qtd * (pUpper === "UPGRADE PLATINUM" ? 2.00 : 4.00);
         comissaoSemCPCP += val;
       } 
       else if (rules[pUpper]) {
         const r = rules[pUpper];
         if (r.tipo.includes("FIXO")) {
           val = qtd * r.fixo;
         }
         else if (r.tipo.includes("PERCENTUAL")) {
           val = qtd * r.faixas[faixaIdx];
         }
         comissaoSemCPCP += val;
       }
    }

    return {
      user: user,
      meta: metaIndividual,
      totalVendas: totalVendasIndiv,
      totalVendasEquipe: totalVendasEquipe,
      percentual: percentual * 100,
      comissaoCPCP: comissaoCPCP,
      comissaoSemCPCP: comissaoSemCPCP,
      tabelaIndiv: Object.keys(vendasPorProdIndiv).map(k => ({ prod: k, qtd: vendasPorProdIndiv[k] })),
      tabelaEquipe: Object.keys(vendasPorProdEquipe).map(k => ({ prod: k, qtd: vendasPorProdEquipe[k] }))
    };

  } catch (e) { return { error: e.message }; }
}

// --- GESTÃO DA EQUIPE ---
function getTeamData(filtroEmail) {
  try {
    const user = getUserDetails();
    if (!['supervisor', 'adm'].includes(user.cargo.toLowerCase())) return { error: "Acesso Negado." };

    const ss = getSpreadsheet();
    const wsVendas = ss.getSheetByName(SHEETS.VENDAS);
    const wsUsers = ss.getSheetByName(SHEETS.USUARIOS);
    
    // --- NOVO: Pega a meta atual da equipe para exibir no card do supervisor ---
    const metaAtual = getMetaPorEquipe(user.equipe);

    let membros = [];
    if(wsUsers) {
      const uData = wsUsers.getRange(2, 1, wsUsers.getLastRow()-1, 4).getValues();
      uData.forEach(row => {
        if (user.cargo.toLowerCase() === 'adm' || row[2] === user.equipe) {
          membros.push({ email: row[0], nome: row[1], equipe: row[2], cargo: row[3] });
        }
      });
    }

    const vendasDiarias = {};
    const vendasPorProduto = {};
    let totalFiltrado = 0;

    if (wsVendas && wsVendas.getLastRow() >= 2) {
      const data = wsVendas.getRange(2, 1, wsVendas.getLastRow()-1, 6).getValues();

      data.forEach(row => {
        const dataVenda = new Date(row[0]);
        const emailVenda = row[3].toString().trim();
        const equipeVenda = row[4].toString().trim();
        const prod = row[1].toString().trim();
        const qtd = parseInt(row[5]) || 0;

        let incluir = false;
        if (filtroEmail) {
           if (emailVenda === filtroEmail) incluir = true;
        } else {
           if (user.cargo.toLowerCase() === 'adm' || equipeVenda === user.equipe) incluir = true;
        }

        if (incluir) {
           const diaKey = Utilities.formatDate(dataVenda, Session.getScriptTimeZone(), "yyyy-MM-dd");
           vendasDiarias[diaKey] = (vendasDiarias[diaKey] || 0) + qtd;
           vendasPorProduto[prod] = (vendasPorProduto[prod] || 0) + qtd;
           totalFiltrado += qtd;
        }
      });
    }

    const grafico = Object.keys(vendasDiarias).sort().map(dateStr => {
      const parts = dateStr.split('-');
      return { dia: `${parts[2]}/${parts[1]}`, qtd: vendasDiarias[dateStr] };
    });

    const listaProdutos = Object.keys(vendasPorProduto).map(p => ({ prod: p, qtd: vendasPorProduto[p] }));

    return {
      membros: membros,
      grafico: grafico,
      listaProdutos: listaProdutos,
      totalGeral: totalFiltrado,
      metaEquipe: metaAtual // Retorna a meta para preencher o input do supervisor
    };

  } catch (e) { return { error: e.message }; }
}

function deleteUser(emailAlvo) {
  const user = getUserDetails();
  if (!['supervisor', 'adm'].includes(user.cargo.toLowerCase())) return { error: "Sem permissão" };
  const ws = getSpreadsheet().getSheetByName(SHEETS.USUARIOS);
  const data = ws.getRange(1, 1, ws.getLastRow(), 1).getValues();
  for(let i=0; i<data.length; i++) {
    if(data[i][0] == emailAlvo) { ws.deleteRow(i + 1); return { success: true }; }
  }
  return { error: "Usuário não encontrado" };
}

function archiveData(urlDestino) {
  try {
    const user = getUserDetails();
    if (user.cargo.toLowerCase() !== 'adm') return { error: "Apenas ADM pode arquivar." };
    if (!urlDestino || !urlDestino.includes("google.com/spreadsheets")) return { error: "URL inválida." };

    const ssOrigem = getSpreadsheet();
    const wsVendas = ssOrigem.getSheetByName(SHEETS.VENDAS);
    if (wsVendas.getLastRow() < 2) return { error: "Sem vendas." };

    const range = wsVendas.getRange(2, 1, wsVendas.getLastRow() - 1, 6);
    const valores = range.getValues();

    const ssDestino = SpreadsheetApp.openByUrl(urlDestino);
    const nomeAba = "Bkp_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "ddMM_HHmm");
    let wsDestino = ssDestino.insertSheet(nomeAba);
    wsDestino.appendRow(["DATA", "PRODUTO", "PROTOCOLO", "EMAIL", "EQUIPE", "QTD"]);
    wsDestino.getRange(2, 1, valores.length, 6).setValues(valores);
    wsVendas.deleteRows(2, wsVendas.getLastRow() - 1);
    return { success: true, message: "Arquivado com sucesso." };
  } catch (e) { return { error: e.message }; }
}

function addUser(form) {
  getSpreadsheet().getSheetByName(SHEETS.USUARIOS).appendRow([form.email, form.nome, form.equipe, form.cargo]);
  return { success: true };
}

function registerSale(form) {
  const u = getUserDetails();
  getSpreadsheet().getSheetByName(SHEETS.VENDAS).appendRow([new Date(form.data), form.produto, form.protocolo, u.email, u.equipe, form.quantidade]);
  return { success: true };
}
~~~
