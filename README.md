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

- **Zuordnen …** – Dialog mit zwei Reitern: *Projekte* (suchen, filtern,
  zuweisen) und *Gruppen* (anlegen, umbenennen, sortieren, loeschen).
  Zuweisen einzeln per Dropdown oder mehrere per Checkbox; die Sammelleiste
  erscheint, sobald etwas ausgewaehlt ist. Die Chips filtern auf eine Gruppe
  oder auf *Ohne Gruppe* – praktisch, um die noch offenen abzuarbeiten.
  Alles wird sofort gespeichert.
- **Alle ein-/ausklappen** – Gruppen zusammenfalten; der Zustand haelt.
Die Erweiterung zeigt immer **eine** Liste ueber alle Listenseiten hinweg und
blendet dafuer Cloudflares Liste samt Pagination aus (per `display:none`, nicht
entfernt). Es gibt bewusst keinen Umschalter zurueck zur Originalansicht: wer
die will, schaltet die Erweiterung im Popup ab – zwei Wege zum selben Ziel sind
einer zu viel.

Nur wenn die Gesamtliste nicht abrufbar ist, faellt die Anzeige auf die
seitenweise Gruppierung innerhalb von Cloudflares eigener Liste zurueck; die
Leiste weist dann auf "nur diese Listenseite" hin.

Nicht zugeordnete Projekte sammeln sich sichtbar unter **Ohne Gruppe**. Neue
Projekte landen automatisch dort, gehen also nicht unter.

Im Popup der Extension: Gruppierung an/aus, Export/Import als JSON, Reset.

## Aufbau

| Datei | Zweck |
|---|---|
| `src/storage.js` | Speicher-Schicht (die einzige Stelle, die weiss, *wo* die Zuordnung liegt) |
| `src/api.js` | Holt die Gesamtliste ueber die Dashboard-API (alle Listenseiten) |
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

- **Die Seitenleiste ist ausgeschlossen.** Sie fuehrt zuletzt besuchte
  Projekte mit denselben Linkmustern und steht frueher im DOM als die
  Projektliste - ohne Filter (`nav, aside, [role=navigation], header, footer`)
  haengt die Erkennung dort fest. Zusaetzlich gewinnen Treffer innerhalb von
  `<main>`, falls es welche gibt.
- **Die Leiste haengt um, wenn der Container wechselt.** Zu pruefen, ob sie
  noch im DOM steht, reicht nicht: sie muss an der *aktuellen* Liste sitzen.
- **Erkennung ueber `href`, nicht ueber CSS-Klassen.** Die Klassennamen im
  Dashboard sind gehasht und aendern sich mit jedem Build; die Routen
  (`/workers/services/view/<name>`, `/pages/view/<name>`) sind stabil.
- **Zeilen werden nie aus ihrem Container geloest**, nur innerhalb desselben
  Elternelements umsortiert. Sonst streitet man sich mit Reacts Reconciliation
  und faengt sich `removeChild`-Fehler ein.
- **Die Gesamtliste kommt aus der API, nicht aus dem DOM.** Das DOM zeigt nur
  die sichtbare Listenseite (Standard: 10 Eintraege). Der Aufruf laeuft
  same-origin auf `dash.cloudflare.com`, die Session-Cookies gehen mit: kein
  API-Token noetig, nichts verlaesst den Browser.

## API-Zugriff

Bevorzugt wird der kombinierte Endpunkt, den das Dashboard selbst zieht:

```
/api/v4/accounts/<id>/workers-and-pages/overview?page=1&per_page=<n>&sort=last_modified
```

Zwei Eigenheiten, die die Implementierung beachtet:

- **`per_page` ist gedeckelt.** Zu grosse Werte beantwortet der Endpunkt mit
  HTTP 400. `src/api.js` probiert deshalb absteigend `100 → 50 → 25 → 10` und
  bleibt beim ersten Wert, der durchgeht.
- **Der Endpunkt mischt Workers und Pages**, und welches Feld den Typ traegt,
  ist nicht dokumentiert. Der Typ geht in den Schluessel ein, ein Fehlgriff
  erzeugte also Dubletten. Deshalb: der Typ aus dem DOM (aus der Route
  abgeleitet, damit sicher) schlaegt immer den geratenen Typ aus der API.

Schlaegt alles fehl, faellt die Extension still auf `/workers/scripts` +
`/pages/projects` und zur Not auf das DOM der aktuellen Seite zurueck.

## Ladeverhalten

Beim Seitenaufruf steht im DOM nur die sichtbare Listenseite; die Gesamtliste
kommt erst per API. In dieser Luecke wird bewusst **nicht** gruppiert:
Cloudflares Liste bleibt unangetastet stehen, bis die vollstaendige Liste da
ist. Wuerde man schon die zehn Eintraege der ersten Seite gruppieren, zeigte
man eine irrefuehrende Ansicht, die gleich darauf umspringt.

