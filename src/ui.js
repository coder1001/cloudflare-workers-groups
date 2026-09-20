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
        "data-cfwg-all": "1",
        text: "Alle Seiten",
        onclick: handlers.onToggleAllPages,
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

  function updateToolbar(bar, { grouped, total, groups, onPage, allPages, canAllPages }) {
    const stats = bar.querySelector("[data-cfwg-stats]");
    if (stats) {
      let text = `${groups} Gruppen · ${grouped}/${total} zugeordnet`;
      if (allPages) text += " · alle Seiten";
      else if (onPage != null && onPage < total) text += ` · ${onPage} auf dieser Seite`;
      stats.textContent = text;
    }

    const toggle = bar.querySelector("[data-cfwg-all]");
    if (toggle) {
      toggle.textContent = allPages ? "Cloudflare-Liste" : "Alle Seiten";
      toggle.title = allPages
        ? "Zurück zur originalen, seitenweisen Liste"
        : "Alle Projekte aus allen Listenseiten in einer Liste zeigen";
      toggle.classList.toggle("cfwg-btn-on", !!allPages);
      toggle.disabled = !canAllPages && !allPages;
      toggle.style.opacity = toggle.disabled ? "0.5" : "";
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
      class: "cfwg-header",
      type: "button",
      "aria-expanded": String(!collapsed),
      onclick: onToggle,
    });
    button.append(
      el("span", {
        class: "cfwg-caret" + (collapsed ? " cfwg-caret-collapsed" : ""),
        text: "▾",
      }),
      dot(group.color || "#888"),
      el("span", { class: "cfwg-header-name", text: group.name }),
      el("span", { class: "cfwg-count", text: String(count) })
    );
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

  function openModal(state, commit) {
    document.querySelector('[data-cfwg="overlay"]')?.remove();

    const overlay = el("div", { "data-cfwg": "overlay", class: "cfwg-overlay" });
    const modal = el("div", { class: "cfwg-modal", role: "dialog" });
    overlay.appendChild(modal);

    // Arbeitskopie – erst "Fertig"/Aenderung schreibt in den Store
    let groups = state.groups.map((g) => ({ ...g }));
    let assign = { ...state.assign };
    const selected = new Set();
    let filter = "";

    const close = () => overlay.remove();
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape" && document.contains(overlay)) {
        close();
        document.removeEventListener("keydown", esc);
      }
    });

    const save = () => commit({ groups, assign });

    function render() {
      modal.textContent = "";
      modal.append(head(), groupSection(), projectSection(), foot());
    }

    const head = () =>
      el("div", { class: "cfwg-modal-head" }, [
        el("h2", { class: "cfwg-modal-title", text: "Projekte gruppieren" }),
        el("button", {
          class: "cfwg-x",
          type: "button",
          text: "×",
          title: "Schliessen",
          onclick: close,
        }),
      ]);

    function groupSection() {
      const list = el("div", { class: "cfwg-grouplist" });

      groups.forEach((g, i) => {
        const nameInput = el("input", {
          class: "cfwg-input cfwg-group-name",
          type: "text",
          value: g.name,
        });
        nameInput.addEventListener("change", () => {
          g.name = nameInput.value.trim() || g.name;
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

        const used = Object.values(assign).filter((id) => id === g.id).length;

        list.appendChild(
          el("div", { class: "cfwg-grouprow" }, [
            dot(g.color),
            nameInput,
            el("span", { class: "cfwg-muted", text: `${used} Projekte` }),
            el("button", {
              class: "cfwg-icon",
              type: "button",
              text: "↑",
              title: "Nach oben",
              onclick: move(-1),
            }),
            el("button", {
              class: "cfwg-icon",
              type: "button",
              text: "↓",
              title: "Nach unten",
              onclick: move(1),
            }),
            el("button", {
              class: "cfwg-icon cfwg-danger",
              type: "button",
              text: "✕",
              title: "Gruppe loeschen",
              onclick: () => {
                if (!confirm(`Gruppe "${g.name}" loeschen? Die Projekte wandern zurueck nach "Ohne Gruppe".`)) return;
                groups = groups.filter((x) => x.id !== g.id);
                for (const [k, v] of Object.entries(assign)) {
                  if (v === g.id) delete assign[k];
                }
                save();
                render();
              },
            }),
          ])
        );
      });

      const newInput = el("input", {
        class: "cfwg-input",
        type: "text",
        placeholder: "Neue Gruppe …",
      });
      const add = () => {
        const name = newInput.value.trim();
        if (!name) return;
        groups.push({ id: Store.uid(), name, color: Store.nextColor(groups) });
        newInput.value = "";
        save();
        render();
      };
      newInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          add();
        }
      });

      return el("section", { class: "cfwg-section" }, [
        el("h3", { class: "cfwg-h3", text: "Gruppen" }),
        list,
        el("div", { class: "cfwg-addrow" }, [
          newInput,
          el("button", {
            class: "cfwg-btn cfwg-btn-primary",
            type: "button",
            text: "Hinzufuegen",
            onclick: add,
          }),
        ]),
      ]);
    }

    function projectSection() {
      const visible = state.projects.filter((p) =>
        p.name.toLowerCase().includes(filter.toLowerCase())
      );

      const search = el("input", {
        class: "cfwg-input cfwg-search",
        type: "search",
        placeholder: "Projekt suchen …",
        value: filter,
      });
      search.addEventListener("input", () => {
        filter = search.value;
        render();
        const s = modal.querySelector(".cfwg-search");
        s?.focus();
        s?.setSelectionRange(s.value.length, s.value.length);
      });

      const bulkSelect = el("select", { class: "cfwg-input cfwg-bulk" });
      bulkSelect.append(
        el("option", { value: "", text: "Ohne Gruppe" }),
        ...groups.map((g) => el("option", { value: g.id, text: g.name }))
      );

      const bulkApply = el("button", {
        class: "cfwg-btn",
        type: "button",
        text: "Auswahl zuweisen",
        onclick: () => {
          if (!selected.size) return;
          for (const key of selected) {
            if (bulkSelect.value) assign[key] = bulkSelect.value;
            else delete assign[key];
          }
          selected.clear();
          save();
          render();
        },
      });

      const allBox = el("input", { type: "checkbox", class: "cfwg-check" });
      allBox.checked = visible.length > 0 && visible.every((p) => selected.has(p.key));
      allBox.addEventListener("change", () => {
        for (const p of visible) {
          if (allBox.checked) selected.add(p.key);
          else selected.delete(p.key);
        }
        render();
      });

      const rows = visible.map((p) => {
        const box = el("input", { type: "checkbox", class: "cfwg-check" });
        box.checked = selected.has(p.key);
        box.addEventListener("change", () => {
          box.checked ? selected.add(p.key) : selected.delete(p.key);
          const head = modal.querySelector(".cfwg-thead .cfwg-check");
          if (head) {
            head.checked = visible.every((x) => selected.has(x.key));
          }
        });

        const sel = el("select", { class: "cfwg-input cfwg-assign" });
        sel.append(
          el("option", { value: "", text: "— ohne Gruppe —" }),
          ...groups.map((g) => el("option", { value: g.id, text: g.name }))
        );
        sel.value = assign[p.key] || "";
        sel.addEventListener("change", () => {
          if (sel.value) assign[p.key] = sel.value;
          else delete assign[p.key];
          save();
          const g = groups.find((x) => x.id === sel.value);
          const swatch = sel.parentElement.querySelector(".cfwg-dot");
          if (swatch) swatch.style.background = g ? g.color : "transparent";
        });

        const g = groups.find((x) => x.id === sel.value);

        return el("div", { class: "cfwg-prow" }, [
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
          dot(g ? g.color : "transparent"),
          sel,
        ]);
      });

      const offPage = state.projects.filter((x) => !x.onPage).length;
      let note = null;
      if (state.remoteErrors && state.remoteErrors.length) {
        note = el("div", {
          class: "cfwg-note cfwg-note-warn",
          text:
            "Gesamtliste nicht abrufbar – es werden nur die Projekte dieser " +
            "Listenseite angezeigt. (" + state.remoteErrors.join(" | ") + ")",
        });
      } else if (!state.remoteLoaded) {
        note = el("div", { class: "cfwg-note", text: "Gesamtliste wird geladen …" });
      } else if (offPage) {
        note = el("div", {
          class: "cfwg-note",
          text: `Enthält ${offPage} Projekte von anderen Listenseiten – zuordnen geht trotzdem.`,
        });
      }

      return el("section", { class: "cfwg-section" }, [
        el("div", { class: "cfwg-h3row" }, [
          el("h3", { class: "cfwg-h3", text: `Projekte (${state.projects.length})` }),
          search,
        ]),
        note,
        el("div", { class: "cfwg-prow cfwg-thead" }, [
          allBox,
          el("span", { class: "cfwg-muted", text: "alle" }),
          el("span", { class: "cfwg-spacer" }),
          bulkSelect,
          bulkApply,
        ]),
        el("div", { class: "cfwg-plist" }, rows),
      ]);
    }

    const foot = () =>
      el("div", { class: "cfwg-modal-foot" }, [
        el("span", {
          class: "cfwg-muted",
          text: "Aenderungen werden sofort gespeichert.",
        }),
        el("span", { class: "cfwg-spacer" }),
        el("button", {
          class: "cfwg-btn cfwg-btn-primary",
          type: "button",
          text: "Fertig",
          onclick: close,
        }),
      ]);

    render();
    document.body.appendChild(overlay);
    modal.querySelector("input")?.focus();
  }

  NS.ui = { buildToolbar, updateToolbar, buildHeader, buildProjectRow, openModal };
})();
