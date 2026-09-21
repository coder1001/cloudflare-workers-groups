/**
 * Vollstaendige Projektliste ueber die API, die das Dashboard selbst benutzt.
 *
 * Das DOM zeigt immer nur die gerade sichtbare Listenseite (Standard: 10
 * Eintraege) – zum Zuordnen braucht man aber alle Projekte. Der Aufruf laeuft
 * same-origin auf dash.cloudflare.com, die Session-Cookies gehen also mit:
 * kein API-Token, keine zusaetzliche Berechtigung, nichts verlaesst den Browser.
 *
 * Bevorzugt wird der kombinierte Endpunkt, den das Dashboard selbst zieht
 * (workers-and-pages/overview). Er ist nicht dokumentiert, deshalb gibt es
 * Fallbacks auf die Einzellisten; schlaegt alles fehl, faellt die Extension
 * still auf das DOM der aktuellen Seite zurueck.
 */
(() => {
  const NS = (window.__cfwg = window.__cfwg || {});

  // Der Overview-Endpunkt lehnt zu grosse Seiten mit HTTP 400 ab; welches
  // Limit gilt, ist nicht dokumentiert. Deshalb absteigend probieren und beim
  // ersten Wert bleiben, der durchgeht. 10 ist der Wert, den das Dashboard
  // selbst benutzt, also die sichere Untergrenze.
  const PER_PAGE_LADDER = [100, 50, 25, 10];
  const MAX_PAGES = 60; // Notbremse gegen kaputte Pagination

  const OVERVIEW = (id, p, n) =>
    `/api/v4/accounts/${id}/workers-and-pages/overview` +
    `?page=${p}&per_page=${n}&sort=last_modified`;

  const WORKERS = [
    (id, p, n) => `/api/v4/accounts/${id}/workers/scripts?page=${p}&per_page=${n}`,
    (id, p, n) => `/api/v4/accounts/${id}/workers/services?page=${p}&per_page=${n}`,
  ];
  const PAGES = [
    (id, p, n) => `/api/v4/accounts/${id}/pages/projects?page=${p}&per_page=${n}`,
  ];

  async function getJson(url) {
    const res = await fetch(url, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (body && body.success === false) {
      throw new Error(body.errors?.[0]?.message || "success=false");
    }
    return body;
  }

  function nameOf(item) {
    if (!item || typeof item !== "object") return null;
    const name = item.name || item.id || item.script_name;
    return typeof name === "string" && name ? name : null;
  }

  /**
   * Der Overview-Endpunkt mischt Workers und Pages. Welches Feld den Typ
   * traegt, ist nicht dokumentiert – deshalb breit geraten und notfalls
   * anhand Pages-typischer Felder entschieden.
   */
  function kindOf(item) {
    const t = String(
      item.type || item.resource_type || item.product || item.kind || ""
    ).toLowerCase();
    if (t.includes("page")) return "pages";
    if (t.includes("worker") || t.includes("script") || t.includes("service")) return "worker";
    if (item.production_branch || item.source || item.canonical_deployment) return "pages";
    return "worker";
  }

  /** Blaettert einen Endpunkt mit gegebener Seitengroesse komplett durch. */
  async function drain(build, accountId, classify, perPage, onProgress) {
    const items = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const body = await getJson(build(accountId, page, perPage));
      const result = Array.isArray(body?.result) ? body.result : [];

      for (const raw of result) {
        const name = nameOf(raw);
        if (!name) continue;
        const type = classify(raw);
        items.push({ type, name, key: `${type}/${name}` });
      }

      const total = Number(body?.result_info?.total_pages) || null;
      onProgress?.({ page, total, geladen: items.length });
      if (total ? page >= total : result.length < perPage) break;
    }
    return items;
  }

  async function tryAll(builders, accountId, classify, onProgress) {
    let lastError = null;
    for (const build of builders) {
      for (const perPage of PER_PAGE_LADDER) {
        try {
          const items = await drain(build, accountId, classify, perPage, onProgress);
          if (items.length) {
            return { items, endpoint: build(accountId, 1, perPage), perPage };
          }
        } catch (err) {
          lastError = err;
          // 400 heisst in aller Regel: Seite zu gross – naechstkleinere probieren.
          // Alles andere ist ein Problem des Endpunkts selbst, also abbrechen.
          if (!/\b400\b/.test(String(err.message))) break;
        }
      }
    }
    return { items: [], error: lastError?.message || "keine Liste erhalten" };
  }

  async function fetchAllProjects(accountId, onProgress) {
    // 1. Wahl: der kombinierte Endpunkt des Dashboards
    const overview = await tryAll([OVERVIEW], accountId, kindOf, onProgress);
    if (overview.items.length) {
      return {
        projects: dedupe(overview.items),
        source: `overview (per_page=${overview.perPage})`,
        endpoints: [overview.endpoint],
        errors: [],
      };
    }

    // Fallback: getrennte Listen
    const [workers, pages] = await Promise.all([
      tryAll(WORKERS, accountId, () => "worker", onProgress),
      tryAll(PAGES, accountId, () => "pages", onProgress),
    ]);

    return {
      projects: dedupe([...workers.items, ...pages.items]),
      source: "einzellisten",
      endpoints: [workers.endpoint, pages.endpoint].filter(Boolean),
      errors: [overview.error, workers.error, pages.error].filter(Boolean),
    };
  }

  function dedupe(items) {
    const byKey = new Map();
    for (const item of items) byKey.set(item.key, item);
    return [...byKey.values()];
  }

  NS.api = { fetchAllProjects };
})();
