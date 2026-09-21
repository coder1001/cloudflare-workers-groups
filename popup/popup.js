(() => {
  const Store = window.__cfwg.Store;
  const $ = (id) => document.getElementById(id);
  const status = (msg) => {
    $("status").textContent = msg;
    setTimeout(() => ($("status").textContent = ""), 3000);
  };

  chrome.storage.sync.get("ui", ({ ui }) => {
    $("enabled").checked = (ui || {}).enabled !== false;
  });

  $("enabled").addEventListener("change", async () => {
    const { ui } = await chrome.storage.sync.get("ui");
    await Store.saveUi({ ...(ui || { collapsed: {} }), enabled: $("enabled").checked });
    // Kein Tab-Reload noetig: das Content-Skript hoert auf Storage-Aenderungen
    // und stellt beim Abschalten die Originalliste selbst wieder her.
    status($("enabled").checked ? "Eingeschaltet." : "Ausgeschaltet.");
  });

  $("export").addEventListener("click", async () => {
    const data = await Store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cf-workers-groups-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    status("Exportiert.");
  });

  $("import").addEventListener("click", () => $("file").click());

  $("file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== "object") throw new Error("Kein Objekt");
      await Store.importAll(data);
      status("Importiert.");
    } catch (err) {
      status("Import fehlgeschlagen: " + err.message);
    }
    e.target.value = "";
  });

  $("reset").addEventListener("click", () => {
    if (!confirm("Alle Gruppen und Zuordnungen loeschen?")) return;
    chrome.storage.sync.clear(() => status("Zurueckgesetzt."));
  });
})();
