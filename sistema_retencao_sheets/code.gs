// --- 1. RENDERIZAÇÃO E SISTEMA --- new
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate().setTitle('Retenção')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getUserInfo() {
  const email = Session.getActiveUser().getEmail();
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
}

// --- 2. CADASTRO E GOVERNANÇA ---

function getSupervisoresList() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  const data = sheet.getDataRange().getValues();
  // Filtra quem é supervisor ou ADM
  return data.slice(1)
    .filter(r => r[3] === 'Supervisor' || r[3] === 'ADM')
    .map(r => r[1] + ' ' + r[2]); // Retorna Nome + Sobrenome
}

function cadastrarUsuario(dados) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // Fila de espera de até 10 segundos
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Usuarios');
    const data = sheet.getDataRange().getValues();
    
    let linhaDoUsuario = -1;
    
    // Procura se o e-mail já está cadastrado
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === dados.email) {
        linhaDoUsuario = i + 1; // +1 porque a planilha começa no índice 1
        break;
      }
    }

    if (linhaDoUsuario !== -1) {
      // MELHORIA: Atualiza usuário existente (Colunas B até E)
      sheet.getRange(linhaDoUsuario, 2, 1, 4).setValues([[
        dados.nome,
        dados.sobrenome,
        dados.cargo,
        dados.supervisor
      ]]);
      return "Usuário atualizado com sucesso!";
    } else {
      // Cria novo usuário
      sheet.appendRow([
        dados.email,
        dados.nome,
        dados.sobrenome,
        dados.cargo,
        dados.supervisor 
      ]);
      return "Usuário cadastrado com sucesso!";
    }
  } catch (e) {
    return "Erro no cadastro: " + e.message;
  } finally {
    lock.releaseLock();
  }
}

function excluirUsuario(email) {
   const lock = LockService.getScriptLock();
   try {
     lock.waitLock(10000);
     const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
     const data = sheet.getDataRange().getValues();
     for(let i=0; i<data.length; i++){
       if(data[i][0] == email) {
         sheet.deleteRow(i+1);
         return "Usuário excluído.";
       }
     }
     return "Erro ao excluir.";
   } catch (e) {
     return "Erro: " + e.message;
   } finally {
     lock.releaseLock();
   }
}

function arquivarMes(idPlanilhaDestino) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Processo mais pesado, espera até 30s
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheetByName('Dados');
    const data = sourceSheet.getDataRange().getValues();

    if (data.length <= 1) return "Não há dados para arquivar.";

    const destSS = SpreadsheetApp.openById(idPlanilhaDestino);
    let destSheet = destSS.getSheetByName('Historico');
    if (!destSheet) destSheet = destSS.insertSheet('Historico');

    const rows = data.slice(1); // Pega dados sem cabeçalho
    const lastRow = destSheet.getLastRow();
    
    // Cola no destino
    if (lastRow === 0) {
      destSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    } else {
      destSheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    SpreadsheetApp.flush(); 
    sourceSheet.deleteRows(2, rows.length);
    
    return "Sucesso! Dados movidos para o arquivo.";
  } catch (e) {
    return "Erro no arquivamento: " + e.message;
  } finally {
    lock.releaseLock();
  }
}

// --- 3. REGISTRO DE DADOS ---
function salvarRetencao(form) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Dados');
    const user = getUserInfo();
    
    const hoje = new Date();
    
    // Estrutura: [Data, Email, Nome, Supervisor, Tipo, Sub, Res, Status]
    sheet.appendRow([
      hoje, 
      user.email, 
      user.nome,
      user.supervisor || '-',
      form.tipo,
      form.subProduto || '-',
      form.resultado,
      'Ativo'
    ]);
    
    return "Registro salvo com sucesso!";
  } catch (e) {
    return "Erro ao salvar: " + e.message;
  } finally {
    lock.releaseLock();
  }
}

function getUltimosRegistros() {
  try {
    const user = getUserInfo();
    if (!user || !user.email) return []; 

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
          subProduto: String(data[i][5] || ''), // <-- NOVO: Pegando o detalhe do Massificado (Índice 5)
          resultado: String(data[i][6] || '')
        });
        
        if (ultimos.length === 5) break;
      }
    }
    
    return ultimos;

  } catch (e) {
    throw new Error("Falha ao buscar registros: " + e.message);
  }
}

function excluirRegistro(linha) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Dados');
    const user = getUserInfo();
    
    // Trava de segurança: garante que a pessoa só exclua o próprio registro
    const emailDaLinha = sheet.getRange(linha, 2).getValue();
    if(emailDaLinha !== user.email && user.cargo !== 'ADM') {
      return "Erro: Você só pode excluir os seus próprios registros.";
    }
    
    sheet.deleteRow(linha);
    return "Registro excluído com sucesso!";
  } catch(e) {
    return "Erro ao excluir: " + e.message;
  } finally {
    lock.releaseLock();
  }
}

// --- 4. DASHBOARD E RELATÓRIOS ---

function getDashboardData() {
  const user = getUserInfo();
  if(user.error) return null;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Dados');
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);

  // 1. Dados Pessoais
  const meusDados = rows.filter(row => row[1] === user.email);
  const statsPessoal = processarEstatisticas(meusDados);

  // 2. Dados da Equipe (Se tiver supervisor)
  let statsEquipe = null;
  if (user.supervisor && user.supervisor !== '-') {
     // Filtra todos os registros onde a coluna Supervisor (índice 3) bate com o sup do usuário
     const dadosEquipe = rows.filter(row => row[3] === user.supervisor);
     statsEquipe = processarEstatisticas(dadosEquipe);
  }

  return {
    pessoal: statsPessoal,
    equipe: statsEquipe
  };
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

