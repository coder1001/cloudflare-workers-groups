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

  const UNGROUPED = "__ungrouped__";

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

  function signature(found) {
    return JSON.stringify({
      enabled: state.ui.enabled,
      groups: state.groups.map((g) => [g.id, g.name, g.color]),
      collapsed: state.ui.collapsed,
      rows: found.rows.map((r) => [r.key, state.assign[r.key] || ""]),
    });
  }

  function domIntact(found) {
    if (!found.container.isConnected) return false;
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

  function ensureToolbar(found) {
    if (toolbar?.isConnected) return;
    toolbar = ui.buildToolbar({
      onManage: () =>
        ui.openModal(
          {
            groups: state.groups,
            assign: state.assign,
            projects: found.rows
              .map((r) => ({ key: r.key, name: r.name, type: r.type }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          },
          persist
        ),
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
      if (group.id === UNGROUPED && !bucket.length) continue;

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
      ui.updateToolbar(toolbar, {
        total: rows.length,
        grouped: rows.filter((r) => state.assign[r.key]).length,
        groups: state.groups.length,
      });
    });
  }

  // ------------------------------------------------------------------- Lauf

  function sync() {
    if (!dom.isListPage() || !state.ui.enabled) {
      if (toolbar || headers.size) cleanup();
      return;
    }
    const found = dom.collectRows();
    if (!found) return;

    accountId = found.accountId;
    const sig = signature(found);
    if (sig === lastSignature && domIntact(found)) return;
    lastSignature = sig;

    try {
      render(found);
    } catch (err) {
      console.warn("[cfwg] Rendern fehlgeschlagen:", err);
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
    state = await Store.load(accountId).catch(() => state);
    Store.onChange(async () => {
      state = await Store.load(accountId).catch(() => state);
      lastSignature = "";
      schedule();
    });
    watchNavigation();
    startObserver();
    schedule();
  }

  init();
})();
