#!/usr/bin/env python3
"""
AzubiPass · Schriften einbetten

    python3 schriften.py

Holt die drei Schriften einmalig von Google, schneidet sie auf den lateinischen
Zeichensatz zu und legt sie als eigene Dateien neben die Seiten — dazu eine
schriften.css, die auf sie zeigt.

Warum überhaupt:

  1  Recht. Bindet eine Seite Google Fonts über deren Server ein, geht bei jedem
     Aufruf die IP des Besuchers an Google. Das LG München I hat darin 2022 einen
     Verstoß gegen das Persönlichkeitsrecht gesehen (Az. 3 O 17493/20); seitdem
     gibt es dazu Abmahnwellen. Wer die Seite verbreiten will, lässt das nicht
     stehen.

  2  Ohne Netz. Ein Lernzettel, den jemand im Zug öffnet, sähe sonst nach Georgia
     aus statt nach Source Serif.

Warum eigene Dateien und nicht base64 in der CSS:
Die Schnitte wiegen zusammen rund ein Megabyte. Als base64 stünden sie in jeder
der vierzehn Seiten — rund zwanzig Megabyte für dieselben achtzehn Dateien. Als
eigene Dateien lädt der Browser jede genau einmal, behält sie und holt dank
unicode-range meist nicht einmal die Hälfte davon.

Danach einmal alles neu bauen.
"""

import re
import sys
import urllib.request
from pathlib import Path

from gemeinsames import MITTEL

# Dieselben Familien und Schnitte, die azubipass.css und landing.css erwarten
QUELLE = ("https://fonts.googleapis.com/css2"
          "?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,600"
          "&family=IBM+Plex+Sans:wght@400;500;600"
          "&family=IBM+Plex+Mono:wght@400;500"
          "&display=swap")

# Ein moderner Browser bekommt woff2 geliefert, ein nackter Python-Aufruf ttf
BROWSER = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
           "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

# Deutsch braucht latin und latin-ext (für „ß", Anführungszeichen, €)
BEHALTEN = ("latin", "latin-ext")


def hole(url, kopf=True):
    anfrage = urllib.request.Request(url, headers={"User-Agent": BROWSER} if kopf else {})
    with urllib.request.urlopen(anfrage, timeout=30) as a:
        return a.read()


def bloecke(css):
    """Zerlegt die Google-CSS in einzelne @font-face-Blöcke mit ihrem Subset-Namen."""
    return [(t.group(1), t.group(2)) for t in
            re.finditer(r"/\*\s*([a-z-]+)\s*\*/\s*(@font-face\s*\{.*?\})", css, re.S)]


def feld(block, name, standard=""):
    t = re.search(rf"{name}:\s*([^;]+);", block)
    return t.group(1).strip().strip("'") if t else standard


def dateiname(block, subset):
    familie = feld(block, "font-family", "schrift").lower().replace(" ", "-")
    kursiv = "-kursiv" if feld(block, "font-style") == "italic" else ""
    return f"{familie}-{feld(block, 'font-weight', '400')}{kursiv}-{subset}.woff2"


def main():
    print("· hole Schriftliste von Google")
    try:
        css = hole(QUELLE).decode("utf-8")
    except Exception as e:
        print(f"  Fehlgeschlagen: {e}")
        print("  Ohne Netzverbindung geht es nicht — die Dateien müssen einmal geholt werden.")
        return 1

    MITTEL.mkdir(parents=True, exist_ok=True)
    teile, bytes_gesamt = [], 0

    for subset, block in bloecke(css):
        if subset not in BEHALTEN:
            continue
        url = re.search(r"url\((https://[^)]+\.woff2)\)", block)
        if not url:
            continue

        rohdaten = hole(url.group(1), kopf=False)
        name = dateiname(block, subset)
        (MITTEL / name).write_bytes(rohdaten)
        bytes_gesamt += len(rohdaten)

        neu = re.sub(r"url\(https://[^)]+\.woff2\)", f"url({name})", block)
        teile.append(f"/* {subset} */\n{neu}")
        print(f"  {name:<40} {len(rohdaten) // 1024} kB")

    if not teile:
        print("  Nichts gefunden — hat sich das Format der Google-CSS geändert?")
        return 1

    kopf = ("/* AzubiPass · Schriften, selbst ausgeliefert.\n"
            "   Erzeugt von schriften.py — nicht von Hand bearbeiten.\n"
            "   Beim Aufruf der Seite geht dadurch keine Anfrage mehr an Google. */\n\n")
    (MITTEL / "schriften.css").write_text(kopf + "\n".join(teile), encoding="utf-8")

    print(f"\n  {len(teile)} Schnitte, {bytes_gesamt // 1024} kB → {MITTEL}")
    print("  Jetzt neu bauen.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
