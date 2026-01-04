Front de registro das retenções

~~~html
<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sistema de Retenção</title>
    
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
    
    <style>
      :root { --primary-color: #004aad; --secondary-color: #34495e; --accent-color: #3498db; }
      body { background-color: #f8f9fa; font-family: 'Segoe UI', system-ui, sans-serif; }
      
      /* Sidebar */
      .sidebar { 
        height: 100vh; 
        background: linear-gradient(180deg, var(--primary-color) 0%, #003380 100%); 
        color: white; 
        position: fixed; 
        width: 250px; 
        padding-top: 20px; 
        z-index: 1000; 
        overflow-y: auto;
      }
      .sidebar h3 { text-align: center; font-weight: 300; letter-spacing: 1px; }
      .sidebar .nav-link { 
        color: rgba(255,255,255,0.8); 
        margin: 5px 15px; 
        border-radius: 8px; 
        transition: all 0.3s; 
        cursor: pointer; 
      }
      .sidebar .nav-link:hover, .sidebar .nav-link.active { 
        background: rgba(255,255,255,0.2); 
        color: white; 
        transform: translateX(5px); 
      }
      .sidebar .nav-link i { margin-right: 10px; width: 20px; text-align: center; }
      
      /* Main Content */
      .main-content { margin-left: 250px; padding: 25px; }
      
      /* Cards & KPIs */
      .card-kpi { border: none; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); transition: transform 0.2s; background: white; }
      .card-kpi:hover { transform: translateY(-3px); }
      
      .hidden { display: none !important; }
      
      .user-badge { 
        background: rgba(255,255,255,0.1); 
        padding: 15px; 
        margin: 0 15px 20px; 
        border-radius: 10px; 
        text-align: center; 
        border: 1px solid rgba(255,255,255,0.1);
      }
      
      /* Chart Containers */
      .chart-container-sm { position: relative; height: 180px; width: 100%; }
      .chart-container-lg { position: relative; height: 250px; width: 100%; }
      .sup-filter { max-width: 300px; margin-bottom: 20px; }
      
      /* Tabela com Header Fixo */
      .table-responsive { scrollbar-width: thin; }
    </style>
  </head>
  <body>
    
    <div class="sidebar d-flex flex-column">
      <h3>Retenção</h3>
      <hr style="border-color: rgba(255,255,255,0.2);">
      
      <div id="userInfo">
        <div class="text-center text-white-50 p-3">Carregando usuário...</div>
      </div>
      
      <hr style="border-color: rgba(255,255,255,0.2); margin: 10px 0;">
      
      <nav class="nav flex-column">
        <a class="nav-link hidden" onclick="showTab('tab1')"><i class="bi bi-speedometer2"></i> Status (Meus Resultados)</a>
        <a class="nav-link hidden" onclick="showTab('tab2')"><i class="bi bi-pencil-square"></i> Registrar Retenção</a>
        <a class="nav-link hidden" onclick="showTab('tab3')"><i class="bi bi-graph-up-arrow"></i> Gestão Equipe</a>
        <a class="nav-link hidden" onclick="showTab('tab4')"><i class="bi bi-gear-fill"></i> Administração</a>
      </nav>
    </div>

    <div class="main-content">
      
      <div id="tab1" class="tab-section hidden fade-in">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h3 class="text-secondary mb-0"><i class="bi bi-person-badge"></i> Meus Resultados</h3>
            <button class="btn btn-sm btn-outline-primary" onclick="toggleRelatorio('Pessoal')">
                <i class="bi bi-download"></i> Baixar Meu Histórico
            </button>
        </div>
        
        <div class="row g-3 mb-4">
            <div class="col-md-6">
                <div class="card card-kpi p-3 border-start border-4 border-primary">
                    <h5 class="text-primary small fw-bold text-uppercase">Cartão de Crédito</h5>
                    <div class="d-flex justify-content-between align-items-end mt-2">
                    <div>
                        <div class="display-6 fw-bold text-dark" id="ccPctGeral">0%</div>
                        <small class="text-muted">Retenção Geral</small>
                    </div>
                    <div class="text-end">
                        <div class="fs-5 fw-bold text-success" id="ccPctArg">0%</div>
                        <small class="text-muted">Argum. (Sobre Retidos)</small>
                    </div>
                    </div>
                    <div class="mt-3 pt-2 border-top d-flex justify-content-between small text-muted">
                    <span>Ret: <b id="qtdCCRetGeral">0</b></span>
                    <span>Arg: <b id="qtdCCArg">0</b></span>
                    <span class="text-primary">Inc: <b id="qtdCCInc">0</b></span>
                    <span>Canc: <b id="qtdCCCanc" class="text-danger">0</b></span>
                    </div>
                    <div class="mt-2 text-center bg-light rounded p-1">
                    <small>Estimativa: R$ <span id="ccComissao">0.00</span></small>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6">
                <div class="card card-kpi p-3 border-start border-4 border-success">
                    <h5 class="text-success small fw-bold text-uppercase">Conta Digital</h5>
                    <div class="d-flex justify-content-between align-items-end mt-2">
                    <div>
                        <div class="display-6 fw-bold text-dark" id="cdPctGeral">0%</div>
                        <small class="text-muted">Retenção Geral</small>
                    </div>
                    <div class="text-end">
                        <div class="fs-5 fw-bold text-dark" id="cdComissao">0.00</div>
                        <small class="text-muted">Est. Comissão (R$)</small>
                    </div>
                    </div>
                    <div class="mt-3 pt-2 border-top d-flex justify-content-between small text-muted">
                    <span>Retidos: <b id="qtdCDRet">0</b></span>
                    <span>Canc: <b id="qtdCDCanc" class="text-danger">0</b></span>
                    <span>Total: <b id="qtdCDTotal">0</b></span>
                    </div>
                </div>
            </div>
        </div>

        <div class="row g-3 mb-4">
            <div class="col-md-6">
                <div class="card card-kpi h-100">
                    <div class="card-header bg-primary text-white small fw-bold">
                        <i class="bi bi-calendar-check"></i> Diário: Cartão de Crédito
                    </div>
                    <div class="table-responsive" style="max-height:250px">
                        <table class="table table-sm table-striped mb-0 text-center small">
                            <thead style="position:sticky; top:0; background:white; z-index: 5;">
                                <tr><th>Data</th><th>Retido</th><th>Arg</th><th>% Ret</th><th>Canc</th></tr>
                            </thead>
                            <tbody id="tbodyAgentDailyCC"></tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card card-kpi h-100">
                    <div class="card-header bg-success text-white small fw-bold">
                        <i class="bi bi-calendar-check"></i> Diário: Conta Digital
                    </div>
                    <div class="table-responsive" style="max-height:250px">
                        <table class="table table-sm table-striped mb-0 text-center small">
                            <thead style="position:sticky; top:0; background:white; z-index: 5;">
                                <tr><th>Data</th><th>Retido</th><th>% Ret</th><th>Canc</th></tr>
                            </thead>
                            <tbody id="tbodyAgentDailyCD"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="card card-kpi mb-4 hidden" id="cardTeamCharts">
            <div class="card-header bg-white border-bottom-0 pt-3">
                <h5 class="card-title text-secondary mb-0"><i class="bi bi-people"></i> Visão Geral da Minha Equipe (Supervisor)</h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-4 text-center">
                       <h6 class="small text-uppercase text-muted">Cartão de Crédito</h6>
                       <div class="chart-container-sm"><canvas id="chartTeamCC"></canvas></div>
                       <div class="mt-2 small border-top pt-2">
                           <span class="text-primary fw-bold" title="Retidos">Ret: <span id="teamCCRet">0</span></span> | 
                           <span class="text-success fw-bold" title="Argumentação">Arg: <span id="teamCCArg">0</span></span> | 
                           <span class="text-danger fw-bold" title="Cancelados">Canc: <span id="teamCCCanc">0</span></span>
                       </div>
                    </div>
                    
                    <div class="col-md-4 text-center">
                       <h6 class="small text-uppercase text-muted">Conta Digital</h6>
                       <div class="chart-container-sm"><canvas id="chartTeamCD"></canvas></div>
                       <div class="mt-2 small border-top pt-2">
                           <span class="text-success fw-bold" title="Retidos">Ret: <span id="teamCDRet">0</span></span> | 
                           <span class="text-danger fw-bold" title="Cancelados">Canc: <span id="teamCDCanc">0</span></span>
                       </div>
                    </div>
                    
                    <div class="col-md-4 text-center">
                       <h6 class="small text-uppercase text-muted">Troca de Pontos</h6>
                       <div class="chart-container-sm"><canvas id="chartTeamPts"></canvas></div>
                       <div class="mt-2 small border-top pt-2">
                           <span class="text-info fw-bold" title="Cashback">Cash: <span id="teamPtsCash">0</span></span> | 
                           <span class="text-warning fw-bold" title="Milhas">Milha: <span id="teamPtsMilha">0</span></span>
                       </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="row g-3">
            <div class="col-md-4">
                <div class="card card-kpi p-3">
                    <h6 class="text-info fw-bold">Troca de Pontos (Meu)</h6>
                    <div class="d-flex justify-content-between mt-3">
                    <span>Cashback: <b id="qtdCashback">0</b></span>
                    <span>Milhas: <b id="qtdMilhas">0</b></span>
                    </div>
                </div>
            </div>
            <div class="col-md-8">
                <div class="card card-kpi p-3">
                    <h6 class="text-secondary fw-bold mb-3">Produtos Massificados (Meu)</h6>
                    <div class="table-responsive">
                    <table class="table table-sm table-hover mb-0 align-middle" style="font-size:0.9rem">
                        <thead class="table-light"><tr><th>Produto</th><th>Argumentação</th><th>Troca</th><th class="text-danger">Cancelado</th></tr></thead>
                        <tbody id="tbodyMassificados"></tbody>
                    </table>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div id="tab2" class="tab-section hidden">
          <div class="card card-kpi p-4" style="max-width: 600px; margin: 0 auto;">
            <h4 class="mb-4 text-center">Novo Registro</h4>
            <form id="formRetencao" onsubmit="event.preventDefault(); submitForm();">
                <div class="mb-3">
                  <label class="form-label fw-bold">Produto</label>
                  <select class="form-select" id="inputType" onchange="toggleForm()">
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="Conta Digital">Conta Digital</option>
                      <option value="Troca de Pontos">Troca de Pontos</option>
                      <option value="Massificado">Massificado</option>
                  </select>
                </div>
                <div class="mb-3 hidden" id="divMassificado">
                  <label class="form-label fw-bold">Sub-Produto:</label>
                    <select class="form-select" name="subProduto">
                    <option value="SPPR / Bolsa Protegida">SPPR / Bolsa Protegida</option>
                    <option value="Adicional">Adicional</option>
                    <option value="Seguro RE">Seguro RE</option>
                    <option value="Martelinho de Ouro">Martelinho de Ouro</option>
                    <option value="Acidentes Pessoais">Acidentes Pessoais</option>
                    <option value="Identidade protegida">Identidade Protegida</option>
                    <option value="Quitação fatura">Quitação Fatura</option>
                    </select>
                </div>
                <div class="mb-4">
                  <label class="form-label fw-bold">Resultado</label>
                  <select class="form-select" id="inputResult"></select>
                </div>
                <div class="d-grid gap-2">
                  <button type="submit" class="btn btn-primary btn-lg">Salvar Registro</button>
                  <button type="button" class="btn btn-outline-secondary" onclick="voltarParaDashboard()">Cancelar</button>
                </div>
            </form>
          </div>
      </div>

      <div id="tab3" class="tab-section hidden">
        <div class="d-flex justify-content-between align-items-center mb-3">
              <h3><i class="bi bi-graph-up-arrow"></i> Gestão da Equipe</h3>
              <div>
                <button class="btn btn-sm btn-outline-success me-2" onclick="toggleRelatorio('Equipe')"><i class="bi bi-file-earmark-spreadsheet"></i> Relatório Equipe</button>
              </div>
        </div>

        <div class="card card-kpi p-3 mb-4 bg-light">
            <label class="form-label fw-bold mb-1"><i class="bi bi-funnel"></i> Filtrar Visão:</label>
            <select class="form-select sup-filter" id="supFilterAgent" onchange="updateSupervisorStats()">
                <option value="">Visão Geral (Toda a Equipe)</option>
            </select>
            <small class="text-muted">Selecione um atendente para ver os dados individuais dele, ou deixe em 'Visão Geral'.</small>
        </div>

        <div class="row g-3 mb-4">
            <div class="col-md-4">
               <div class="card card-kpi p-3">
                  <h6 class="text-center text-primary">Cartão de Crédito</h6>
                  <div class="chart-container-lg"><canvas id="chartSupCC"></canvas></div>
               </div>
            </div>
            <div class="col-md-4">
               <div class="card card-kpi p-3">
                  <h6 class="text-center text-success">Conta Digital</h6>
                  <div class="chart-container-lg"><canvas id="chartSupCD"></canvas></div>
               </div>
            </div>
            <div class="col-md-4">
               <div class="card card-kpi p-3">
                  <h6 class="text-center text-warning">Troca de Pontos</h6>
                  <div class="chart-container-lg"><canvas id="chartSupPts"></canvas></div>
                  <div class="text-center mt-2 small">
                      Cash: <b id="supQtdCash">0</b> | Milhas: <b id="supQtdMilha">0</b>
                  </div>
               </div>
            </div>
        </div>

        <div class="row g-3 mb-4">
            <div class="col-md-6">
                <div class="card card-kpi">
                    <div class="card-header bg-primary text-white">Dia a Dia: Cartão de Crédito</div>
                    <div class="table-responsive" style="max-height:300px">
                        <table class="table table-sm table-striped mb-0 text-center">
                            <thead style="position:sticky; top:0; background:white;">
                                <tr><th>Data</th><th>Atend.</th><th>Retido</th><th>% Ret</th><th>% Arg</th> <th>Canc</th></tr>
                            </thead>
                            <tbody id="tbodyDiaCredito"></tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card card-kpi">
                    <div class="card-header bg-success text-white">Dia a Dia: Conta Digital</div>
                    <div class="table-responsive" style="max-height:300px">
                        <table class="table table-sm table-striped mb-0 text-center">
                            <thead style="position:sticky; top:0; background:white;">
                                <tr><th>Data</th><th>Atend.</th><th>Retido</th><th>% Ret</th><th>Canc</th></tr>
                            </thead>
                            <tbody id="tbodyDiaConta"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="card card-kpi mb-4">
           <div class="card-header">Massificados (Acumulado)</div>
           <div class="card-body p-0">
              <table class="table table-sm mb-0">
                 <thead><tr><th>Produto</th><th class="text-center">Arg</th><th class="text-center">Troca</th><th class="text-center">Canc</th></tr></thead>
                 <tbody id="tbodyMassificadosEquipe"></tbody>
              </table>
           </div>
        </div>
      </div>

      <div id="tab4" class="tab-section hidden">
          <div class="row">
              <div class="col-md-6">
                  <div class="card card-kpi p-4 mb-3">
                      <h5>Cadastrar Usuário</h5>
                      <input type="email" id="newEmail" class="form-control mb-2" placeholder="Email Google">
                      <div class="row g-2 mb-2">
                          <div class="col"><input type="text" id="newNome" class="form-control" placeholder="Nome"></div>
                          <div class="col"><input type="text" id="newSobrenome" class="form-control" placeholder="Sobrenome"></div>
                      </div>
                      <select id="newCargo" class="form-select mb-2" onchange="checkSupervisorField()">
                          <option value="Atendente">Atendente</option>
                          <option value="Supervisor">Supervisor</option>
                          <option value="ADM">ADM</option>
                      </select>
                      <div id="divSupSelect" class="mb-3">
                          <label class="small text-muted">Supervisor Responsável</label>
                          <select id="newSupervisor" class="form-select"></select>
                      </div>
                      <button class="btn btn-primary w-100" onclick="cadastrarUsuario()">Cadastrar</button>
                  </div>
              </div>
              
              <div class="col-md-6">
                  <div class="card card-kpi p-4 mb-3">
                      <h5>Gestão de Acesso</h5>
                      <div class="table-responsive" style="max-height: 200px;">
                          <table class="table table-sm"><tbody id="tbodyGestaoAtendentes"></tbody></table>
                      </div>
                  </div>
                  <div class="card card-kpi p-4 bg-danger-subtle">
                      <h5 class="text-danger">Arquivar Mês</h5>
                      <p class="small">Move dados atuais para planilha de histórico.</p>
                      <input type="text" id="archId" class="form-control mb-2" placeholder="ID Planilha Histórico">
                      <button class="btn btn-danger btn-sm" onclick="arquivarMes()">Arquivar</button>
                  </div>
              </div>
          </div>
      </div>

    </div>

    <div class="modal fade" id="modalRelatorio" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
            <div class="modal-header bg-primary text-white">
                <h5 class="modal-title"><i class="bi bi-file-earmark-spreadsheet"></i> Relatório: <span id="lblTipoRel"></span></h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <div class="mb-3">
                    <label class="form-label">Data Início</label>
                    <input type="date" id="relInicio" class="form-control">
                </div>
                <div class="mb-3">
                    <label class="form-label">Data Fim</label>
                    <input type="date" id="relFim" class="form-control">
                </div>
                <div class="alert alert-info small">
                    <i class="bi bi-info-circle"></i> O arquivo será baixado em formato CSV (Excel).
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                <button type="button" class="btn btn-primary" onclick="downloadCSV()">Baixar Agora</button>
            </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>

    <script>
    // --- GLOBAIS ---
    let chartSupCC = null, chartSupCD = null, chartSupPts = null;
    let chartTeamCC = null, chartTeamCD = null, chartTeamPts = null;
    let modalRel = null;
    let currentRelType = '';
    let currentUser = null; 

    window.onload = function() {
        modalRel = new bootstrap.Modal(document.getElementById('modalRelatorio'));
        
        // 1. Busca Info Usuário
        google.script.run
            .withSuccessHandler(setupUser)
            .withFailureHandler(err => document.getElementById('userInfo').innerText = "Erro: " + err)
            .getUserInfo();

        toggleForm(); 

        // 2. Carrega supervisores para cadastro
        google.script.run.withSuccessHandler(list => {
            const sel = document.getElementById('newSupervisor');
            if(sel && list) {
                sel.innerHTML = '<option value="">Selecione...</option>';
                list.forEach(s => sel.add(new Option(s, s)));
            }
        }).getSupervisoresList();
    };

    function setupUser(user) {
        if(!user || user.error) { 
            document.getElementById('userInfo').innerHTML = `<div class="p-3 bg-danger text-white rounded m-2">Erro: ${user ? user.error : 'Desconhecido'}</div>`; 
            return; 
        }
        
        currentUser = user;

        const nome = user.nome.split(' ')[0];
        let html = `
            <div class="user-badge">
                <div class="fs-4 fw-bold">${nome}</div>
                <div class="small text-uppercase text-white-50">${user.cargo}</div>`;
        if(user.cargo==='Atendente' && user.supervisor) {
            html+=`<div class="small mt-1 opacity-75">Sup: ${user.supervisor}</div>`;
        }
        html+=`</div>`;
        document.getElementById('userInfo').innerHTML = html;

        // Controle de Abas
        const allNavs = document.querySelectorAll('.nav-link');
        allNavs.forEach(l => l.classList.add('hidden'));

        let startTab = 'tab1';
        
        if(user.cargo === 'ADM') {
            allNavs.forEach(l => l.classList.remove('hidden'));
            startTab = 'tab3'; 
        } else if (user.cargo === 'Supervisor') {
            document.querySelector('.nav-link[onclick*="tab1"]').classList.remove('hidden');
            document.querySelector('.nav-link[onclick*="tab2"]').classList.remove('hidden');
            document.querySelector('.nav-link[onclick*="tab3"]').classList.remove('hidden');
            document.querySelector('.nav-link[onclick*="tab4"]').classList.remove('hidden');
            startTab = 'tab3';
        } else {
            // Atendente
            document.querySelector('.nav-link[onclick*="tab1"]').classList.remove('hidden');
            document.querySelector('.nav-link[onclick*="tab2"]').classList.remove('hidden');
        }
        
        showTab(startTab);
        loadAllData(user);
    }

    function showTab(id) {
        document.querySelectorAll('.tab-section').forEach(e => e.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-link[onclick*="${id}"]`);
        if(activeLink) activeLink.classList.add('active');
    }

    function loadAllData(user) {
        // Agora retorna { pessoal: ..., equipe: ... }
        google.script.run.withSuccessHandler(data => {
            if(data) {
                renderDashboard(data.pessoal, data.equipe);
            }
        }).getDashboardData();
        
        if (user.cargo === 'Supervisor' || user.cargo === 'ADM') {
            updateSupervisorStats(); 
        }
    }

    // --- FUNÇÃO AUXILIAR DATA ---
    function processarDiarioAgente(lista) {
        let diario = {};
        
        lista.forEach(reg => {
            let dataObj = new Date(reg.data);
            let dia = String(dataObj.getDate()).padStart(2, '0');
            let mes = String(dataObj.getMonth() + 1).padStart(2, '0');
            let ano = dataObj.getFullYear();
            let key = `${dia}/${mes}/${ano}`;

            if (!diario[key]) {
                diario[key] = { cc: { total: 0, ret: 0, arg: 0, canc: 0 }, cd: { total: 0, ret: 0, canc: 0 } };
            }

            if (reg.produto === 'Cartão de Crédito') {
                diario[key].cc.total++;
                if (reg.resultado.indexOf('Retido') !== -1) {
                    diario[key].cc.ret++;
                    if (reg.resultado.indexOf('Argumentação') !== -1) diario[key].cc.arg++;
                }
                else if (reg.resultado === 'Cancelado') diario[key].cc.canc++;
            }
            else if (reg.produto === 'Conta Digital') {
                diario[key].cd.total++;
                if (reg.resultado.indexOf('Retido') !== -1) diario[key].cd.ret++;
                else if (reg.resultado === 'Cancelado') diario[key].cd.canc++;
            }
        });
        return diario;
    }

    // --- RENDERIZAÇÃO DASHBOARD ATENDENTE ---
    function renderDashboard(stats, equipeStats) {
        if(!stats) return;

        const analise = calcularMetas(stats);
        const calcPct = (num, den) => den > 0 ? (num/den)*100 : 0;
        
        const ccRet = stats.cartao.retidoTotal || 0;
        const ccArg = stats.cartao.retidoArg || 0;
        const ccInc = ccRet - ccArg;

        document.getElementById('ccComissao').innerText = analise.financeiro.ccTotal.toFixed(2);
        document.getElementById('cdComissao').innerText = analise.financeiro.cdTotal.toFixed(2);
        
        document.getElementById('ccPctGeral').innerText = calcPct(ccRet, stats.cartao.total).toFixed(2) + '%';
        document.getElementById('ccPctArg').innerText = calcPct(ccArg, ccRet).toFixed(2) + '%'; 
        document.getElementById('cdPctGeral').innerText = calcPct(stats.conta.retido, stats.conta.total).toFixed(2) + '%';
        
        document.getElementById('qtdCCRetGeral').innerText = ccRet;
        document.getElementById('qtdCCCanc').innerText = stats.cartao.cancelado;
        document.getElementById('qtdCCArg').innerText = ccArg;
        document.getElementById('qtdCCInc').innerText = ccInc;
        
        document.getElementById('qtdCDTotal').innerText = stats.conta.total;
        document.getElementById('qtdCDRet').innerText = stats.conta.retido;
        document.getElementById('qtdCDCanc').innerText = stats.conta.cancelado;
        
        document.getElementById('qtdCashback').innerText = stats.pontos.cashback;
        document.getElementById('qtdMilhas').innerText = stats.pontos.milhas;

        // Massificados
        const listaPadrao = ["SPPR / Bolsa Protegida", "Adicional", "Acidentes Pessoais", "Identidade protegida", "Seguro RE", "Martelinho de Ouro", "Quitação fatura"];
        const tbodyMass = document.getElementById('tbodyMassificados');
        tbodyMass.innerHTML = '';
        listaPadrao.forEach(nome => {
            const d = stats.massificado[nome] || { arg: 0, troca: 0, canc: 0 };
            tbodyMass.innerHTML += `<tr><td>${nome}</td><td class="text-center">${d.arg}</td><td class="text-center">${d.troca}</td><td class="text-center text-danger">${d.canc}</td></tr>`;
        });

        // Tabelas Diárias
        const dadosDiarios = processarDiarioAgente(stats.lista);
        const tbodyCC = document.getElementById('tbodyAgentDailyCC');
        const tbodyCD = document.getElementById('tbodyAgentDailyCD');
        tbodyCC.innerHTML = ''; tbodyCD.innerHTML = '';

        const hoje = new Date();
        const anoAtual = hoje.getFullYear();
        const mesAtual = hoje.getMonth();
        const ultimoDia = new Date(anoAtual, mesAtual + 1, 0).getDate();

        for (let i = 1; i <= ultimoDia; i++) {
            const diaStr = String(i).padStart(2, '0');
            const mesStr = String(mesAtual + 1).padStart(2, '0');
            const dataKey = `${diaStr}/${mesStr}/${anoAtual}`;

            const dia = dadosDiarios[dataKey] || { cc: { total:0, ret:0, arg:0, canc:0 }, cd: { total:0, ret:0, canc:0 } };

            const pctRetCC = dia.cc.total > 0 ? (dia.cc.ret / dia.cc.total)*100 : 0;
            const badgeClassCC = pctRetCC >= 70 ? 'bg-success' : (pctRetCC > 0 ? 'bg-danger' : 'bg-secondary');

            tbodyCC.innerHTML += `
                <tr>
                    <td>${dataKey}</td>
                    <td><b>${dia.cc.ret}</b> / ${dia.cc.total}</td>
                    <td>${dia.cc.arg}</td>
                    <td><span class="badge ${badgeClassCC}">${pctRetCC.toFixed(2)}%</span></td>
                    <td class="text-danger">${dia.cc.canc}</td>
                </tr>`;

            const pctRetCD = dia.cd.total > 0 ? (dia.cd.ret / dia.cd.total)*100 : 0;
            const badgeClassCD = pctRetCD >= 70 ? 'bg-success' : (pctRetCD > 0 ? 'bg-danger' : 'bg-secondary');

            tbodyCD.innerHTML += `
                <tr>
                    <td>${dataKey}</td>
                    <td><b>${dia.cd.ret}</b> / ${dia.cd.total}</td>
                    <td><span class="badge ${badgeClassCD}">${pctRetCD.toFixed(2)}%</span></td>
                    <td class="text-danger">${dia.cd.canc}</td>
                </tr>`;
        }

        // Gráficos de Equipe
        if(equipeStats) {
             document.getElementById('cardTeamCharts').classList.remove('hidden');
             renderTeamCharts(equipeStats);
        } else {
             document.getElementById('cardTeamCharts').classList.add('hidden');
        }
    }

    function renderTeamCharts(stats) {
         const calcPct = (n, d) => d > 0 ? (n/d)*100 : 0;
         const miniOpt = { 
            responsive:true, maintainAspectRatio:false, 
            plugins: { legend: {display:false}, tooltip: {callbacks: {label: c=>c.raw+'%'}} } 
         };

         // Cartão Crédito Equipe
         const ccT = stats.cartao.total;
         const ccRet = stats.cartao.retidoTotal;
         const ccArg = stats.cartao.retidoArg;
         const ccCanc = stats.cartao.cancelado;

         // Atualiza números abaixo do gráfico
         document.getElementById('teamCCRet').innerText = ccRet;
         document.getElementById('teamCCArg').innerText = ccArg;
         document.getElementById('teamCCCanc').innerText = ccCanc;

         if(chartTeamCC) chartTeamCC.destroy();
         const ctxCC = document.getElementById('chartTeamCC');
         if(ctxCC) {
            chartTeamCC = new Chart(ctxCC, {
               type: 'doughnut',
               data: {
                  labels: ['Retidos', 'Arg (Sobre Ret)', 'Cancelados'],
                  datasets: [{
                      data: [calcPct(ccRet, ccT).toFixed(2), calcPct(ccArg, ccRet).toFixed(2), calcPct(ccCanc, ccT).toFixed(2)],
                      backgroundColor: ['#0d6efd','#198754','#dc3545']
                  }]
               },
               options: miniOpt
            });
         }

         // Conta Digital Equipe
         const cdT = stats.conta.total;
         const cdRet = stats.conta.retido;
         const cdCanc = stats.conta.cancelado;

         // Atualiza números abaixo do gráfico
         document.getElementById('teamCDRet').innerText = cdRet;
         document.getElementById('teamCDCanc').innerText = cdCanc;

         if(chartTeamCD) chartTeamCD.destroy();
         const ctxCD = document.getElementById('chartTeamCD');
         if(ctxCD) {
            chartTeamCD = new Chart(ctxCD, {
               type: 'doughnut',
               data: {
                  labels: ['Retidos', 'Cancelados'],
                  datasets: [{
                      data: [calcPct(cdRet, cdT).toFixed(2), calcPct(cdCanc, cdT).toFixed(2)],
                      backgroundColor: ['#198754','#dc3545']
                  }]
               },
               options: miniOpt
            });
         }

         // Pontos Equipe
         const ptsTotal = (stats.pontos.cashback + stats.pontos.milhas) || 0;
         const pCash = calcPct(stats.pontos.cashback, ptsTotal).toFixed(0);
         const pMilha = calcPct(stats.pontos.milhas, ptsTotal).toFixed(0);

         // Atualiza números abaixo do gráfico
         document.getElementById('teamPtsCash').innerText = stats.pontos.cashback;
         document.getElementById('teamPtsMilha').innerText = stats.pontos.milhas;

         if(chartTeamPts) chartTeamPts.destroy();
         const ctxPts = document.getElementById('chartTeamPts');
         if(ctxPts) {
             chartTeamPts = new Chart(ctxPts, {
                 type: 'doughnut',
                 data: {
                    labels: ['Cashback', 'Milhas'],
                    datasets: [{
                        data: [pCash, pMilha],
                        backgroundColor: ['#0dcaf0','#ffc107']
                    }]
                 },
                 options: miniOpt
             });
         }
    }

    // --- GESTÃO SUPERVISOR ---
    function updateSupervisorStats() {
        const filtroEmail = document.getElementById('supFilterAgent').value;
        google.script.run.withSuccessHandler(renderSupervisorDashboard).getSupervisorData(filtroEmail);
    }

    function renderSupervisorDashboard(data) {
        if(!data) return;
        const stats = data.geral;
        const calcPct = (n, d) => d > 0 ? (n/d)*100 : 0;
        
        const sel = document.getElementById('supFilterAgent');
        if(data.equipe && sel.options.length <= 1) { 
            data.equipe.forEach(m => sel.add(new Option(m.nome, m.email)));
        }

        const tbU = document.getElementById('tbodyGestaoAtendentes');
        tbU.innerHTML='';
        if(data.equipe) {
            data.equipe.forEach(u => {
                tbU.innerHTML += `<tr><td>${u.nome}</td><td class="text-end"><button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${u.email}')"><i class="bi bi-trash"></i></button></td></tr>`;
            });
        }

        const commonOpt = {
            responsive:true, maintainAspectRatio:false,
            plugins: { legend: {position:'bottom'}, tooltip: {callbacks:{label: c=>c.label+': '+c.raw+'%'}} }
        };

        const pCCRet = calcPct(stats.cartao.retidoTotal, stats.cartao.total).toFixed(1);
        const pCCArg = calcPct(stats.cartao.retidoArg, stats.cartao.retidoTotal).toFixed(1); 
        const pCCCanc = calcPct(stats.cartao.cancelado, stats.cartao.total).toFixed(1);

        if(chartSupCC) chartSupCC.destroy();
        chartSupCC = new Chart(document.getElementById('chartSupCC'), {
            type: 'doughnut',
            data: { 
                labels: ['Retenção', 'Ret. Argumentação', 'Cancelado'],
                datasets: [{ data: [pCCRet, pCCArg, pCCCanc], backgroundColor: ['#0d6efd','#198754','#dc3545'] }]
            },
            options: commonOpt
        });

        const pCDRet = calcPct(stats.conta.retido, stats.conta.total).toFixed(1);
        const pCDCanc = calcPct(stats.conta.cancelado, stats.conta.total).toFixed(1);

        if(chartSupCD) chartSupCD.destroy();
        chartSupCD = new Chart(document.getElementById('chartSupCD'), {
            type: 'doughnut',
            data: { 
                labels: ['Retidos', 'Cancelados'],
                datasets: [{ data: [pCDRet, pCDCanc], backgroundColor: ['#198754','#dc3545'] }]
            },
            options: commonOpt
        });

        const ptsTotal = (stats.pontos.cashback + stats.pontos.milhas) || 0;
        const pCash = calcPct(stats.pontos.cashback, ptsTotal).toFixed(1);
        const pMilha = calcPct(stats.pontos.milhas, ptsTotal).toFixed(1);

        if(chartSupPts) chartSupPts.destroy();
        chartSupPts = new Chart(document.getElementById('chartSupPts'), {
            type: 'doughnut',
            data: { 
                labels: ['Cashback', 'Milhas'],
                datasets: [{ data: [pCash, pMilha], backgroundColor: ['#0dcaf0','#ffc107'] }]
            },
            options: commonOpt
        });
        document.getElementById('supQtdCash').innerText = stats.pontos.cashback;
        document.getElementById('supQtdMilha').innerText = stats.pontos.milhas;

        const tbCC = document.getElementById('tbodyDiaCredito');
        const tbCD = document.getElementById('tbodyDiaConta');
        tbCC.innerHTML=''; tbCD.innerHTML='';

        const hoje = new Date();
        const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();

        for (let i = 1; i <= ultimoDia; i++) {
            const dataChave = `${String(i).padStart(2,'0')}/${String(hoje.getMonth()+1).padStart(2,'0')}/${hoje.getFullYear()}`;
            const dia = (data.diario && data.diario[dataChave]) ? data.diario[dataChave] : { cc: { atendido:0, retido:0, retidoArg:0, canc:0 }, cd: { atendido:0, retido:0, canc:0 } };

            const pdRet = calcPct(dia.cc.retido, dia.cc.atendido).toFixed(2);
            const pdArg = calcPct(dia.cc.retidoArg, dia.cc.retido).toFixed(2); 
            tbCC.innerHTML += `<tr><td>${dataChave}</td><td>${dia.cc.atendido}</td><td class="text-primary fw-bold">${dia.cc.retido}</td><td>${pdRet}%</td><td class="text-success fw-bold">${pdArg}%</td><td class="text-danger">${dia.cc.canc}</td></tr>`;
            
            const pcdRet = calcPct(dia.cd.retido, dia.cd.atendido).toFixed(2);
            tbCD.innerHTML += `<tr><td>${dataChave}</td><td>${dia.cd.atendido}</td><td class="text-success fw-bold">${dia.cd.retido}</td><td>${pcdRet}%</td><td class="text-danger">${dia.cd.canc}</td></tr>`;
        }

        const tbM = document.getElementById('tbodyMassificadosEquipe');
        tbM.innerHTML = '';
        const listM = ["SPPR / Bolsa Protegida", "Adicional", "Acidentes Pessoais", "Identidade protegida", "Seguro RE", "Martelinho de Ouro", "Quitação fatura"];
        listM.forEach(nome => {
            const v = stats.massificado[nome] || { arg: 0, troca: 0, canc: 0 };
            tbM.innerHTML += `<tr><td>${nome}</td><td class="text-center">${v.arg}</td><td class="text-center">${v.troca}</td><td class="text-center text-danger">${v.canc}</td></tr>`;
        });
    }

    // --- FORMULÁRIO E UTILITÁRIOS ---
    function toggleForm() {
        const t = document.getElementById('inputType').value;
        const res = document.getElementById('inputResult');
        const mass = document.getElementById('divMassificado');
        res.innerHTML=''; 
        if(mass) mass.classList.add('hidden');
        
        const ops = {
            'Massificado': ['Retido por Argumentação', 'Retido por Troca de Produto', 'Cancelado'],
            'Troca de Pontos': ['Convertido em Cashback', 'Seguiu com Milhas'],
            'Cartão de Crédito': ['Retido por Argumentação', 'Retido por Incentivo', 'Cancelado'],
            'Conta Digital': ['Retido', 'Cancelado']
        };
        
        if(t==='Massificado' && mass) mass.classList.remove('hidden');
        (ops[t]||[]).forEach(o => res.add(new Option(o,o)));
    }

    function submitForm() {
        const form = document.getElementById('formRetencao');
        const t = document.getElementById('inputType').value;
        const sub = form.querySelector('[name="subProduto"]');
        
        const data = {
            tipo: t,
            subProduto: (t==='Massificado' && sub) ? sub.value : '-',
            resultado: document.getElementById('inputResult').value
        };
        
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled=true; btn.innerText='Salvando...';
        
        google.script.run.withSuccessHandler(msg => {
            alert(msg);
            form.reset();
            btn.disabled=false; btn.innerText='Salvar Registro';
            document.getElementById('inputType').value='Cartão de Crédito';
            toggleForm();
            if(currentUser) loadAllData(currentUser); 
            showTab('tab1');
        }).salvarRetencao(data);
    }

    function toggleRelatorio(t) { currentRelType=t; document.getElementById('lblTipoRel').innerText=t; modalRel.show(); }
    
    function downloadCSV() {
        const ini=document.getElementById('relInicio').value;
        const fim=document.getElementById('relFim').value;
        if(!ini||!fim) return alert("Selecione as datas.");
        
        google.script.run.withSuccessHandler(csv => {
            if(csv==='Vazio') return alert("Sem dados.");
            const blob = new Blob(["\ufeff", csv], {type:'text/csv;charset=utf-8'});
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `Relatorio_${currentRelType}.csv`;
            link.click();
            modalRel.hide();
        }).gerarRelatorioCSV(ini, fim, currentRelType);
    }
    
    function cadastrarUsuario() {
        const dados = {
            email: document.getElementById('newEmail').value,
            nome: document.getElementById('newNome').value,
            sobrenome: document.getElementById('newSobrenome').value,
            cargo: document.getElementById('newCargo').value,
            supervisor: document.getElementById('newSupervisor').value
        };
        if(!dados.email) return alert("Preencha o email.");
        google.script.run.withSuccessHandler(alert).cadastrarUsuario(dados);
    }
    
    function checkSupervisorField() {
        const c = document.getElementById('newCargo').value;
        const d = document.getElementById('divSupSelect');
        if(c==='Atendente') d.classList.remove('hidden'); else d.classList.add('hidden');
    }

    function arquivarMes() {
        const id = document.getElementById('archId').value;
        const match = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
        const finalId = match ? match[1] : id;
        if(!finalId) return alert("ID inválido");
        if(confirm("Arquivar agora?")) {
            google.script.run.withSuccessHandler(alert).arquivarMes(finalId);
        }
    }
    
    function deleteUser(e) { if(confirm("Deletar usuário "+e+"?")) google.script.run.withSuccessHandler(alert).excluirUsuario(e); }
    function voltarParaDashboard() { showTab('tab1'); }

    function calcularMetas(stats) {
        const pctCC = (stats.cartao.total > 0) ? (stats.cartao.retidoTotal / stats.cartao.total) * 100 : 0;
        const pctArg = (stats.cartao.retidoTotal > 0) ? (stats.cartao.retidoArg / stats.cartao.retidoTotal) * 100 : 0;
        const pctConta = (stats.conta.total > 0) ? (stats.conta.retido / stats.conta.total) * 100 : 0;

        let comissaoCC = 0, comissaoArg = 0, comissaoConta = 0, bonusCC = 0, bonusConta = 0;

        if (pctCC >= 75) comissaoCC = 200; else if (pctCC >= 74) comissaoCC = 180; else if (pctCC >= 73) comissaoCC = 150;
        if (pctArg >= 40) comissaoArg = 200; else if (pctArg >= 38) comissaoArg = 150; else if (pctArg >= 35) comissaoArg = 100;
        if (pctCC >= 78 && pctArg >= 44) bonusCC = 200; else if (pctCC >= 76 && pctArg >= 42) bonusCC = 100;
        
        if (pctConta >= 75) comissaoConta = 200; else if (pctConta >= 50) comissaoConta = 150; else if (pctConta >= 30) comissaoConta = 100;
        if (pctConta >= 78) bonusConta = 150; else if (pctConta >= 76) bonusConta = 100;

        return {
            financeiro: {
                ccTotal: comissaoCC + comissaoArg + bonusCC,
                cdTotal: comissaoConta + bonusConta
            }
        };
    }
    </script>
  </body>
</html>
~~~
