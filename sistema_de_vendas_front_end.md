Front-end do sistema de vendas

~~~html
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  
  <style>
    :root {
      /* CORES PORTO */
      --primary: #004691; 
      --secondary: #00a1e0; 
      --accent: #ffcc00; 
      --bg-light: #f4f7fa;
      --text: #333;
      --sidebar-width: 260px;
      --success: #27ae60;
      --danger: #e74c3c;
    }

    body { margin: 0; font-family: 'Roboto', sans-serif; background: var(--bg-light); color: var(--text); display: flex; height: 100vh; overflow: hidden; }

    /* SIDEBAR */
    .sidebar {
      width: var(--sidebar-width);
      background: var(--primary); 
      color: white;
      display: flex;
      flex-direction: column;
      box-shadow: 4px 0 10px rgba(0,0,0,0.1);
      z-index: 10;
    }
    
    .logo-area {
      padding: 30px 20px;
      text-align: center;
      background: rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .logo-area h2 { margin: 0; font-size: 1.3em; font-weight: 700; letter-spacing: 0.5px; }
    
    .nav-btn {
      padding: 16px 25px;
      cursor: pointer;
      border: none;
      background: transparent;
      color: #e0e0e0;
      text-align: left;
      font-size: 1em;
      transition: 0.3s;
      border-left: 5px solid transparent;
      display: flex; align-items: center; gap: 10px;
    }
    
    .nav-btn:hover { background: rgba(255,255,255,0.1); color: white; }
    .nav-btn.active { background: white; color: var(--primary); border-left-color: var(--secondary); font-weight: 500; }
    
    .user-profile {
      margin-top: auto;
      padding: 20px;
      background: #003366; 
      font-size: 0.85em;
    }
    .user-profile strong { display: block; font-size: 1.1em; margin-bottom: 4px; color: var(--secondary); }
    .user-profile span { display: block; opacity: 0.8; }

    /* CONTEÚDO */
    .main-content {
      flex: 1;
      padding: 30px;
      overflow-y: auto;
    }

    h1 { color: var(--primary); margin-top: 0; font-weight: 300; border-bottom: 2px solid var(--secondary); display: inline-block; padding-bottom: 5px; }

    .tab-section { display: none; animation: fadeIn 0.4s ease; }
    .tab-section.active { display: block; }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    /* CARDS E DASHBOARD */
    .cards-wrapper { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 30px; }
    .card { 
      background: white; 
      padding: 20px; 
      border-radius: 8px; 
      box-shadow: 0 4px 6px rgba(0,0,0,0.05); 
      flex: 1; 
      min-width: 200px; 
      text-align: center; 
      border-top: 4px solid var(--secondary);
    }
    .card h3 { margin: 0 0 10px; font-size: 0.85em; color: #7f8c8d; text-transform: uppercase; letter-spacing: 1px; }
    .card .val { font-size: 2em; font-weight: 700; color: var(--primary); }
    .card.blue-card { background: var(--primary); color: white; border: none; }
    .card.blue-card h3 { color: rgba(255,255,255,0.8); }
    .card.blue-card .val { color: white; }

    /* GAUGE */
    .gauge-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 30px; text-align: center; }
    .progress-track { width: 100%; height: 25px; background: #e0e0e0; border-radius: 12px; margin: 15px 0; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, var(--secondary), var(--primary)); width: 0%; transition: width 1s ease; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.8em; font-weight: bold; }
    
    /* TABELAS */
    .grid-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; }
    .box { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
    
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th { background: #f0f4f8; color: var(--primary); font-weight: 600; text-align: left; padding: 12px; border-bottom: 2px solid #dde; }
    td { padding: 12px; border-bottom: 1px solid #eee; color: #555; }
    
    /* FORMULÁRIOS */
    .form-group { margin-bottom: 15px; }
    label { font-weight: 500; display: block; margin-bottom: 5px; color: var(--primary); }
    input, select { width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; outline: none; }
    input:focus, select:focus { border-color: var(--secondary); box-shadow: 0 0 0 3px rgba(0,161,224,0.1); }
    
    button.btn { background: var(--secondary); color: white; padding: 12px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 1em; width: 100%; font-weight: 500; transition: 0.2s; }
    button.btn:hover { background: var(--primary); }
    
    button.btn-danger { background: var(--danger); width: auto; padding: 6px 12px; font-size: 0.85em; }
    button.btn-danger:hover { background: #c0392b; }

    /* LOADER */
    #loader { position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(255,255,255,0.9); display: flex; justify-content: center; align-items: center; z-index: 2000; }
    .spinner { border: 4px solid #f3f3f3; border-top: 4px solid var(--primary); border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    .hidden { display: none !important; }
  </style>
</head>
<body>

  <div id="loader"><div class="spinner"></div></div>

  <div class="sidebar">
    <div class="logo-area">
      <h2>Sistema de vendas</h2>
    </div>
    
    <button class="nav-btn active" onclick="navTo('resumo')">Meu Resumo</button>
    <button class="nav-btn" onclick="navTo('venda')">Registrar Venda</button>
    <button class="nav-btn hidden" id="btnEquipe" onclick="navTo('equipe')">Minha Equipe</button>
    <button class="nav-btn hidden" id="btnAdmin" onclick="navTo('admin')">Admin</button>

    <div class="user-profile" id="userProfile">Carregando...</div>
  </div>

  <div class="main-content">
    
    <div id="resumo" class="tab-section active">
      <h1>Painel de Resultados</h1>
      
      <div class="cards-wrapper">
        <div class="card">
          <h3>Minhas Vendas</h3>
          <div class="val" id="dashTotal">0</div>
        </div>
        <div class="card blue-card">
          <h3>Total Vendas da Equipe</h3>
          <div class="val" id="dashTotalEquipe">0</div>
        </div>
      </div>

      <div class="gauge-container">
        <div style="display:flex; justify-content:space-between; color:#666; margin-bottom:5px;">
          <span>Progresso da Meta</span>
          <span id="txtPorcentagem">0%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" id="gaugeBar">0%</div>
        </div>
        <div style="color: #888; font-size: 0.9em;">Meta Atual: <strong id="dashMeta">0</strong></div>
      </div>

      <div class="cards-wrapper">
        <div class="card">
          <h3>Comissão sem CPCP</h3>
          <div class="val" id="valSemCPCP">R$ 0,00</div>
        </div>
        <div class="card" style="border-top-color: var(--success);">
          <h3>Comissão com CPCP</h3>
          <div class="val" style="color: var(--success);" id="valCPCP">R$ 0,00</div>
        </div>
      </div>

      <div class="grid-row">
        <div class="box">
          <h3>Minhas Vendas por massificado</h3>
          <table>
            <thead><tr><th>Produto</th><th>Qtd</th></tr></thead>
            <tbody id="tblIndivBody"><tr><td colspan="2">Carregando...</td></tr></tbody>
          </table>
        </div>
        <div class="box">
          <h3>Vendas por massificado da equipe</h3>
          <table>
            <thead><tr><th>Produto</th><th>Qtd</th></tr></thead>
            <tbody id="tblEquipeBody"><tr><td colspan="2">Carregando...</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="venda" class="tab-section">
      <h1>Nova Venda</h1>
      <div class="box" style="max-width: 600px;">
        <form id="formVenda" onsubmit="submitVenda(event)">
          <div class="form-group">
            <label>Data</label>
            <input type="date" name="data" id="inputDate" required>
          </div>
          <div class="form-group">
            <label>Produto</label>
            <select name="produto" id="selProduto" required>
              <option value="">Carregando produtos...</option>
            </select>
          </div>
          <div class="form-group">
            <label>Protocolo</label>
            <input type="text" name="protocolo" placeholder="Ex: 2024..." required>
          </div>
          <div class="form-group">
            <label>Quantidade</label>
            <input type="number" name="quantidade" value="1" min="1" required>
          </div>
          <button type="submit" class="btn">Confirmar Venda</button>
        </form>
      </div>
    </div>

    <div id="equipe" class="tab-section">
      <h1>Gestão da Equipe</h1>
      
      <div class="cards-wrapper">
        <div class="card blue-card">
          <h3>Total Vendas da Equipe (Filtrado)</h3>
          <div class="val" id="teamTotalGeral">0</div>
        </div>
        <div class="card">
          <h3>Definir Meta da Equipe</h3>
          <form onsubmit="submitMeta(event, false)" style="display:flex; gap:5px; margin-top:5px;">
            <input type="number" name="valorMeta" id="inputMetaSup" placeholder="Nova meta..." required style="padding: 8px;">
            <button type="submit" class="btn" style="width:auto; padding: 8px 15px;">Salvar</button>
          </form>
        </div>
        <div class="card" style="display: flex; flex-direction: column; justify-content: center; text-align: left;">
          <label style="font-size: 0.9em; margin-bottom:5px;">Filtrar por Atendente:</label>
          <select id="selAtendenteFiltro" onchange="carregarEquipe()">
             <option value="">Todos (Visão Geral)</option>
          </select>
        </div>
      </div>

      <div class="grid-row">
        <div class="box">
          <h3>Evolução Diária</h3>
          <canvas id="teamChart" style="max-height: 250px;"></canvas>
        </div>
        <div class="box">
          <h3>Vendas por Produto (Equipe)</h3>
          <table>
            <thead><tr><th>Produto</th><th>Total</th></tr></thead>
            <tbody id="tblTeamProdutos">
               <tr><td colspan="2">Selecione o filtro...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="box" style="margin-top: 25px;">
        <h3>Membros Cadastrados</h3>
        <table>
          <thead><tr><th>Nome / Email</th><th>Cargo</th><th>Ação</th></tr></thead>
          <tbody id="tblMembros"></tbody>
        </table>
      </div>
    </div>

    <div id="admin" class="tab-section">
      <h1>Administração</h1>
      
      <div class="grid-row">
        <div class="box">
          <h3>Novo Usuário</h3>
          <form id="formUser" onsubmit="submitUser(event)">
            <div class="form-group"><label>Email</label><input type="email" name="email" required></div>
            <div class="form-group"><label>Nome</label><input type="text" name="nome" required></div>
            <div class="form-group"><label>Equipe</label><input type="text" name="equipe" required></div>
            <div class="form-group">
              <label>Cargo</label>
              <select name="cargo">
                <option value="Atendente">Atendente</option>
                <option value="Supervisor">Supervisor</option>
                <option value="ADM">ADM</option>
              </select>
            </div>
            <button type="submit" class="btn">Cadastrar</button>
          </form>
        </div>

        <div style="display:flex; flex-direction:column; gap:25px;">
          
          <div class="box">
            <h3>Gestão de Metas (Geral)</h3>
            <p style="color:#666; font-size:0.9em;">Selecione a equipe e defina a meta mensal.</p>
            <form onsubmit="submitMeta(event, true)">
              <div class="form-group">
                <label>Equipe</label>
                <select id="selEquipeAdmin" name="equipe" required>
                   <option value="">Carregando...</option>
                </select>
              </div>
              <div class="form-group">
                <label>Valor da Meta</label>
                <input type="number" name="valorMeta" required>
              </div>
              <button type="submit" class="btn">Atualizar Meta</button>
            </form>
          </div>

          <div class="box">
            <h3>Arquivamento</h3>
            <p style="color:#666; font-size:0.9em;">Backup e limpeza da base atual.</p>
            <form onsubmit="submitArchive(event)">
              <div class="form-group">
                <label>URL Planilha Destino</label>
                <input type="url" name="url" placeholder="https://docs.google.com/..." required>
              </div>
              <button type="submit" class="btn" style="background:#e67e22;">Executar Arquivamento</button>
            </form>
          </div>

        </div>
      </div>
    </div>

  </div>

  <script>
    let chartInstance = null; 
    let userCurrentTeam = "";

    window.onload = function() {
      document.getElementById('inputDate').valueAsDate = new Date();
      toggleLoader(true);
      
      google.script.run.withSuccessHandler(lista => {
        const sel = document.getElementById('selProduto');
        sel.innerHTML = '<option value="">Selecione...</option>';
        lista.forEach(p => sel.add(new Option(p, p)));
      }).getProductList();

      carregarDashboard();
    };

    function carregarDashboard() {
      google.script.run.withSuccessHandler(data => {
        toggleLoader(false);
        if(data.error) return alert(data.error);

        // User Info
        const u = data.user;
        userCurrentTeam = u.equipe; // Salva para uso interno
        let htmlUser = `<strong>${u.nome}</strong><span>${u.cargo}</span><span>${u.equipe}</span>`;
        if(['atendente','operador'].includes(u.cargo.toLowerCase()) && u.supervisor) {
          htmlUser += `<span style="margin-top:5px; border-top:1px solid rgba(255,255,255,0.2); padding-top:5px; font-size:0.9em;">Sup: ${u.supervisor}</span>`;
        }
        document.getElementById('userProfile').innerHTML = htmlUser;

        if(['supervisor', 'adm'].includes(u.cargo.toLowerCase())) document.getElementById('btnEquipe').classList.remove('hidden');
        if(u.cargo.toLowerCase() === 'adm') {
           document.getElementById('btnAdmin').classList.remove('hidden');
           carregarEquipesAdmin(); // Carrega o dropdown do admin
        }

        // Valores
        document.getElementById('dashTotal').textContent = data.totalVendas;
        document.getElementById('dashTotalEquipe').textContent = data.totalVendasEquipe; 
        document.getElementById('dashMeta').textContent = data.meta;
        
        // Gauge
        const bar = document.getElementById('gaugeBar');
        const pct = Math.min(data.percentual, 100).toFixed(0);
        bar.style.width = pct + '%';
        bar.textContent = data.percentual.toFixed(1) + '%';
        document.getElementById('txtPorcentagem').textContent = data.percentual.toFixed(1) + '%';
        
        // Financeiro
        document.getElementById('valSemCPCP').textContent = formatMoney(data.comissaoSemCPCP);
        document.getElementById('valCPCP').textContent = formatMoney(data.comissaoCPCP);

        renderTable('tblIndivBody', data.tabelaIndiv);
        renderTable('tblEquipeBody', data.tabelaEquipe);

      }).getTab1Data();
    }

    function carregarEquipe() {
      toggleLoader(true);
      const emailFiltro = document.getElementById('selAtendenteFiltro').value;

      google.script.run.withSuccessHandler(data => {
        toggleLoader(false);
        if(data.error) return alert(data.error);

        const sel = document.getElementById('selAtendenteFiltro');
        if(sel.options.length === 1) { 
           data.membros.forEach(m => sel.add(new Option(`${m.nome}`, m.email)));
        }

        document.getElementById('teamTotalGeral').textContent = data.totalGeral;
        
        // Preenche o input de meta do supervisor com o valor atual
        if(document.getElementById('inputMetaSup')) {
            document.getElementById('inputMetaSup').value = data.metaEquipe;
        }

        renderChart(data.grafico);
        renderTable('tblTeamProdutos', data.listaProdutos);

        const tbody = document.getElementById('tblMembros');
        tbody.innerHTML = '';
        data.membros.forEach(m => {
          tbody.innerHTML += `
            <tr>
              <td>${m.nome}<br><small style="color:#888;">${m.email}</small></td>
              <td>${m.cargo}</td>
              <td><button class="btn btn-danger" onclick="excluirMembro('${m.email}')">Excluir</button></td>
            </tr>`;
        });
      }).getTeamData(emailFiltro);
    }

    function carregarEquipesAdmin() {
       google.script.run.withSuccessHandler(teams => {
          const sel = document.getElementById('selEquipeAdmin');
          sel.innerHTML = '<option value="">Selecione...</option>';
          teams.forEach(t => sel.add(new Option(t, t)));
       }).getUniqueTeams();
    }

    function renderChart(dados) {
      const ctx = document.getElementById('teamChart').getContext('2d');
      if(chartInstance) chartInstance.destroy();

      chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dados.map(d => d.dia),
          datasets: [{
            label: 'Vendas',
            data: dados.map(d => d.qtd),
            borderColor: '#00a1e0',
            backgroundColor: 'rgba(0, 161, 224, 0.1)',
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });
    }

    // --- AÇÕES ---

    function submitMeta(e, isAdmin) {
      e.preventDefault();
      toggleLoader(true);
      const form = e.target;
      // Se for Admin pega do select, se for supervisor pega da variavel global userCurrentTeam
      const equipeAlvo = isAdmin ? form.equipe.value : userCurrentTeam;
      const valor = form.valorMeta.value;

      google.script.run.withSuccessHandler(res => {
         toggleLoader(false);
         if(res.success) {
            alert(res.message);
            // Atualiza a tela para refletir a nova meta
            carregarDashboard(); 
            if(!isAdmin) carregarEquipe(); 
         } else {
            alert(res.error);
         }
      }).updateMeta(equipeAlvo, valor);
    }

    function submitVenda(e) {
      e.preventDefault(); toggleLoader(true);
      const f = document.getElementById('formVenda');
      google.script.run.withSuccessHandler(res => {
        toggleLoader(false);
        if(res.success) { alert('Venda Salva!'); f.reset(); navTo('resumo'); carregarDashboard(); }
        else alert(res.error);
      }).registerSale({ data: f.data.value, produto: f.produto.value, protocolo: f.protocolo.value, quantidade: f.quantidade.value });
    }

    function submitUser(e) {
      e.preventDefault(); toggleLoader(true);
      const f = document.getElementById('formUser');
      google.script.run.withSuccessHandler(res => {
        toggleLoader(false);
        if(res.success) { alert('Cadastrado!'); f.reset(); if(document.getElementById('selEquipeAdmin')) carregarEquipesAdmin(); }
      }).addUser({ email: f.email.value, nome: f.nome.value, equipe: f.equipe.value, cargo: f.cargo.value });
    }

    function submitArchive(e) {
      e.preventDefault();
      if(!confirm("Mover dados para planilha backup e limpar a atual?")) return;
      toggleLoader(true);
      google.script.run.withSuccessHandler(res => {
        toggleLoader(false);
        alert(res.success ? res.message : res.error);
      }).archiveData(e.target.url.value);
    }

    function excludingMembro(email) {
      if(!confirm(`Remover ${email}?`)) return;
      toggleLoader(true);
      google.script.run.withSuccessHandler(res => {
        toggleLoader(false);
        carregarEquipe();
      }).deleteUser(email);
    }

    function navTo(id) {
      document.querySelectorAll('.tab-section').forEach(t => t.classList.remove('active'));
      document.getElementById(id).classList.add('active');
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      
      const btnMap = {'resumo':0, 'venda':1, 'equipe':2, 'admin':3};
      document.querySelectorAll('.nav-btn')[btnMap[id]].classList.add('active');
      
      if(id === 'equipe') carregarEquipe();
    }

    function renderTable(id, data) {
      const tb = document.getElementById(id);
      tb.innerHTML = '';
      if(!data || data.length === 0) tb.innerHTML = '<tr><td colspan="2">Nenhum dado</td></tr>';
      else data.forEach(d => tb.innerHTML += `<tr><td>${d.prod}</td><td>${d.qtd}</td></tr>`);
    }

    function toggleLoader(s) { document.getElementById('loader').style.display = s ? 'flex' : 'none'; }
    function formatMoney(v) { return (v||0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}); }
  </script>
</body>
</html>
~~~
