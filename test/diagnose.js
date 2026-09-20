/**
 * In die DevTools-Konsole auf der Workers-&-Pages-Seite einfuegen.
 * Laeuft absichtlich unabhaengig von der Extension (die lebt in einer
 * isolierten Welt und ist aus der Seitenkonsole nicht sichtbar).
 * Das Ergebnis landet im Clipboard.
 */
(() => {
  const RE = [/\/workers\/services\/view\/([^/?#]+)/, /\/pages\/view\/([^/?#]+)/];
  const path = (a) => {
    try { return new URL(a.getAttribute("href"), location.origin).pathname; }
    catch { return ""; }
  };

  const all = [...document.querySelectorAll("a[href]")];
  const matched = all.filter((a) => RE.some((r) => r.test(path(a))));
  const interesting = [...new Set(all.map(path))]
    .filter((p) => /worker|page|service|project/i.test(p))
    .slice(0, 30);

  // Vorfahrenkette des ersten Treffers – daraus laesst sich Zeile und
  // Container rekonstruieren
  const chain = [];
  let el = matched[0];
  for (let i = 0; i < 10 && el && el !== document.body; i++) {
    const cs = getComputedStyle(el);
    chain.push({
      tag: el.tagName,
      role: el.getAttribute("role") || null,
      testid: el.getAttribute("data-testid") || null,
      cls: String(el.className || "").slice(0, 70),
      kids: el.children.length,
      siblings: el.parentElement ? el.parentElement.children.length : 0,
      display: cs.display,
    });
    el = el.parentElement;
  }

  const out = {
    path: location.pathname,
    anchorsTotal: all.length,
    matchedAnchors: matched.length,
    matchedNames: matched.slice(0, 5).map((a) => a.textContent.trim().slice(0, 40)),
    interestingHrefs: interesting,
    chain,
    iframes: document.querySelectorAll("iframe").length,
  };

  const json = JSON.stringify(out, null, 2);
  console.log(json);
  if (typeof copy === "function") { copy(json); console.log("→ im Clipboard"); }
  return out;
})();
