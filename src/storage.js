/**
 * Speicher-Schicht. Bewusst die einzige Stelle, die weiss, WO die Zuordnung
 * liegt – ein Umstieg auf Cloudflare Resource Tagging tauscht nur diese Datei.
 *
 * Layout in chrome.storage.sync:
 *   groups            -> [{ id, name, color }]                (accountuebergreifend)
 *   assign:<account>   -> { "<type>/<name>": groupId }          (pro Cloudflare-Account)
 *   ui                -> { collapsed: { groupId: bool }, enabled: bool }
 */
(() => {
  const NS = (window.__cfwg = window.__cfwg || {});
  const S = chrome.storage.sync;

  const KEY_GROUPS = "groups";
  const KEY_UI = "ui";
  const assignKey = (accountId) => `assign:${accountId}`;

  const PALETTE = [
    "#f6821f", "#0051c3", "#00a86b", "#9333ea",
    "#d64545", "#0ea5b7", "#b45309", "#4f46e5",
  ];

  function get(keys) {
    return new Promise((resolve, reject) =>
      S.get(keys, (v) =>
        chrome.runtime.lastError
          ? reject(new Error(chrome.runtime.lastError.message))
          : resolve(v)
      )
    );
  }

  function set(obj) {
    return new Promise((resolve, reject) =>
      S.set(obj, () =>
        chrome.runtime.lastError
          ? reject(new Error(chrome.runtime.lastError.message))
          : resolve()
      )
    );
  }

  const Store = {
    PALETTE,

    uid() {
      return "g" + Math.random().toString(36).slice(2, 9);
    },

    nextColor(groups) {
      return PALETTE[groups.length % PALETTE.length];
    },

    async load(accountId) {
      const d = await get([KEY_GROUPS, KEY_UI, assignKey(accountId)]);
      const ui = d[KEY_UI] || {};
      return {
        groups: Array.isArray(d[KEY_GROUPS]) ? d[KEY_GROUPS] : [],
        assign: d[assignKey(accountId)] || {},
        ui: {
          collapsed: ui.collapsed || {},
          enabled: ui.enabled !== false,
        },
      };
    },

    saveGroups(groups) {
      return set({ [KEY_GROUPS]: groups });
    },

    saveAssign(accountId, assign) {
      // leere Zuordnungen nicht mitschleppen – spart Platz im 8-KB-Item-Limit
      const clean = {};
      for (const [k, v] of Object.entries(assign)) if (v) clean[k] = v;
      return set({ [assignKey(accountId)]: clean });
    },

    saveUi(ui) {
      return set({ [KEY_UI]: ui });
    },

    onChange(cb) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "sync") cb(changes);
      });
    },

    exportAll() {
      return new Promise((resolve) => S.get(null, resolve));
    },

    importAll(data) {
      return set(data);
    },
  };

  NS.Store = Store;
})();
