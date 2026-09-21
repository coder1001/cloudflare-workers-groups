# Store-Eintrag – zum Reinkopieren

Alles hier ist für die Chrome Web Store Developer Console gedacht.
Sichtbarkeit: **Nicht gelistet (unlisted)**. Sprache: Deutsch.

---

## Name

```
Projektgruppen für Cloudflare
```

## Kurzbeschreibung (max. 132 Zeichen)

```
Gruppiert deine Projekte unter Workers & Pages im Cloudflare-Dashboard – über alle Listenseiten hinweg. Lokal, ohne Token.
```

## Ausführliche Beschreibung

```
Wer viele Workers und Pages betreibt, sucht im Dashboard in einer flachen,
seitenweise geblätterten Liste. Diese Erweiterung legt eigene Gruppen darüber –
etwa nach Kunde, Umgebung oder Zweck.

FUNKTIONEN

• Eigene Gruppen anlegen, benennen, sortieren und einklappen
• Projekte einzeln oder mehrere auf einmal zuordnen
• Eine Liste über alle Seiten hinweg, statt seitenweise zu blättern
• Filter auf einzelne Gruppen oder auf noch nicht zugeordnete Projekte
• Umschaltbar zurück zur normalen Cloudflare-Ansicht
• Export und Import der Gruppen als JSON

OHNE TOKEN, OHNE KONTO

Die Erweiterung braucht keinen API-Token und kein Konto bei mir. Deine Gruppen
liegen in Chromes eigenem Speicher (chrome.storage.sync) und werden zwischen
deinen Geräten synchronisiert. Es gibt keinen Server, an den etwas gesendet
wird – ich habe keinen.

An Cloudflare selbst ändert die Erweiterung nichts. Die Gruppierung ist eine
reine Ansichtssache in deinem Browser; Kollegen, die wrangler-CLI und die
Cloudflare-API sehen davon nichts.

HINWEIS

Dies ist ein inoffizielles, privates Projekt und steht in keiner Verbindung zu
Cloudflare, Inc. „Cloudflare", „Workers" und „Pages" sind Marken ihrer
jeweiligen Inhaber und werden hier nur genannt, um zu beschreiben, wofür die
Erweiterung gemacht ist.

Die Erweiterung hängt am Aufbau des Cloudflare-Dashboards. Ändert Cloudflare
dort etwas, kann sie vorübergehend nicht funktionieren.
```

## Kategorie

```
Workflow und Planung
```

---

# Datenschutz-Reiter

## Einziger Zweck (Single purpose)

```
Die Erweiterung hat den einen Zweck, die Projektliste unter „Workers & Pages"
im Cloudflare-Dashboard in selbst definierte Gruppen zu ordnen und darin zu
filtern.
```

## Begründung: Berechtigung „storage"

```
Speichert ausschließlich die vom Nutzer selbst angelegten Gruppen, die
Zuordnung Projekt zu Gruppe sowie Anzeigeeinstellungen (eingeklappte Gruppen,
gewählte Ansicht). Ohne diesen Speicher wäre die Gruppierung nach jedem
Seitenwechsel verloren. Es werden keine personenbezogenen Daten gespeichert und
nichts an Dritte übertragen.
```

## Begründung: Host-Zugriff auf https://dash.cloudflare.com/*

```
Die Erweiterung ist ausschließlich auf der Seite „Workers & Pages" des
Cloudflare-Dashboards aktiv. Sie benötigt den Zugriff für zwei Dinge:

1. Sie liest die Projektnamen aus der bereits angezeigten Liste und ordnet die
   Einträge optisch in die vom Nutzer definierten Gruppen.
2. Sie ruft die Listen-Schnittstelle derselben Domain auf, damit auch Projekte
   von weiteren Seiten der Liste angezeigt und zugeordnet werden können. Dieser
   Aufruf nutzt die bestehende Sitzung des Nutzers im eigenen Browser und geht
   an keinen anderen Host.

Es werden keine Anmeldedaten, Tokens oder Projektinhalte gelesen, gespeichert
oder übertragen. Ein engerer Zugriff ist nicht möglich, weil die Funktion genau
diese eine Seite betrifft.
```

## Remote Code

```
Nein. Die Erweiterung lädt und führt keinen externen Code aus; sämtlicher Code
liegt im Paket.
```

## Datennutzung (Angaben im Formular)

Keine der Kategorien ankreuzen – es werden keine Daten **erhoben** im Sinne der
Richtlinie, also nichts vom Gerät des Nutzers übertragen.

Die drei Zertifizierungen bestätigen:

- Daten werden nicht verkauft oder an Dritte weitergegeben (außer für den
  genehmigten Anwendungsfall)
- Daten werden nicht für Zwecke außerhalb des Hauptzwecks verwendet
- Daten werden nicht zur Bonitätsprüfung oder Kreditvergabe verwendet

## Datenschutzerklärung (URL)

`store/PRIVACY.md` öffentlich erreichbar hinterlegen und die URL hier eintragen.
Am einfachsten: öffentliches GitHub-Repo oder ein Gist.

---

# Vor dem Einreichen prüfen

- [ ] Kontakt-E-Mail in `store/PRIVACY.md` eingetragen
- [ ] Privacy Policy öffentlich erreichbar, URL im Formular hinterlegt
- [ ] Im Konto: Publisher-Anzeigename gesetzt
- [ ] Im Konto: DSA-Händlererklärung ausgefüllt (Hobby = Nicht-Händler)
- [ ] Sichtbarkeit auf „Nicht gelistet" gestellt
- [ ] ZIP mit `./build.sh` gebaut
- [ ] Screenshots aus `store/screenshots/` hochgeladen
