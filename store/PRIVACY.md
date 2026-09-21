# Datenschutzerklärung – Projektgruppen für Cloudflare

Stand: 21. September 2026

## Kurzfassung

Diese Erweiterung erhebt keine Daten, überträgt keine Daten an den Entwickler
oder an Dritte und bindet keine Analyse-, Tracking- oder Werbedienste ein.

## Welche Daten verarbeitet werden

Die Erweiterung speichert ausschließlich das, was du selbst anlegst:

- die Namen und Farben der von dir erstellten Gruppen,
- die Zuordnung, welches Projekt zu welcher Gruppe gehört,
- Anzeigeeinstellungen (welche Gruppen eingeklappt sind, welche Ansicht aktiv
  ist).

Diese Angaben liegen in `chrome.storage.sync`. Das ist Chromes eigener
Speicher: die Daten gehören zu deinem Google-Konto und werden von Chrome
zwischen deinen eigenen Geräten synchronisiert. Der Entwickler dieser
Erweiterung hat darauf keinen Zugriff.

## Zugriff auf das Cloudflare-Dashboard

Die Erweiterung ist nur auf `https://dash.cloudflare.com` aktiv. Dort tut sie
zweierlei:

1. Sie liest die Namen der Projekte aus der bereits angezeigten Liste, um sie
   in Gruppen anzuordnen.
2. Sie ruft die Listen-Schnittstelle derselben Domain auf, damit auch Projekte
   sichtbar sind, die auf weiteren Seiten der Liste stehen. Dieser Aufruf nutzt
   deine ohnehin bestehende Dashboard-Sitzung und verlässt deinen Browser
   nicht. Ein API-Token wird nicht abgefragt und nicht gespeichert.

Es werden keine Anmeldedaten, Tokens, Schlüssel oder Inhalte deiner Projekte
gelesen, gespeichert oder übertragen.

## Keine Weitergabe

Es findet keine Übertragung an Server des Entwicklers statt – die Erweiterung
hat keine. Es gibt keinen Verkauf und keine Weitergabe von Daten an Dritte.

## Daten löschen

Im Popup der Erweiterung gibt es „Reset". Damit werden alle gespeicherten
Gruppen und Zuordnungen entfernt. Beim Deinstallieren der Erweiterung löscht
Chrome den Speicher ebenfalls.

## Hinweis

Diese Erweiterung ist ein inoffizielles, privates Projekt und steht in keiner
Verbindung zu Cloudflare, Inc.

## Kontakt

Fragen und Anliegen bitte als Issue im Projekt-Repository:
https://github.com/coder1001/cloudflare-workers-groups/issues
