/**
 * ============================================================
 * PortoBank Performance — API.gs
 * ------------------------------------------------------------
 * ÚNICO ponto de entrada exposto ao cliente via
 * google.script.run. Toda chamada:
 *   1. autentica o usuário (getCurrentUser_)
 *   2. valida permissões no módulo de destino
 *   3. devolve envelope {ok, data | error}
 *
 * O cliente NUNCA chama funções internas diretamente.
 * ============================================================
 */

/**
 * Roteador principal.
 * @param {string} action Nome da ação.
 * @param {Object=} payload Dados da ação.
 * @return {string} JSON {ok, data|error}
 */
function api(action, payload) {
  payload = payload || {};
  try {
    const me = getCurrentUser_();
    let data;

    switch (action) {
      // ---- Sessão / bootstrap da UI ----
      case 'session':
        data = {
          user: publicUser_(me),
          permissions: getPermissions_(me),
          roles: Object.keys(PERMISSIONS),
          retentionProducts: RETENTION_PRODUCTS,
          reportTypes: REPORT_TYPES,
          themes: THEMES,
          products: readAll_(SHEETS.PRODUCTS).filter(function (p) { return p.ativo === 'Sim'; }),
          teams: readAll_(SHEETS.TEAMS)
        };
        break;

      // ---- Dashboards ----
      case 'dashboard': data = dashboardBuild_(me, payload.mes); break;
      case 'team': data = teamBuild_(me, payload.mes); break;
      case 'ranking': data = rankingBuild_(me, payload.mes); break;

      // ---- Lançamentos ----
      case 'sales.create': data = salesCreate_(me, payload); break;
      case 'retention.create': data = retentionCreate_(me, payload); break;

      // ---- Usuários ----
      case 'users.list':
        data = visibleUsers_(me).map(publicUser_);
        break;
      case 'users.create': data = publicUser_(usersCreate_(me, payload)); break;
      case 'users.update': data = usersUpdate_(me, payload.id, payload); break;
      case 'users.delete': data = usersDelete_(me, payload.id); break;
      case 'users.theme': data = usersSetTheme_(me, payload.tema); break;

      // ---- Metas ----
      case 'goals.set': data = goalsSet_(me, payload); break;
      case 'goals.get': data = goalForUser_(me, payload.mes); break;

      // ---- Indicadores individuais (supervisor/admin) ----
      case 'users.indicators': {
        const target = readAll_(SHEETS.USERS).find(function (u) { return String(u.id) === String(payload.id); });
        if (!target) throw new Error('Usuário não encontrado.');
        assertCanManage_(me, target);
        data = {
          user: publicUser_(target),
          dashboard: dashboardBuild_(target, payload.mes),
          comissao: commissionForUser_(target, payload.mes)
        };
        break;
      }

      // ---- Relatórios ----
      case 'reports.generate': data = reportGenerate_(me, payload.tipo, payload.mes); break;

      // ---- Configurações (ADMIN) ----
      case 'settings.list':
        if (!isAdmin_(me)) throw new Error('Somente o ADMIN pode ver configurações.');
        data = readAll_(SHEETS.SETTINGS);
        break;
      case 'settings.update': data = settingsUpdate_(me, payload.chave, payload.valor); break;
      case 'products.save': data = productsSave_(me, payload); break;
      case 'products.delete': data = productsDelete_(me, payload.id); break;
      case 'teams.save': data = teamsSave_(me, payload); break;
      case 'teams.delete': data = teamsDelete_(me, payload.id); break;

      default:
        throw new Error('Ação desconhecida: ' + action);
    }

    return JSON.stringify({ ok: true, data: data });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e.message || e) });
  }
}

/** Remove campos internos antes de enviar ao cliente. */
function publicUser_(u) {
  return {
    id: u.id, nome: u.nome, email: u.email, cargo: u.cargo,
    equipe: u.equipe, status: u.status, tema: u.tema || 'portobank'
  };
}
