/** Alle von der Extension erzeugten Elemente tragen data-cfwg="..." */
(() => {
  const NS = (window.__cfwg = window.__cfwg || {});
  const Store = NS.Store;

  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null) node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c) node.appendChild(c);
    return node;
  };

  const dot = (color) =>
    el("span", { class: "cfwg-dot", style: `background:${color}` });

  // ---------------------------------------------------------------- Toolbar

  function buildToolbar(handlers) {
    const bar = el("div", { "data-cfwg": "toolbar", class: "cfwg-toolbar" });
    bar.append(
      el("div", { "data-cfwg-progress": "1", class: "cfwg-progress" }, [
        el("div", { class: "cfwg-progress-fill" }),
      ]),
      el("span", { class: "cfwg-brand", text: "Gruppen" }),
      el("span", { "data-cfwg-stats": "1", class: "cfwg-stats" }),
      el("span", { class: "cfwg-spacer" }),
      el("button", {
        class: "cfwg-btn cfwg-btn-primary",
        type: "button",
        text: "Zuordnen …",
        onclick: handlers.onManage,
      }),
      el("button", {
        class: "cfwg-btn",
        type: "button",
        text: "Alle einklappen",
        onclick: handlers.onCollapseAll,
      }),
      el("button", {
        class: "cfwg-btn",
        type: "button",
        text: "Alle ausklappen",
        onclick: handlers.onExpandAll,
      })
    );
    return bar;
  }

  function updateToolbar(
    bar,
    { grouped, total, groups, onPage, vollstaendig, progress, fromCache, warten }
  ) {
    const stats = bar.querySelector("[data-cfwg-stats]");
    if (stats) {
      let text;
      if (warten) {
        // Seitenzahl nur nennen, wenn es wirklich mehrere sind
        text =
          progress?.total > 1
            ? `Projekte werden geladen … Seite ${progress.page} von ${progress.total}`
            : "Projekte werden geladen …";
      } else {
        text = `${groups} Gruppen · ${grouped}/${total} zugeordnet`;
        // Nur erwaehnen, wenn etwas fehlt - der Normalfall braucht keinen Hinweis
        if (!vollstaendig) text += ` · nur diese Listenseite (${onPage})`;
        if (fromCache) text += " · aktualisiere …";
      }
      stats.textContent = text;
    }

    // Balken: bekannt gewordene Seitenzahl als Anteil, sonst unbestimmt
    const prog = bar.querySelector("[data-cfwg-progress]");
    if (prog) {
      const laeuft = !!progress || warten || fromCache;
      prog.classList.toggle("cfwg-progress-on", laeuft);
      prog.classList.toggle("cfwg-progress-unbestimmt", laeuft && !progress?.total);
      const fill = prog.querySelector(".cfwg-progress-fill");
      if (fill) {
        fill.style.width = progress?.total
          ? Math.round((progress.page / progress.total) * 100) + "%"
          : "";
      }
    }

  }

  // --------------------------------------------------------- Gruppen-Header

  function buildHeader({ group, count, collapsed, container, onToggle }) {
    const isTable = NS.dom.isTableContainer(container);
    const row = el(isTable ? "tr" : "div", {
      "data-cfwg": "header",
      "data-cfwg-group": group.id,
      class: "cfwg-header-row",
    });

    let host = row;
    if (isTable) {
      const cell = el("td", { colspan: String(NS.dom.columnCount(container)) });
      row.appendChild(cell);
      host = cell;
    } else if (getComputedStyle(container).display.includes("grid")) {
      row.style.gridColumn = "1 / -1";
    }

    const button = el("button", {
      class: "cfwg-header" + (collapsed ? " cfwg-header-collapsed" : ""),
      type: "button",
      "aria-expanded": String(!collapsed),
      title: collapsed ? "Gruppe ausklappen" : "Gruppe einklappen",
      onclick: onToggle,
    });
    // Achtung: Element.append(null) fuegt den Text "null" ein – daher filtern.
    button.append(
      ...[
        el("span", {
          class: "cfwg-caret" + (collapsed ? " cfwg-caret-collapsed" : ""),
          text: "▾",
        }),
        dot(group.color || "#888"),
        el("span", { class: "cfwg-header-name", text: group.name }),
        // Der Pfeil allein war zu leise – der Zustand steht zusaetzlich als Wort da
        collapsed ? el("span", { class: "cfwg-state", text: "eingeklappt" }) : null,
        el("span", { class: "cfwg-count", text: String(count) }),
      ].filter(Boolean)
    );
    button.style.setProperty("--cfwg-group", group.color || "#888");
    host.appendChild(button);
    return row;
  }

  // -------------------------------------------------- Zeile der eigenen Liste

  function buildProjectRow({ project, accountId, group }) {
    const href =
      project.type === "pages"
        ? `/${accountId}/pages/view/${project.name}`
        : `/${accountId}/workers/services/view/${project.name}/production`;

    const row = el("a", {
      "data-cfwg": "row",
      class: "cfwg-row",
      href,
      title: project.name,
    });
    row.append(
      el("span", { class: "cfwg-type", text: project.type === "pages" ? "Pages" : "Worker" }),
      el("span", { class: "cfwg-rowname", text: project.name }),
      group ? dot(group.color) : el("span", { class: "cfwg-spacer" })
    );
    return row;
  }

  // ------------------------------------------------------------------ Modal

  const ALL = "__all__";
  const NONE = "__none__";

  /**
   * Bewusst genau EIN Scroll-Bereich (der Listenkoerper). Zwei uebereinander
   * gestapelte Scroll-Listen lesen sich wie abgeschnittener Inhalt – man sucht
   * dann Eintraege, die gar nicht verdeckt sind. Alles Steuernde (Reiter,
   * Suche, Gruppen-Chips, Sammelaktion) steht fix darueber und ist immer
   * vollstaendig sichtbar.
   */
  function openModal(state, commit) {
    document.querySelector('[data-cfwg="overlay"]')?.remove();

    const overlay = el("div", { "data-cfwg": "overlay", class: "cfwg-overlay" });
    const modal = el("div", { class: "cfwg-modal", role: "dialog" });
    overlay.appendChild(modal);

    let groups = state.groups.map((g) => ({ ...g }));
    let assign = { ...state.assign };
    let tab = "projects";
    let chip = ALL;
    let query = "";
    const selected = new Set();

    const close = () => overlay.remove();
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) close();
    });
    const onKey = (e) => {
      if (e.key === "Escape" && document.contains(overlay)) {
        close();
        document.removeEventListener("keydown", onKey);
      }
    };
    document.addEventListener("keydown", onKey);

    const save = () => commit({ groups, assign });
    const groupById = (id) => groups.find((g) => g.id === id);

    const countOf = (id) =>
      id === NONE
        ? state.projects.filter((p) => !assign[p.key]).length
        : state.projects.filter((p) => assign[p.key] === id).length;

    function visibleProjects() {
      const q = query.trim().toLowerCase();
      return state.projects.filter((p) => {
        if (q && !p.name.toLowerCase().includes(q)) return false;
        if (chip === ALL) return true;
        if (chip === NONE) return !assign[p.key];
        return assign[p.key] === chip;
      });
    }

    // ------------------------------------------------------------ Kopfzeile

    function head() {
      const tabs = el("div", { class: "cfwg-tabs" });
      const mk = (id, label) => {
        const b = el("button", {
          class: "cfwg-tab" + (tab === id ? " cfwg-tab-on" : ""),
          type: "button",
          text: label,
          onclick: () => {
            tab = id;
            render();
          },
        });
        return b;
      };
      tabs.append(
        mk("projects", `Projekte (${state.projects.length})`),
        mk("groups", `Gruppen (${groups.length})`)
      );

      return el("div", { class: "cfwg-modal-head" }, [
        el("h2", { class: "cfwg-modal-title", text: "Projekte gruppieren" }),
        tabs,
        el("button", {
          class: "cfwg-x",
          type: "button",
          text: "×",
          title: "Schließen",
          onclick: close,
        }),
      ]);
    }

    // ------------------------------------------- Steuerbereich (fix, oben)

    function controls() {
      if (tab === "groups") return groupAdder();

      const search = el("input", {
        class: "cfwg-input cfwg-search",
        type: "search",
        placeholder: "Projekt suchen …",
        value: query,
      });
      search.addEventListener("input", () => {
        query = search.value;
        render({ focus: "search" });
      });

      const chips = el("div", { class: "cfwg-chips" });
      const mkChip = (id, label, color) => {
        const c = el("button", {
          class: "cfwg-chip" + (chip === id ? " cfwg-chip-on" : ""),
          type: "button",
          onclick: () => {
            chip = id;
            render();
          },
        });
        if (color) c.appendChild(dot(color));
        c.append(
          el("span", { text: label }),
          el("span", { class: "cfwg-chip-count", text: String(id === ALL ? state.projects.length : countOf(id)) })
        );
        return c;
      };

      chips.append(mkChip(ALL, "Alle"));
      for (const g of groups) chips.appendChild(mkChip(g.id, g.name, g.color));
      chips.appendChild(mkChip(NONE, "Ohne Gruppe"));

      const rows = [
        el("div", { class: "cfwg-controlrow" }, [
          search,
          el("span", { class: "cfwg-spacer" }),
          el("button", {
            class: "cfwg-btn",
            type: "button",
            text: "＋ Gruppe",
            title: "Neue Gruppe anlegen",
            onclick: () => {
              tab = "groups";
              render({ focus: "newgroup" });
            },
          }),
        ]),
        chips,
      ];

      if (selected.size) rows.push(bulkBar());
      return el("div", { class: "cfwg-controls" }, rows);
    }

    function bulkBar() {
      const sel = el("select", { class: "cfwg-input cfwg-bulk" });
      sel.append(
        el("option", { value: "", text: "— ohne Gruppe —" }),
        ...groups.map((g) => el("option", { value: g.id, text: g.name }))
      );

      return el("div", { class: "cfwg-bulkbar" }, [
        el("strong", { text: `${selected.size} ausgewählt` }),
        el("span", { class: "cfwg-spacer" }),
        sel,
        el("button", {
          class: "cfwg-btn cfwg-btn-primary",
          type: "button",
          text: "Zuweisen",
          onclick: () => {
            for (const key of selected) {
              if (sel.value) assign[key] = sel.value;
              else delete assign[key];
            }
            selected.clear();
            save();
            render();
          },
        }),
        el("button", {
          class: "cfwg-btn",
          type: "button",
          text: "Aufheben",
          onclick: () => {
            selected.clear();
            render();
          },
        }),
      ]);
    }

    function groupAdder() {
      const input = el("input", {
        class: "cfwg-input cfwg-newgroup",
        type: "text",
        placeholder: "Neue Gruppe …",
      });
      const add = () => {
        const name = input.value.trim();
        if (!name) return;
        groups.push({ id: Store.uid(), name, color: Store.nextColor(groups) });
        input.value = "";
        save();
        render({ focus: "newgroup" });
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          add();
        }
      });

      return el("div", { class: "cfwg-controls" }, [
        el("div", { class: "cfwg-controlrow" }, [
          input,
          el("button", {
            class: "cfwg-btn cfwg-btn-primary",
            type: "button",
            text: "Hinzufügen",
            onclick: add,
          }),
        ]),
      ]);
    }

    // ------------------------------------- Listenkoerper (der einzige Scroll)

    function body() {
      const list = el("div", { class: "cfwg-modal-body" });
      if (tab === "groups") groupList(list);
      else projectList(list);
      return list;
    }

    function groupList(list) {
      if (!groups.length) {
        list.appendChild(
          el("p", { class: "cfwg-empty", text: "Noch keine Gruppen. Oben eine anlegen." })
        );
        return;
      }

      groups.forEach((g, i) => {
        const name = el("input", { class: "cfwg-input cfwg-group-name", type: "text", value: g.name });
        name.addEventListener("change", () => {
          g.name = name.value.trim() || g.name;
          save();
          render();
        });

        const move = (delta) => () => {
          const j = i + delta;
          if (j < 0 || j >= groups.length) return;
          [groups[i], groups[j]] = [groups[j], groups[i]];
          save();
          render();
        };

        list.appendChild(
          el("div", { class: "cfwg-grouprow" }, [
            dot(g.color),
            name,
            el("span", { class: "cfwg-muted", text: `${countOf(g.id)} Projekte` }),
            el("button", { class: "cfwg-icon", type: "button", text: "↑", title: "Nach oben", onclick: move(-1) }),
            el("button", { class: "cfwg-icon", type: "button", text: "↓", title: "Nach unten", onclick: move(1) }),
            el("button", {
              class: "cfwg-icon cfwg-danger",
              type: "button",
              text: "✕",
              title: "Gruppe löschen",
              onclick: () => {
                if (!confirm(`Gruppe "${g.name}" löschen? Die Projekte wandern zurück nach "Ohne Gruppe".`)) return;
                groups = groups.filter((x) => x.id !== g.id);
                for (const [k, v] of Object.entries(assign)) if (v === g.id) delete assign[k];
                if (chip === g.id) chip = ALL;
                save();
                render();
              },
            }),
          ])
        );
      });
    }

    function projectList(list) {
      const visible = visibleProjects();

      if (!visible.length) {
        list.appendChild(
          el("p", {
            class: "cfwg-empty",
            text: query ? "Kein Projekt passt zur Suche." : "Hier ist nichts.",
          })
        );
        return;
      }

      const allBox = el("input", { type: "checkbox", class: "cfwg-check" });
      allBox.checked = visible.every((p) => selected.has(p.key));
      allBox.addEventListener("change", () => {
        for (const p of visible) {
          if (allBox.checked) selected.add(p.key);
          else selected.delete(p.key);
        }
        render();
      });
      list.appendChild(
        el("div", { class: "cfwg-prow cfwg-thead" }, [
          allBox,
          el("span", { class: "cfwg-muted", text: `${visible.length} angezeigt` }),
        ])
      );

      for (const p of visible) {
        const box = el("input", { type: "checkbox", class: "cfwg-check" });
        box.checked = selected.has(p.key);
        box.addEventListener("change", () => {
          box.checked ? selected.add(p.key) : selected.delete(p.key);
          render({ keepScroll: true });
        });

        const sel = el("select", { class: "cfwg-input cfwg-assign" });
        sel.append(
          el("option", { value: "", text: "— ohne Gruppe —" }),
          ...groups.map((g) => el("option", { value: g.id, text: g.name }))
        );
        sel.value = assign[p.key] || "";

        const swatch = dot(groupById(sel.value)?.color || "transparent");

        sel.addEventListener("change", () => {
          if (sel.value) assign[p.key] = sel.value;
          else delete assign[p.key];
          save();
          // Bei aktivem Filter faellt die Zeile ggf. raus – dann neu zeichnen.
          // Ohne Filter bleibt sie stehen, damit nichts unter dem Cursor springt.
          if (chip !== ALL) render({ keepScroll: true });
          else {
            swatch.style.background = groupById(sel.value)?.color || "transparent";
            refreshChipCounts();
          }
        });

        list.appendChild(
          el("div", { class: "cfwg-prow" }, [
            box,
            el("span", { class: "cfwg-type", text: p.type === "pages" ? "Pages" : "Worker" }),
            el("span", { class: "cfwg-pname", text: p.name, title: p.name }),
            p.onPage === false
              ? el("span", {
                  class: "cfwg-offpage",
                  text: "andere Seite",
                  title: "Steht nicht auf der gerade angezeigten Listenseite",
                })
              : null,
            swatch,
            sel,
          ])
        );
      }
    }

    /** Nur die Zahlen in den Chips nachziehen, ohne die Liste neu zu bauen. */
    function refreshChipCounts() {
      const chips = modal.querySelectorAll(".cfwg-chip");
      if (!chips.length) return;
      const ids = [ALL, ...groups.map((g) => g.id), NONE];
      chips.forEach((c, i) => {
        const el2 = c.querySelector(".cfwg-chip-count");
        const id = ids[i];
        if (el2 && id) {
          el2.textContent = String(id === ALL ? state.projects.length : countOf(id));
        }
      });
    }

    // -------------------------------------------------------------- Fusszeile

    function foot() {
      const hint = state.remoteErrors?.length
        ? "Gesamtliste nicht abrufbar – nur diese Listenseite. (" + state.remoteErrors.join(" | ") + ")"
        : !state.remoteLoaded
        ? "Gesamtliste wird geladen …"
        : "Änderungen werden sofort gespeichert.";

      return el("div", { class: "cfwg-modal-foot" }, [
        el("span", {
          class: "cfwg-muted" + (state.remoteErrors?.length ? " cfwg-warn" : ""),
          text: hint,
        }),
        el("span", { class: "cfwg-spacer" }),
        el("button", { class: "cfwg-btn cfwg-btn-primary", type: "button", text: "Fertig", onclick: close }),
      ]);
    }

    // ------------------------------------------------------------ Zeichnen

    function render(opts = {}) {
      const prev = modal.querySelector(".cfwg-modal-body");
      const scroll = prev ? prev.scrollTop : 0;
      const caret = modal.querySelector(".cfwg-search")?.selectionStart ?? null;

      modal.textContent = "";
      modal.append(head(), controls(), body(), foot());

      const next = modal.querySelector(".cfwg-modal-body");
      if (next && (opts.keepScroll || opts.focus || scroll)) next.scrollTop = scroll;

      if (opts.focus === "search") {
        const s = modal.querySelector(".cfwg-search");
        s?.focus();
        if (caret != null) s?.setSelectionRange(caret, caret);
      } else if (opts.focus === "newgroup") {
        modal.querySelector(".cfwg-newgroup")?.focus();
      }
    }

    render();
    document.body.appendChild(overlay);
    modal.querySelector(".cfwg-search")?.focus();
  }

  NS.ui = { buildToolbar, updateToolbar, buildHeader, buildProjectRow, openModal };
})();
