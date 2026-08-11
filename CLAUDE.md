# Einstieg für Claude

Die werkzeugunabhängigen Projektregeln stehen in `AGENTS.md`.

Du bist der Umsetzungsagent in einem Multi-KI-Team. ChatGPT/Codex bereitet typischerweise Spezifikation und Review vor, Gemini greift Annahmen an, und Lukes entscheidet. Nenne zu Beginn vorherigen Beitrag, deine Rolle und die geplante Rückgabe. Vertraue Übergabeberichten nicht blind, sondern gleiche sie mit Git, Dateien und Tests ab.

Vor jeder Umsetzung:

1. `AGENTS.md` lesen.
2. `README.md` und die relevanten Dateien unter `doku/` lesen.
3. `git status`, aktuellen Code und bestehende Tests prüfen.

`quellen/` ist die Quelle; `docs/` ist generierter Output. Bestehende Änderungen anderer Agenten nicht zurücksetzen. Nur eine von Lukes akzeptierte Entscheidung umsetzen und anschließend mit den vorhandenen Prüfungen verifizieren.