function getSupervisorData(filtroEmail) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsDados = ss.getSheetByName("Dados");
  const wsUsers = ss.getSheetByName("Usuarios");
  const emailLogado = Session.getActiveUser().getEmail();
  
  const usersData = wsUsers.getRange(2, 1, wsUsers.getLastRow()-1, 5).getValues();
  const userLogado = usersData.find(u => u[0] === emailLogado);
  
  if (!userLogado) return null;

  const nomeSupervisor = userLogado[1] + ' ' + userLogado[2]; 
  let equipeEmails = [];
  let listaMembros = []; 

  if (userLogado[3] === 'ADM') {
      equipeEmails = usersData.map(u => u[0]);
      listaMembros = usersData.map(u => ({email: u[0], nome: u[1] + ' ' + u[2]}));
  } else if (userLogado[3] === 'Supervisor') {
      const equipe = usersData.filter(u => u[4] === nomeSupervisor);
      equipeEmails = equipe.map(u => u[0]);
      listaMembros = equipe.map(u => ({email: u[0], nome: u[1] + ' ' + u[2]}));
      if(!equipeEmails.includes(emailLogado)) equipeEmails.push(emailLogado);
  } else {
      return null; 
  }

  const dados = wsDados.getDataRange().getValues();
  dados.shift(); // Remove cabeçalho
  
  let stats = {
    cartao: { total:0, retidoTotal:0, retidoArg:0, retidoInc:0, cancelado:0 }, // Adicionado retidoInc
    conta:  { total:0, retido:0, cancelado:0 },
    pontos: { cashback:0, milhas:0 },
    massificado: {}
  };
  
  let diario = {};

  dados.forEach(row => {
    const dataReg = row[0]; 
    const emailAtendente = row[1]; 
    const tipo = row[4];
    const sub = row[5];
    const res = row[6];

    if (!equipeEmails.includes(emailAtendente)) return;
    if (filtroEmail && emailAtendente !== filtroEmail) return;

    let diaKey = "";
    if (dataReg instanceof Date) {
      diaKey = Utilities.formatDate(dataReg, Session.getScriptTimeZone(), "dd/MM/yyyy");
    } else {
      diaKey = String(dataReg).split(" ")[0]; 
    }

    if (!diario[diaKey]) {
      diario[diaKey] = {
        cc: { atendido:0, retido:0, retidoArg:0, canc:0 }, 
        cd: { atendido:0, retido:0, canc:0 }
      };
    }

    if (tipo === 'Cartão de Crédito') {
        stats.cartao.total++;
        diario[diaKey].cc.atendido++;
        if (res.includes('Retido')) {
            stats.cartao.retidoTotal++;
            diario[diaKey].cc.retido++;
            if (res.includes('Argumentação')) {
                stats.cartao.retidoArg++;
                diario[diaKey].cc.retidoArg++;
            }
            if (res.includes('Incentivo')) stats.cartao.retidoInc++; // Adicionado
        } else if (res.includes('Cancelado')) {
            stats.cartao.cancelado++;
            diario[diaKey].cc.canc++;
        }
    } 
    else if (tipo === 'Conta Digital') {
        stats.conta.total++;
        diario[diaKey].cd.atendido++;
        if (res.includes('Retido')) {
            stats.conta.retido++;
            diario[diaKey].cd.retido++;
        } else if (res.includes('Cancelado')) {
            stats.conta.cancelado++;
            diario[diaKey].cd.canc++;
        }
    }
    // --- CORREÇÃO AQUI: TROCA DE PONTOS ---
    else if (tipo === 'Troca de Pontos') {
        if (res.includes('Cashback')) stats.pontos.cashback++;
        if (res.includes('Milhas')) stats.pontos.milhas++;
    }
    // --- CORREÇÃO AQUI: MASSIFICADOS ---
    else if (tipo === 'Massificado') {
       const nomeM = sub || 'Outros';
       if (!stats.massificado[nomeM]) stats.massificado[nomeM] = { arg:0, troca:0, canc:0 };
       if (res.includes('Argumentação')) stats.massificado[nomeM].arg++;
       else if (res.includes('Troca')) stats.massificado[nomeM].troca++;
       else if (res.includes('Cancelado')) stats.massificado[nomeM].canc++;
    }
  });

  return { geral: stats, diario: diario, equipe: listaMembros };
}
// --- 5. EXPORTAÇÃO DE RELATÓRIO (CSV) ---
function gerarRelatorioCSV(inicio, fim, tipoRelatorio) {
  const user = getUserInfo(); 
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Dados'); 
  
  if(!sheet) return "Erro: Aba de Dados não encontrada.";

  const data = sheet.getDataRange().getValues();
  
  const dInicio = new Date(inicio); dInicio.setHours(0,0,0,0);
  const dFim = new Date(fim); dFim.setHours(23,59,59,999);

  let csvContent = "Data,Email,Nome,Supervisor,Produto,SubProduto,Resultado\n";

  const filtrados = data.slice(1).filter(row => {
    const dataRow = new Date(row[0]); 
    if (dataRow < dInicio || dataRow > dFim) return false;

    if (tipoRelatorio === 'Pessoal') {
       return row[1] === user.email;
    } 
    else if (tipoRelatorio === 'Equipe') {
       if (user.cargo === 'ADM') return true;
       const nomeCompleto = user.nome + ' ' + user.sobrenome;
       return row[3] === nomeCompleto || row[1] === user.email;
    }
    return false;
  });

  if (filtrados.length === 0) return "Vazio";

  filtrados.forEach(row => {
    let dataFormatada = Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), "dd/MM/yyyy");
    let linha = `"${dataFormatada}","${row[1]}","${row[2]}","${row[3]}","${row[4]}","${row[5]}","${row[6]}"`;
    csvContent += linha + "\n";
  });

  return csvContent;
}