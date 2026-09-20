# Cloudflare Workers Groups

Gruppiert die Projektliste unter **Workers & Pages** im Cloudflare-Dashboard.
Rein lokal: die Zuordnung liegt in `chrome.storage.sync`, Cloudflare selbst wird
nicht veraendert und es wird kein API-Token gebraucht.

## Installation

1. `chrome://extensions` oeffnen
2. **Entwicklermodus** einschalten (oben rechts)
3. **Entpackte Erweiterung laden** → diesen Ordner auswaehlen
4. `https://dash.cloudflare.com/<account>/workers-and-pages` oeffnen

## Benutzung

Ueber der Liste erscheint eine Leiste:

- **Zuordnen …** – Gruppen anlegen/umbenennen/sortieren/loeschen und Projekte
  zuweisen. Entweder einzeln per Dropdown oder mehrere per Checkbox +
  *Auswahl zuweisen*. Alles wird sofort gespeichert.
- **Alle ein-/ausklappen** – Gruppen zusammenfalten; der Zustand haelt.

Nicht zugeordnete Projekte sammeln sich sichtbar unter **Ohne Gruppe**. Neue
Projekte landen automatisch dort, gehen also nicht unter.

Im Popup der Extension: Gruppierung an/aus, Export/Import als JSON, Reset.

## Aufbau

| Datei | Zweck |
|---|---|
| `src/storage.js` | Speicher-Schicht (die einzige Stelle, die weiss, *wo* die Zuordnung liegt) |
| `src/dom.js` | Findet Liste, Zeilen und Projektnamen im DOM |
| `src/ui.js` | Toolbar, Gruppen-Header, Modal |
| `src/content.js` | Beobachtet die Seite, sortiert, haelt alles konsistent |
| `icons/icon.svg` | Icon-Quelle (48/128 px) |
| `icons/icon-small.svg` | Vereinfachte Fassung fuer 16/32 px |

Icons neu bauen:

```bash
for s in 16 32; do rsvg-convert -w $s -h $s icons/icon-small.svg -o icons/icon$s.png; done
for s in 48 128; do rsvg-convert -w $s -h $s icons/icon.svg -o icons/icon$s.png; done
```

Zwei Entscheidungen, die die Sache haltbar machen:

- **Erkennung ueber `href`, nicht ueber CSS-Klassen.** Die Klassennamen im
  Dashboard sind gehasht und aendern sich mit jedem Build; die Routen
  (`/workers/services/view/<name>`, `/pages/view/<name>`) sind stabil.
- **Zeilen werden nie aus ihrem Container geloest**, nur innerhalb desselben
  Elternelements umsortiert. Sonst streitet man sich mit Reacts Reconciliation
  und faengt sich `removeChild`-Fehler ein.

## Datenformat

```jsonc
{
  "groups": [{ "id": "gA", "name": "Kunde A", "color": "#f6821f" }],
  "assign:<accountId>": { "worker/shop-a-api": "gA", "pages/shop-a-web": "gA" },
  "ui": { "collapsed": { "gA": false }, "enabled": true }
}
```

Zuordnungen sind pro Cloudflare-Account abgelegt, Gruppen gelten
accountuebergreifend.

## Test

```bash
python3 test/serve.py 8777
```

Dann `http://127.0.0.1:8777/0123456789abcdef0123456789abcdef/workers-and-pages`
oeffnen (`?layout=div` fuer die Nicht-Tabellen-Variante). Die Mock-Seite bildet
die Listenstruktur nach und bringt einen `chrome.storage`-Shim mit, sodass sich
Erkennung, Sortierung und Persistenz ohne echtes Cloudflare-Konto pruefen lassen.
`window.__order()` gibt die aktuelle Reihenfolge inkl. Header aus.

## Grenzen

- Die Zuordnung haengt am Projektnamen. Wird ein Projekt in Cloudflare
  umbenannt, faellt es zurueck nach *Ohne Gruppe*.
- `chrome.storage.sync` erlaubt 8 KB pro Eintrag. Die Zuordnungen sind pro
  Account getrennt abgelegt, das reicht fuer ~150–200 Projekte je Account.
  Danach schlaegt das Speichern fehl (Meldung in der Konsole).
- Nur dein Browser sieht die Gruppen – nicht das Team, nicht `wrangler`, nicht
  ein anderes Geraet ohne die Extension. Wer das braucht, setzt statt dessen auf
  Cloudflare Resource Tagging (Public Beta); dafuer muesste nur `storage.js`
  gegen einen API-Client getauscht werden.
- Baut Cloudflare die Routen um, bricht die Erkennung. Dann sind die Muster in
  `src/dom.js` (`PATTERNS`) die einzige anzupassende Stelle.
