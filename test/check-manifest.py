#!/usr/bin/env python3
"""Prueft die Laengenlimits des Chrome Web Store vor dem Verpacken.

Der Store lehnt zu lange Felder erst beim Einreichen ab - das kostet einen
Anlauf. Deshalb bricht der Build hier ab.
"""
import json
import sys

LIMITS = {"name": 75, "description": 132}

manifest = json.load(open("manifest.json"))
fehler = []

for feld, maxlen in LIMITS.items():
    laenge = len(manifest.get(feld, ""))
    markierung = "!" if laenge > maxlen else " "
    print(f" {markierung} {feld}: {laenge}/{maxlen} Zeichen")
    if laenge > maxlen:
        fehler.append(f"'{feld}' ist {laenge - maxlen} Zeichen zu lang")

if fehler:
    sys.exit("manifest.json: " + "; ".join(fehler))
