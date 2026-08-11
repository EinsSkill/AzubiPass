# AzubiPass – Einstieg für Coding-Agenten

AzubiPass ist eine installierbare, offline nutzbare Lern-App für Kaufleute für Büromanagement.

## Multi-KI-Team

Du arbeitest nicht allein, sondern in einer Kette mit Claude, ChatGPT/Codex, Gemini und Lukes. Ermittle vor jeder Aufgabe:

- welche KI oder Person vorher gearbeitet hat und welches überprüfbare Ergebnis vorliegt
- welche Rolle du jetzt hast: Spec, Gegenprüfung, Umsetzung, Review oder Live-Prüfung
- auf welche Dateien, Branches, Commits und Tests du dich stützt
- an wen du anschließend welches Ergebnis übergibst

Unterstütze vorhandene Arbeit und ergänze sie gezielt. Berichte anderer KIs sind Kontext, aber kein Ersatz für Git, Dateien und Tests. Es schreibt immer nur eine KI gleichzeitig. Fremde uncommitted oder untracked Dateien nicht überschreiben, aufnehmen oder entfernen.

Vor einer Änderung lesen:

1. `README.md` – Aufbau, Build, Tests und rechtliche Grenzen
2. die für die Aufgabe relevanten Dateien unter `doku/`
3. `git status` und den aktuellen Code unter `quellen/`

## Wahrheitsreihenfolge

1. ausgeführte Tests und tatsächliches Verhalten
2. aktueller Code unter `quellen/`
3. Git-Historie und offene Arbeitsänderungen
4. dauerhafte Entscheidungen unter `doku/`
5. Zusammenfassungen im persönlichen Second Brain
6. Chat-Memory einer KI

## Arbeitsregeln

- `quellen/` ist die Quelle für Inhalte, Logik und Darstellung.
- `docs/` ist der gebaute GitHub-Pages-Output und wird nicht von Hand editiert.
- Vorhandene, nicht zur Aufgabe gehörende Änderungen anderer Agenten nicht zurücksetzen oder überschreiben.
- Build- und Prüfablauf aus `README.md` verwenden.
- Dauerhafte Architektur- oder Produktentscheidungen in der passenden Datei unter `doku/` festhalten; keinen parallelen Projektstand im Vault erzeugen.
- Eine `STATUS.md` nur anlegen, wenn Git, Tests und die vorhandene Dokumentation den aktuellen Stand nachweislich nicht verständlich machen.
- Keine Cloud-, Memory-, MCP- oder KI-Funktion hinzufügen, wenn die konkrete Aufgabe sie nicht verlangt.
- Jede Phase mit Belegen, bekannten Grenzen und dem nächsten erlaubten Übergabeschritt abschließen.
