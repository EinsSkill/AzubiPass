# AzubiPass · Protokoll ausführliche Kapitel

**Stand:** 10. September 2026  ·  **Arbeitsphase:** Redaktionelle Vertiefung

## Ziel

Alle 75 Kapitel erhalten eine abschnittsgebundene Langfassung. Sie bleibt in
demselben Kapitel und verwendet dieselben Abschnitts-IDs, Lernziele,
Selbsttests, Karteikarten, Suche und Lernstandsdaten wie die Kurzfassung.

## Verbindliche Inhaltsstruktur

Eine redaktionelle Langfassung enthält, soweit die geprüften Quelldaten es
tragen:

- notwendiges Vorwissen und Begriffe
- Warum-/Wie-Erklärung
- mindestens zwei Anwendungsbeispiele
- einen gelösten Fall oder Rechenweg
- typische Fehler und Gegenbeispiele
- Verständnisfragen mit erklärten Lösungen
- Prüfungs- und Unterrichtsbezug
- einen Merksatz

Rechtsangaben, Jahreswerte und Beispiele dürfen nur aus den vorhandenen
geprüften Kapitelinhalten übernommen oder daraus unmittelbar hergeleitet
werden.

## Fortschritt

Der Vollständigkeitsstand der Quellen beträgt **75/75 Kapitel mit eigenem
`ausfuehrlich`-Feld**. Davon wurden 69 Kapitel in dieser Arbeitsphase neu
redaktionell ergänzt; sechs bereits vorhandene Referenzkapitel blieben als
redaktionelle Referenz erhalten und wurden in die ID-Prüfung einbezogen:

| Charge | Kapitel | Status |
|---|---|---|
| Buchführung | K1, K3 | vorhandene redaktionelle Referenzfassungen |
| Buchführung | K2, K4–K9 | redaktionell ergänzt |
| LF1 | K1–K7 | redaktionell ergänzt |
| LF2 | K1–K6 | redaktionell ergänzt |
| LF3 | K1–K6 | redaktionell ergänzt |
| LF4 | K1–K3, K5, K7 | redaktionell ergänzt |
| LF4 | K4, K6 | vorhandene redaktionelle Referenzfassungen |
| LF5 | K1–K6 | redaktionell ergänzt |
| LF7 | K1, K4 | redaktionell ergänzt |
| LF7 | K2, K3 | vorhandene redaktionelle Referenzfassungen |
| LF8 | K1–K6 | redaktionell ergänzt |
| LF9 | K1–K6 | redaktionell ergänzt |
| LF10 | K1–K6 | redaktionell ergänzt |
| LF11 | K1–K4 | redaktionell ergänzt |
| LF12 | K1–K4 | redaktionell ergänzt |
| LF13 | K1–K4 | redaktionell ergänzt |

Es bleibt keine Kapiteldatei übrig, die nur automatisch aus vorhandenen
`vertiefung`- oder Tabellenhinweisen strukturiert wird. Solche automatischen
Inline-Hinweise bleiben als Renderer-Rückfallebene für künftige neue Inhalte
erhalten.

## Technischer Stand

- `ausfuehrlich.abschnitte[].abschnitt` verweist auf die bestehende Abschnitts-ID.
- Kurz- und Langfassung werden im selben Abschnitt gerendert.
- Lernziele, Checks, Zuordnungen, Selbsttests und Karteikarten bleiben an den
  bestehenden IDs und Daten.
- Die top-level-Einleitung einer Langfassung wird beim Build als Einordnung an
  den ersten bestehenden Abschnitt gehängt.
- `docs/` bleibt generierter Output und wird ausschließlich durch den Build
  aktualisiert.

## Prüfungen und offene technische Punkte

- JSON-Syntax aller Quell- und Aufgaben-JSON-Dateien: erfolgreich.
- Python-Kompilierung der Build- und Prüfscripte: erfolgreich.
- `git diff --check`: erfolgreich.
- Vollständiger Inhaltsbuild: erfolgreich; 13 Lernfelder und 75 Kapitel
  gerendert.
- App-Build: erfolgreich; 54 Offline-Dateien mit 139 Karteikarten, 138
  Übungen und 302 Suchabschnitten erzeugt.
- Abschnitts-ID-Abdeckung für alle 75 Kapitel: erfolgreich; keine Kurz-/Lang-ID
  weicht ab.
- Die bestehende Kapitel-, Aufgaben- und Antwortstruktur blieb erhalten.
- Der Browser-Funktionstest und die Desktop-/Mobil-Sichtprüfung sind in der
  aktuellen Umgebung noch blockiert, weil das Python-Paket Playwright und ein
  Chromium-Browser fehlen. Das ist vor einer Veröffentlichung nachzuholen.
- Build-Warnungen mit vorhandenen Prüf-Markern bleiben sichtbar und müssen vor
  einer Veröffentlichung fachlich geklärt werden.
