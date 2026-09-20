/**
 * Erkennung der Projektliste.
 *
 * Bewusst NICHT ueber CSS-Klassen: die sind im Cloudflare-Dashboard gehasht und
 * aendern sich mit jedem Build. Anker ist stattdessen das href-Muster der
 * Projektlinks – das haengt an der Routing-Struktur und ist deutlich stabiler.
 */
(() => {
  const NS = (window.__cfwg = window.__cfwg || {});

  const PATTERNS = [
    { type: "worker", re: /^\/[^/]+\/workers\/services\/view\/([^/?#]+)/ },
    { type: "pages", re: /^\/[^/]+\/pages\/view\/([^/?#]+)/ },
  ];

  const TABLEISH = new Set(["TABLE", "THEAD", "TBODY", "TFOOT", "TR"]);

  function accountId() {
    const m = location.pathname.match(/^\/([0-9a-fA-F]{32})(\/|$)/);
    return m ? m[1].toLowerCase() : "default";
  }

  function isListPage() {
    const p = location.pathname.replace(/\/+$/, "");
    return (
      /^\/[^/]+\/workers-and-pages$/.test(p) ||
      /^\/[^/]+\/workers\/services$/.test(p) ||
      /^\/[^/]+\/pages$/.test(p)
    );
  }

  function parseProject(a) {
    let path;
    try {
      path = new URL(a.getAttribute("href"), location.origin).pathname;
    } catch {
      return null;
    }
    for (const p of PATTERNS) {
      const m = path.match(p.re);
      if (m) return { type: p.type, name: decodeURIComponent(m[1]) };
    }
    return null;
  }

  /**
   * Zeile = groesster Vorfahre, der genau einen der gefundenen Projektlinks
   * enthaelt. Sein Elternelement ist damit der Listen-Container.
   */
  function rowFor(anchor, anchors) {
    let el = anchor;
    while (el.parentElement && el.parentElement !== document.body) {
      const parent = el.parentElement;
      let count = 0;
      for (const other of anchors) {
        if (parent.contains(other)) count++;
        if (count > 1) break;
      }
      if (count > 1) return el;
      el = parent;
    }
    return el;
  }

  function collectRows(root = document) {
    // pro Projekt nur der erste Link – eine Zeile verlinkt ihr Projekt oft mehrfach
    const byKey = new Map();
    for (const a of root.querySelectorAll("a[href]")) {
      if (a.closest("[data-cfwg]")) continue; // eigene UI ignorieren
      const p = parseProject(a);
      if (!p) continue;
      const key = `${p.type}/${p.name}`;
      if (!byKey.has(key)) byKey.set(key, { a, key, ...p });
    }
    if (byKey.size < 2) return null;

    const items = [...byKey.values()];
    const anchors = items.map((i) => i.a);

    // nach Container gruppieren, groesste Gruppe gewinnt (filtert Sidebar-Links raus)
    const byContainer = new Map();
    for (const item of items) {
      const row = rowFor(item.a, anchors);
      const container = row.parentElement;
      if (!container) continue;
      if (!byContainer.has(container)) byContainer.set(container, []);
      byContainer.get(container).push({ ...item, row });
    }

    let best = null;
    for (const [container, rows] of byContainer) {
      if (!best || rows.length > best.rows.length) best = { container, rows };
    }
    if (!best || best.rows.length < 2) return null;

    const seen = new Set();
    const rows = best.rows.filter((r) =>
      seen.has(r.row) ? false : (seen.add(r.row), true)
    );

    return { container: best.container, rows, accountId: accountId() };
  }

  /**
   * Stelle, an der die Toolbar ueber der Liste landen kann, ohne Tabellen zu
   * zerlegen: bei <tbody> das umschliessende <table>, sonst der Container selbst.
   */
  function toolbarAnchor(container) {
    let el = container;
    while (el.parentElement && TABLEISH.has(el.parentElement.tagName)) {
      el = el.parentElement;
    }
    return el;
  }

  function isTableContainer(container) {
    return TABLEISH.has(container.tagName);
  }

  function columnCount(container) {
    for (const child of container.children) {
      if (child.hasAttribute?.("data-cfwg")) continue;
      if (child.children.length) return child.children.length;
    }
    return 1;
  }

  NS.dom = {
    accountId,
    isListPage,
    parseProject,
    collectRows,
    toolbarAnchor,
    isTableContainer,
    columnCount,
  };
})();
