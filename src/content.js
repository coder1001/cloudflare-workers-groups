/**
 * Orchestrierung: Liste finden, Gruppen-Header einziehen, Zeilen sortieren.
 *
 * Zeilen werden nie aus ihrem Container herausgeloest, sondern nur innerhalb
 * desselben Elternelements umsortiert – sonst streitet man sich mit Reacts
 * Reconciliation und faengt sich "removeChild"-Fehler ein.
 */
(() => {
  const NS = window.__cfwg;
  const { Store, dom, ui } = NS;

  let state = { groups: [], assign: {}, ui: { collapsed: {}, enabled: true } };
  let accountId = dom.accountId();
  let toolbar = null;
  let headers = new Map(); // groupId -> Element
  let observer = null;
  let pending = null;
  let lastSignature = "";
  let lastFound = null;
  let remote = { projects: [], errors: [], loaded: false, fromCache: false, progress: null };
  let fullList = null;   // eigener Container, wenn "Alle Seiten" aktiv ist
  let hidden = [];       // von uns ausgeblendete Original-Elemente

  const UNGROUPED = "__ungrouped__";

  /**
   * Content-Skripte laufen in einer isolierten Welt und sind aus der
   * Seitenkonsole nicht sichtbar. Das DOM teilen sich beide Welten – deshalb
   * legen wir den Zustand als data-Attribute ab, damit sich von aussen pruefen
   * laesst, ob und was die Extension erkannt hat.
   */
  function mark(key, value) {
    try {
      document.documentElement.dataset["cfwg" + key] = String(value);
    } catch {}
  }

  // ------------------------------------------------------------ Hilfsmittel

  function pauseObserver(fn) {
    observer?.disconnect();
    try {
      fn();
    } finally {
      observer?.takeRecords();
      startObserver();
    }
  }

  /**
   * Alles, was der Nutzer zuordnen koennen soll: was auf dieser Seite steht
   * plus alles, was die API kennt (andere Seiten der Liste).
   */
  function allProjects(found) {
    const onPage = new Set((found?.rows || []).map((r) => r.key));
    const byKey = new Map();

    for (const row of found?.rows || []) {
      byKey.set(row.key, { key: row.key, name: row.name, type: row.type, onPage: true });
    }
    // Der Typ aus der API ist geraten (der Overview-Endpunkt mischt Workers und
    // Pages). Der Typ aus dem DOM stammt dagegen aus der Route und ist sicher –
    // steht ein Name schon aus dem DOM da, gewinnt er, sonst gaebe es Dubletten.
    const namesFromDom = new Set((found?.rows || []).map((r) => r.name));
    for (const p of remote.projects) {
      if (byKey.has(p.key) || namesFromDom.has(p.name)) continue;
      byKey.set(p.key, { key: p.key, name: p.name, type: p.type, onPage: onPage.has(p.key) });
    }
    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  let remoteLoading = false;

  async function refreshRemote() {
    if (!NS.api || remoteLoading) return;
    remoteLoading = true;
    try {
      // Zeitlimit, damit die Ansicht bei einer haengenden Antwort nicht
      // dauerhaft im Wartezustand festsitzt
      const res = await Promise.race([
        NS.api.fetchAllProjects(accountId, (p) => {
          remote.progress = p;
          updateToolbarOnly();
        }),
        new Promise((_, ab) =>
          setTimeout(() => ab(new Error("Zeitueberschreitung")), 20000)
        ),
      ]);
      remote = { ...res, loaded: true, fromCache: false, progress: null };
      mark("Remote", res.projects.length);
      mark("Source", res.source || "?");
      if (res.errors.length) mark("RemoteError", res.errors.join(" | "));
      if (res.projects.length) Store.saveCache(accountId, res.projects).catch(() => {});
    } catch (err) {
      remote.loaded = true; // sonst wartet die Ansicht ewig
      remote.progress = null;
      remote.errors = [err?.message || String(err)];
      mark("RemoteError", err?.message || err);
    } finally {
      remoteLoading = false;
    }
    lastSignature = "";
    schedule();
  }

  /**
   * Der Leistenzustand wird an zwei Stellen gebraucht (beim Rendern und
   * waehrend des Ladens). Nur eine Berechnung, sonst driften die beiden
   * auseinander - genau so entstand kurz vor Ladeende ein "fertig"-Text.
   */
  function toolbarState(found) {
    const canFull = remote.projects.length > 0;
    const known = allProjects(found);

    return {
      total: known.length,
      grouped: known.filter((p) => state.assign[p.key]).length,
      onPage: found.rows.length,
      groups: state.groups.length,
      vollstaendig: canFull,
      progress: remote.progress,
      fromCache: remote.fromCache,
      warten: !canFull && !remote.loaded,
    };
  }

  /**
   * Nur die Leiste aktualisieren. Waehrend des Ladens darf die Liste nicht
   * jedes Mal neu gebaut werden - das flackert und kostet unnoetig Arbeit.
   */
  function updateToolbarOnly() {
    if (!toolbar?.isConnected || !lastFound) return;
    ui.updateToolbar(toolbar, toolbarState(lastFound));
  }

  function signature(found) {
    return JSON.stringify({
      enabled: state.ui.enabled,
      groups: state.groups.map((g) => [g.id, g.name, g.color]),
      collapsed: state.ui.collapsed,
      rows: found.rows.map((r) => [r.key, state.assign[r.key] || ""]),
      remote: remote.projects.length,
      loaded: remote.loaded,
    });
  }

  function domIntact(found) {
    if (!found.container.isConnected) return false;
    if (fullList && !fullList.isConnected) return false;
    if (toolbar && !toolbar.isConnected) return false;
    for (const h of headers.values()) if (!h.isConnected) return false;
    return true;
  }

  // ------------------------------------------------------------- Aufbau/Abbau

  function cleanup() {
    pauseObserver(() => {
      for (const node of document.querySelectorAll('[data-cfwg="header"]')) {
        node.remove();
      }
      for (const row of document.querySelectorAll("[data-cfwg-row]")) {
        row.style.display = "";
        row.removeAttribute("data-cfwg-row");
      }
      toolbar?.remove();
      restoreNative();
    });
    toolbar = null;
    headers = new Map();
    lastSignature = "";
  }

  async function persist({ groups, assign }) {
    state.groups = groups;
    state.assign = assign;
    await Promise.all([
      Store.saveGroups(groups),
      Store.saveAssign(accountId, assign),
    ]).catch((err) => console.warn("[cfwg] Speichern fehlgeschlagen:", err));
    lastSignature = "";
    schedule();
  }

  async function setCollapsed(groupId, collapsed) {
    state.ui = { ...state.ui, collapsed: { ...state.ui.collapsed, [groupId]: collapsed } };
    await Store.saveUi(state.ui).catch(() => {});
    lastSignature = "";
    schedule();
  }

  async function setAllCollapsed(collapsed) {
    const next = {};
    for (const g of state.groups) next[g.id] = collapsed;
    next[UNGROUPED] = collapsed;
    state.ui = { ...state.ui, collapsed: next };
    await Store.saveUi(state.ui).catch(() => {});
    lastSignature = "";
    schedule();
  }

  /**
   * Blendet Cloudflares eigene Liste samt Pagination aus. Bewusst ueber
   * display:none statt Entfernen: React verwaltet diese Knoten weiter, und
   * beim Zurueckschalten ist der Originalzustand exakt wiederhergestellt.
   */
  function hideNative(container) {
    // Die Liste selbst und alles, was ihr folgt (dort sitzt die Pagination).
    // Bewusst nicht die vorangehenden Geschwister: da stehen Ueberschriften
    // und Filter, die auszublenden die Seite kaputtaussehen laesst.
    const targets = [container];
    for (let el = container.nextElementSibling; el; el = el.nextElementSibling) {
      if (!el.hasAttribute("data-cfwg")) targets.push(el);
    }
    for (const el of targets) {
      if (el.hasAttribute("data-cfwg-hidden")) continue;
      hidden.push({ el, display: el.style.display });
      el.setAttribute("data-cfwg-hidden", "1");
      el.style.display = "none";
    }
  }

  function restoreNative() {
    for (const { el, display } of hidden) {
      el.style.display = display || "";
      el.removeAttribute("data-cfwg-hidden");
    }
    hidden = [];
    fullList?.remove();
    fullList = null;
  }

  function ensureToolbar(found) {
    if (toolbar?.isConnected) return;
    toolbar = ui.buildToolbar({
      onManage: () => {
        refreshRemote(); // im Hintergrund auffrischen, Dialog oeffnet sofort
        ui.openModal(
          {
            groups: state.groups,
            assign: state.assign,
            projects: allProjects(lastFound),
            remoteLoaded: remote.loaded,
            remoteErrors: remote.errors,
          },
          persist
        );
      },
      onCollapseAll: () => setAllCollapsed(true),
      onExpandAll: () => setAllCollapsed(false),
    });
    const anchor = dom.toolbarAnchor(found.container);
    anchor.parentElement?.insertBefore(toolbar, anchor);
  }

  // -------------------------------------------------------------- Sortierung

  function applyOrder(container, sequence) {
    let prev = null;
    for (const node of sequence) {
      if (node.parentElement !== container) {
        container.insertBefore(node, prev ? prev.nextElementSibling : container.firstElementChild);
      } else if (prev === null) {
        if (container.firstElementChild !== node) {
          container.insertBefore(node, container.firstElementChild);
        }
      } else if (prev.nextElementSibling !== node) {
        container.insertBefore(node, prev.nextElementSibling);
      }
      prev = node;
    }
  }

  function render(found) {
    // Die vollstaendige Liste ist der Normalfall. Wer Cloudflares eigene
    // Ansicht will, schaltet die Erweiterung im Popup ab - dafuer braucht es
    // keinen zweiten Schalter in der Leiste.
    const canFull = remote.projects.length > 0;

    // Solange die Gesamtliste fehlt, waere jede Gruppierung irrefuehrend: sie
    // zeigte nur die Eintraege dieser einen Listenseite und spraenge gleich
    // wieder um. Also Cloudflares Liste unangetastet stehen lassen und warten.
    const warten = !canFull && !remote.loaded;

    if (!canFull && hidden.length) restoreNative();

    if (warten) renderWaiting(found);
    else if (canFull) renderFull(found);
    else renderNative(found); // Rueckfall, wenn die Gesamtliste nicht kommt

    ui.updateToolbar(toolbar, toolbarState(found));
  }

  /** Nur die Leiste, Originalliste bleibt wie sie ist. */
  function renderWaiting(found) {
    pauseObserver(() => {
      for (const old of headers.values()) old.remove();
      headers = new Map();
      ensureToolbar(found);
    });
  }

  /** Eigene, vollstaendige Liste ueber alle Seiten hinweg. */
  function renderFull(found) {
    const projects = allProjects(found);
    const buckets = new Map(state.groups.map((g) => [g.id, []]));
    buckets.set(UNGROUPED, []);
    for (const project of projects) {
      const gid = state.assign[project.key];
      (buckets.get(gid) || buckets.get(UNGROUPED)).push(project);
    }

    const order = [...state.groups, { id: UNGROUPED, name: "Ohne Gruppe", color: "#9aa0a6" }];

    pauseObserver(() => {
      const list = document.createElement("div");
      list.setAttribute("data-cfwg", "fulllist");
      list.className = "cfwg-fulllist";

      for (const group of order) {
        const bucket = buckets.get(group.id) || [];
        if (!bucket.length) continue;

        const collapsed = !!state.ui.collapsed[group.id];
        list.appendChild(
          ui.buildHeader({
            group,
            count: bucket.length,
            collapsed,
            container: list,
            onToggle: () => setCollapsed(group.id, !collapsed),
          })
        );
        if (collapsed) continue;

        for (const project of bucket) {
          list.appendChild(
            ui.buildProjectRow({
              project,
              accountId,
              group: state.groups.find((g) => g.id === state.assign[project.key]),
            })
          );
        }
      }

      const parent = found.container.parentElement;
      if (parent) {
        fullList?.remove();
        hideNative(found.container);
        parent.insertBefore(list, found.container.nextSibling);
        fullList = list;
      }
      ensureToolbar(found);
    });
  }

  function renderNative(found) {
    const { container, rows } = found;

    const buckets = new Map();
    for (const g of state.groups) buckets.set(g.id, []);
    buckets.set(UNGROUPED, []);
    for (const row of rows) {
      const gid = state.assign[row.key];
      (buckets.get(gid) || buckets.get(UNGROUPED)).push(row);
    }

    const order = [...state.groups];
    if (state.groups.length) {
      order.push({ id: UNGROUPED, name: "Ohne Gruppe", color: "#9aa0a6" });
    }

    const nextHeaders = new Map();
    const sequence = [];

    for (const group of order) {
      const bucket = buckets.get(group.id) || [];
      // Leere Gruppen weglassen: seitenweise stuende sonst auf jeder Seite ein
      // Header mit 0 Eintraegen, weil die Mitglieder auf einer anderen liegen.
      if (!bucket.length) continue;

      const collapsed = !!state.ui.collapsed[group.id];
      const header = ui.buildHeader({
        group,
        count: bucket.length,
        collapsed,
        container,
        onToggle: () => setCollapsed(group.id, !collapsed),
      });
      nextHeaders.set(group.id, header);
      sequence.push(header);

      for (const row of bucket) {
        row.row.setAttribute("data-cfwg-row", "1");
        row.row.style.display = collapsed ? "none" : "";
        sequence.push(row.row);
      }
    }

    pauseObserver(() => {
      for (const old of headers.values()) old.remove();
      if (sequence.length) applyOrder(container, sequence);
      headers = nextHeaders;
      ensureToolbar(found);
    });
  }

  // ------------------------------------------------------------------- Lauf

  function sync() {
    mark("Page", dom.isListPage());
    mark("Enabled", state.ui.enabled);
    if (!dom.isListPage() || !state.ui.enabled) {
      if (toolbar || headers.size) cleanup();
      return;
    }
    const found = dom.collectRows();
    mark("Rows", found ? found.rows.length : 0);
    if (!found) return;
    lastFound = found;

    if (!remote.loaded && !remoteLoading) refreshRemote();

    accountId = found.accountId;
    const sig = signature(found);
    if (sig === lastSignature && domIntact(found)) return;
    lastSignature = sig;

    try {
      render(found);
    } catch (err) {
      console.warn("[cfwg] Rendern fehlgeschlagen:", err);
      mark("Error", err && err.message ? err.message : err);
      lastSignature = "";
    }
  }

  function schedule() {
    clearTimeout(pending);
    pending = setTimeout(sync, 150);
  }

  function startObserver() {
    observer?.disconnect();
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function watchNavigation() {
    for (const method of ["pushState", "replaceState"]) {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        onNavigate();
        return result;
      };
    }
    window.addEventListener("popstate", onNavigate);
  }

  let lastPath = location.pathname;
  function onNavigate() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    cleanup();
    schedule();
  }

  async function init() {
    mark("Loaded", chrome.runtime?.getManifest?.()?.version || "dev");
    state = await Store.load(accountId).catch(() => state);
    Store.onChange(async () => {
      state = await Store.load(accountId).catch(() => state);
      lastSignature = "";
      schedule();
    });
    watchNavigation();
    startObserver();

    // Cache zuerst: die Ansicht steht sofort, der Abgleich laeuft daneben
    const cache = await Store.loadCache(accountId).catch(() => null);
    if (cache?.projects?.length) {
      remote = { projects: cache.projects, errors: [], loaded: false, fromCache: true, progress: null };
      mark("Cache", cache.projects.length);
    }

    schedule();
    if (dom.isListPage()) refreshRemote();
  }

  init();
})();