Dazu zwei Dinge, die das Warten verkuerzen bzw. erklaeren:

- **Cache.** Die Projektliste liegt pro Account in `chrome.storage.local`.
  Beim naechsten Besuch steht die Ansicht sofort (gemessen: 0,2 s statt 5 s),
  der API-Abgleich laeuft daneben und die Leiste zeigt „aktualisiere …".
- **Fortschritt.** Nach der ersten Antwort ist `total_pages` bekannt, die
  Leiste zeigt also „Seite 2 von 4" statt eines endlosen Spinners. Vorher und
  bei nur einer Seite laeuft ein unbestimmtes Segment.

Der Balken sitzt absolut an der Oberkante der Leiste, damit deren Hoehe beim
Erscheinen nicht springt.

Der Abruf wird aus `sync()` angestossen, nicht nur beim Start: im Dashboard
landet man meist per Klick in der Seitenleiste auf der Liste, nicht per
Direktaufruf. Eine Sperre verhindert Mehrfachabfragen, ein Zeitlimit von 20
Sekunden beendet den Wartezustand auch dann, wenn die Antwort ausbleibt.

## Dialog-Layout

Der Dialog hat **genau einen Scroll-Bereich** (den Listenkoerper). Kopf,
Reiter, Suche, Filter-Chips und Sammelleiste stehen fix darueber, die
Fusszeile fix darunter.

Das ist bewusst so: zwei uebereinander gestapelte Scroll-Listen lesen sich wie
abgeschnittener Inhalt, und man sucht dann Eintraege, die gar nicht verdeckt
sind. Dazu zwei Details, die dem Eindruck weiter entgegenwirken:

- Der Listenkopf haftet buendig an der Oberkante (`padding-top: 0` am
  Scroll-Container) – ein Innenabstand dort liesse Inhalt sichtbar dahinter
  vorbeiscrollen.
- Eine weiche Kante am oberen und unteren Rand erscheint nur dann, wenn
  tatsaechlich noch Inhalt folgt (CSS-Verlaeufe mit
  `background-attachment: local`).

Beim Zuweisen ohne aktiven Filter wird die Liste **nicht** neu gezeichnet,
damit unter dem Cursor nichts wegspringt; nur Farbpunkt und Chip-Zahlen ziehen
nach. Mit aktivem Filter wird neu gezeichnet, weil die Zeile dann erwartbar
herausfaellt – die Scrollposition bleibt erhalten.

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
`?layout=cards` bildet den echten Aufbau des Dashboards nach (UL-Grid mit
Karten plus Pagination als Geschwister), `?layout=div` und der Standard
`table` decken andere Strukturen ab. Der Server liefert ausserdem eine
nachgebaute API inklusive Pagination und `per_page`-Limit.

Laeuft die Extension im Browser, stempelt sie ihren Zustand als
`data`-Attribute ans `<html>` (Content-Skripte sind aus der Seitenkonsole
sonst nicht einsehbar):

```js
JSON.stringify(document.documentElement.dataset)
// cfwgLoaded, cfwgPage, cfwgRows, cfwgRemote, cfwgSource, cfwgError …
```

`test/diagnose.js` gibt es zusaetzlich zum Einfuegen in die Konsole auf der
echten Dashboard-Seite; es analysiert unabhaengig von der Extension, ob und wo
die Projektlinks im DOM sitzen.

## Grenzen

- Die Zuordnung haengt am Projektnamen. Wird ein Projekt in Cloudflare
  umbenannt, faellt es zurueck nach *Ohne Gruppe*.
- Die eigene Liste zeigt Name, Typ und Gruppe – nicht die Zusatzinfos aus
  Cloudflares Karten (letztes Deployment o.ae.). Wer die braucht, schaltet auf
  die Originalliste zurueck.
- `chrome.storage.sync` erlaubt 8 KB pro Eintrag. Die Zuordnungen sind pro
  Account getrennt abgelegt, das reicht fuer ~150–200 Projekte je Account.
  Danach schlaegt das Speichern fehl (Meldung in der Konsole).
- Nur dein Browser sieht die Gruppen – nicht das Team, nicht `wrangler`, nicht
  ein anderes Geraet ohne die Extension. Wer das braucht, setzt statt dessen auf
  Cloudflare Resource Tagging (Public Beta); dafuer muesste nur `storage.js`
  gegen einen API-Client getauscht werden.
- Baut Cloudflare die Routen um, bricht die Erkennung. Dann sind die Muster in
  `src/dom.js` (`PATTERNS`) die einzige anzupassende Stelle.
