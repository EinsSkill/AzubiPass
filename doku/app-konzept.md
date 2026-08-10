# AzubiPass · App-Konzept

**Stand:** 7. August 2026 · **Status: gebaut.** Alle acht Bauabschnitte sind umgesetzt.
**Ziel:** Aus den 13 bestehenden Lernzetteln eine installierbare Handy-App machen (PWA), ohne das Design zu verwerfen und ohne die JSON→Python-Pipeline zu ersetzen.

> **Was seit diesem Konzept passiert ist**
>
> Dieses Dokument ist der Plan; gebaut wurde danach am selben Tag. Wie es
> tatsächlich läuft, steht in [LIESMICH.md](LIESMICH.md).
>
> Drei Stellen sind anders gekommen als hier geplant:
>
> 1. **Der Dark Mode war viel kleiner als geschätzt.** Die Annahme, rund vierzig
>    fest verdrahtete Farbwerte müssten einzeln angefasst werden, war falsch. Sie
>    liegen alle auf den dunklen Inseln — und die bleiben in beiden Stimmungen
>    dunkel. Es genügte, `--creme` („helles Licht auf Dunkel", wechselt nie) von
>    `--grund` („die Seite selbst", wechselt) zu trennen. Statt einem Tag waren
>    es zwei Stunden.
>
> 2. **CSS und JavaScript auszulagern war keine Entscheidung mehr, sondern
>    Zwang.** Selbst ausgelieferte Schriften wiegen ein Megabyte; in vierzehn
>    Seiten eingebettet wären das über zwanzig gewesen. Damit ist die frühere
>    Eigenständigkeit einer einzelnen `lf3.html` weg — sie braucht jetzt den
>    Ordner `mittel/` daneben.
>
> 3. **Die Lernfeldliste sortiert sich nicht nach Fortschritt**, anders als in
>    Abschnitt 7.3 versprochen. Eine Liste, die ihre Reihenfolge ändert, muss man
>    jedes Mal neu lesen; wo es weitergeht, steht ohnehin auf dem
>    Startbildschirm.
>
> Dazu kam ein Fund, der hier noch nicht drinstand: Das Newsletter-Formular auf
> der Startseite sammelte eine E-Mail-Adresse, versprach eine Bestätigungsmail
> und verschickte nichts. Es ist entfernt.

> **Was eine PWA ist, in einem Satz:** Eine Webseite, die sich aufs Handy installieren lässt wie eine echte App — eigenes Symbol auf dem Homescreen, kein Browser-Rahmen, funktioniert offline. Kein App Store, keine 99 € Apple-Gebühr, kein zweiter Code für Android und iPhone.

---

## Inhalt

1. [Was heute da ist](#1-was-heute-da-ist)
2. [Was am Handy heute schlecht läuft](#2-was-am-handy-heute-schlecht-läuft)
3. [Was gut ist und bleiben muss](#3-was-gut-ist-und-bleiben-muss)
4. [Wo die Architektur die App blockiert](#4-wo-die-architektur-die-app-blockiert)
5. [Funktionsumfang](#5-funktionsumfang)
6. [Kritische Prüfung des eigenen Konzepts](#6-kritische-prüfung-des-eigenen-konzepts)
7. [Struktur & Screens](#7-struktur--screens)
8. [Technischer Fahrplan](#8-technischer-fahrplan)
9. [Offene Entscheidungen für Lukes](#9-offene-entscheidungen-für-lukes)

---

## 1 · Was heute da ist

### Die Zahlen

| | |
|---|---|
| Gebaute Seiten | 14 (13 Lernzettel + Landing-Page) |
| Kapiteldateien | 75 |
| Merksätze (= fertige Karteikarten) | **139** |
| Multiple-Choice-Checks | **75** |
| Zuordnungsaufgaben | **63** |
| Interaktive Grafiken | **96** |
| Selbsttest-Fragen (offen, mit Musterlösung) | **228** |
| Gesamtgröße aller HTML-Dateien | 3,3 MB |

Das ist ordentlich Material. Die wichtigste Zahl für die App steht in Zeile 3: 139 Karteikarten liegen schon fertig in den Daten, ohne dass du je eine Karte separat geschrieben hast.

### Wie die Seite gebaut ist

**Die Pipeline:** Du schreibst JSON → `build.py` liest die Lernfeld-Datei, sammelt die Kapiteldateien ein und schreibt **eine einzige HTML-Datei pro Lernfeld**. CSS (50 KB) und JavaScript (85 KB) werden komplett in jede dieser Dateien hineinkopiert. Deshalb ist jede Datei 200–310 KB groß — davon sind ~135 KB in jeder Datei identisch.

**Die Navigation:** Alle Kapitel eines Lernfelds stecken gleichzeitig im selben Dokument, als `<section class="kapitel" hidden>`. Ein Klick versteckt die eine Sektion und zeigt die andere ([azubipass.js:39](../quellen/azubipass.js)). Es wird also nie eine neue Seite geladen — es wird nur umgeschaltet.

**Wo dein Fortschritt liegt:** Im `localStorage` des Browsers, ein Eintrag pro Lernfeld, benannt nach `data-lernfeld` am `<body>` ([azubipass.js:145](../quellen/azubipass.js)). Gespeichert werden: erreichte Lernziele, angeklickte Check-Antworten, Zuordnungen, Selbsttest-Texte und der Karteikarten-Stand.

**Der Sicherheitsmechanismus:** Jedes Kapitel bekommt einen „Fingerabdruck" seines Textes ([azubipass.js:165](../quellen/azubipass.js)). Ändert sich der Text, passt der Abdruck nicht mehr und der gespeicherte Stand für dieses Kapitel wird weggeworfen. Der Gedanke dahinter ist richtig: lieber ein Haken weg als eine gespeicherte Antwort, die auf eine Frage zeigt, die es nicht mehr gibt.

---

## 2 · Was am Handy heute schlecht läuft

Ich hab hier bewusst nur Sachen aufgeschrieben, die ich an einer konkreten Zeile festmachen kann. Keine Pauschalkritik.

### Schwer — kostet echte Funktion

**1. Die Zurück-Taste funktioniert nicht.**
Kapitelwechsel ändert die Adresse nicht ([azubipass.js:39](../quellen/azubipass.js)). Wenn du am Android-Handy „Zurück" drückst, gehst du nicht zum vorigen Kapitel — du verlässt die Seite komplett. Das ist am Handy die meistgenutzte Geste überhaupt. Nebenwirkung: Du kannst kein Kapitel als Link speichern oder dir selbst schicken.

**2. Die Blase schließt sich beim Scrollen von selbst.**
`window.addEventListener("resize", schliesseBlase)` ([azubipass.js:130](../quellen/azubipass.js)) — am Handy löst das Ein- und Ausblenden der Browser-Adressleiste beim Scrollen ein `resize` aus. Du tippst auf einen Begriff, scrollst zwei Zentimeter, die Erklärung ist weg. Fühlt sich wie ein Bug an, weil es einer ist.

**3. Die Begriffs-Blase ist am Handy zu groß.**
`#blase{width:350px}` ([azubipass.css:99](../quellen/azubipass.css)) — auf einem 375px breiten Display deckt sie fast die ganze Breite ab und schwebt irgendwo mitten im Text. Am Handy gehört so etwas als Blatt von unten (Bottom-Sheet), nicht als schwebendes Kästchen.

**4. Kommazahlen lassen sich nicht eingeben.**
Alle Rechner benutzen `<input type="number">` (Kalkulationsleiter, Bilanzrechner, Lagerkurve, Break-Even). Am deutschen Handy tippst du „12,5" — mit Komma. `type="number"` akzeptiert im Browser aber nur den Punkt und lässt das Feld leer. Du sitzt in der Bahn und der Rechner rechnet einfach nicht. Betrifft mindestens die Grafiken in LF3, LF9, LF10 und Buchführung.

**5. Grafik-Beschriftungen sind unter 8 px.**
Beispiel Lagerkurve: Die Zeichnung ist 620 Einheiten breit ([azubipass.js:1017](../quellen/azubipass.js)), auf einem 375px-Display wird sie auf ~327px gequetscht — Faktor 0,53. Eine 10,5px-Beschriftung wird real 5,6px. Der Notfall-Breakpoint bei 860px setzt sie auf 13px ([azubipass.css:469](../quellen/azubipass.css)) → immer noch nur 6,9px real. Gleiches Problem beim Geschäftsbrief (`font-size:5px` bei max. 430px Breite, [azubipass.css:438](../quellen/azubipass.css)).

### Mittel — nervt, blockiert aber nichts

**6. Zu kleine Tippziele.** Faustregel sind 44×44px (Apple und Google sagen beide dasselbe). Darunter liegen:
- `.zu-btn` — `padding:7px 12px`, `font-size:12.5px` → ca. **31px hoch** ([azubipass.css:182](../quellen/azubipass.css))
- `.wahl button` — ca. **39px** ([azubipass.css:195](../quellen/azubipass.css))
- `.stufe-btn` — kein Mindestmaß, nur `padding-bottom:12px` ([azubipass.css:204](../quellen/azubipass.css))

Bei den Zuordnungsaufgaben sind das 63 × mehrere Knöpfe, die man am Daumen halb verfehlt.

**7. Tabellen wischen im Blindflug.** `.tab-huelle{overflow-x:auto}` ([azubipass.css:108](../quellen/azubipass.css)) macht Tabellen seitlich scrollbar — aber ohne jeden Hinweis, dass da rechts noch was ist. Bei einer 4-Spalten-Tabelle auf 375px siehst du zwei Spalten und ahnst nicht, dass zwei fehlen.

**8. `100vh` beim Hero.** `.hero{min-height:100vh}` ([azubipass.css:31](../quellen/azubipass.css)) — `100vh` meint am Handy die Höhe *ohne* Browserleisten. Der Startknopf rutscht unter die Adressleiste, und beim Scrollen springt das Layout. Standardproblem, Standardlösung (`100svh`).

**9. Kapitelwechsel ist umständlich.** Um von Kapitel 2 zu Kapitel 5 zu kommen: ganz nach oben scrollen → Wortmarke tippen → Startseite → Liste → tippen. Vier Schritte für etwas, das ein Antippen sein sollte.

**10. Schriften kommen aus dem Netz.** `schriften.css` existiert nicht, also läuft der Google-Fonts-Weg ([gemeinsames.py:34](../quellen/gemeinsames.py)) — ich hab's in `lf10.html` nachgeprüft, der Link ist drin. **Ohne Internet steht die Seite in Georgia da.** Für eine Offline-App ist das ein K.-o.-Kriterium, und nebenbei geht bei jedem Aufruf deine IP an Google.

### Klein

**11.** Der einzige Breakpoint für den Textbereich liegt bei 940px ([azubipass.css:332](../quellen/azubipass.css)). Zwischen „Tablet quer" und „iPhone SE" passiert nichts mehr — das Layout ist bei 375px dasselbe wie bei 900px, nur schmaler.

**12.** Kein `-webkit-text-size-adjust:100%` — beim Drehen ins Querformat kann iOS den Text eigenmächtig aufblasen.

**13.** Der Fortschrittsbalken oben ist 3px hoch ([azubipass.css:20](../quellen/azubipass.css)) und liegt am Handy unter dem Notch/der Statusleiste. Sieht man praktisch nie.

---

## 3 · Was gut ist und bleiben muss

Das ist kein Höflichkeitsabschnitt — das sind die Sachen, wegen denen die App überhaupt billig zu bauen ist.

**Das Datenmodell.** Kapitel sind Daten, kein HTML. Genau deshalb kann ich aus denselben Dateien eine App bauen, ohne einen Buchstaben Inhalt anzufassen. Das war die richtige Grundentscheidung und sie zahlt sich jetzt aus.

**Karteikarten fallen ab.** `karten_sammeln()` ([build.py:290](../quellen/build.py)) zieht jeden Merksatz automatisch als Karte heraus, weil `karteikarte` ein Pflichtfeld ist. 139 Karten ohne eine Minute Doppelpflege. Das ist der Grund, warum der Quiz-Teil der App fast geschenkt ist.

**Der gemeinsame Speicher.** Begriffe und Paragraphen stehen zentral in `gemeinsam.json`. Änderst du § 433 BGB einmal, ist er überall korrigiert. Das wird in der App direkt zu einem durchsuchbaren Lexikon.

**`pruefe.py` als Freigabe-Tor.** Ein automatischer Prüfer, der Kontrast nach WCAG misst, Überlappungen findet und leere Zeichenflächen meldet — das haben die meisten „richtigen" Projekte nicht. **Aber:** Er läuft nur mit `viewport 1440×1200` ([pruefe.py:217](../quellen/pruefe.py)). Für ein Handy-Projekt ist das ein Tor, das genau in die Richtung blind ist, um die es hier geht. Das muss erweitert werden, sonst sind alle Mobile-Fixes ungeprüft.

**Die Typografie.** 19px Serifenschrift, Zeilenhöhe 1,62 ([azubipass.css:15](../quellen/azubipass.css)) — das ist am Handy schon jetzt angenehmer als bei 90 % aller Lern-Apps. Nicht anfassen.

**Kein Framework.** Kein React, kein Build-Tool, keine 400 npm-Pakete. Reines HTML/CSS/JS. Deshalb ist die PWA-Umstellung eine Sache von zwei kleinen Dateien und nicht von einem Umbau.

---

## 4 · Wo die Architektur die App blockiert

Fünf Punkte, und alle laufen auf dasselbe hinaus: **Es gibt heute keine Ebene über den einzelnen Lernzetteln.**

**1. 13 Inseln ohne Verbindung.**
Jeder Lernzettel ist ein abgeschlossenes Dokument mit eigenem Speicher. `lf3.html` weiß nicht, dass `lf10.html` existiert. Damit sind unmöglich: Gesamtfortschritt, Streak, Suche über alles, lernfeldübergreifendes Karteikartentraining, „Woran war ich zuletzt dran?".

**2. Keine Adressen.**
Ohne URL pro Kapitel: keine Zurück-Taste, keine Links, keine Lesezeichen. Und der Service Worker (das Ding, das Offline möglich macht) arbeitet über Adressen — ohne saubere Adressen wird das Offline-Verhalten unberechenbar.

**3. Der Karteikarten-Stand bricht still.** ⚠️
Das ist der ernsteste Fund. Der Leitner-Stand wird unter dem **Array-Index** der Karte gespeichert ([azubipass.js:396–398](../quellen/azubipass.js)) — Karte Nr. 7 ist „die siebte Karte in der Reihenfolge, in der sie eingesammelt wurden".

Der Fingerabdruck-Schutz greift hier **nicht**: Er sitzt an den Kapitel-Sektionen, der Kartenstand liegt aber daneben unter `stand.karten`. Fügst du in Kapitel 2 einen Merksatz hinzu, verschiebt sich alles danach um eins. Dein Lernstand zeigt dann auf die falschen Karten — ohne Fehlermeldung, ohne dass du es merkst. Du hast dann Karten in Fach 3, die du nie gesehen hast, und Karten in Fach 1, die du längst konntest.

Heute ist das ärgerlich. In einer App, in der Statistik, Streak und „fällige Karten" daran hängen, ist es ein Datenschaden.

**4. Kein Weg raus.**
`localStorage` ist an genau einen Browser auf genau einem Gerät gebunden. Neues Handy = alles weg. Browserdaten gelöscht = alles weg. Es gibt keinen Export.

**5. Schriften aus dem Netz.**
Siehe Punkt 10 oben. Solange die Schriften nicht eingebettet sind, ist „Offline" gelogen.

---

## 5 · Funktionsumfang

### 5.1 Fortschritt & Streak

**Was schon da ist:** Lernziele haken sich automatisch ab, wenn du den zugehörigen Abschnitt liest ([azubipass.js:216](../quellen/azubipass.js)). Das ist elegant und bleibt.

**Was fehlt:** Ein Begriff von „Kapitel abgeschlossen". Heute gibt es nur „alle Lernziele erreicht" (= durchgescrollt). Vorschlag: **Ein Kapitel gilt als geschafft, wenn alle Lernziele erreicht sind UND der Selbsttest bearbeitet ist.** Beides wird schon gespeichert, es wird nur nie zusammengerechnet.

**Was gebaut werden muss:** Ein zentrales Konto (ein Speichereintrag statt 13), damit sich 13 Lernfelder zu einer Prozentzahl addieren lassen.

**Zum Streak bin ich skeptisch — und sage das direkt:**
Duolingo-Streaks funktionieren, weil eine Lektion drei Minuten dauert. Ein AzubiPass-Kapitel dauert 25–30 Minuten. Einen Streak, den du an einem 10-Stunden-Tag im Betrieb reißt, verlierst du irgendwann sicher — und dann demotiviert er mehr, als er je motiviert hat. Das ist der bekannteste Nebeneffekt von Streak-Mechaniken.

**Meine Empfehlung: Wochenziel statt Tagesstreak.** „4 von 7 Tagen gelernt" — verzeiht einen schlechten Tag, misst dasselbe, funktioniert bis November durch. Falls du den Tagesstreak trotzdem willst: nur mit Joker (ein Aussetzer pro Woche kostenlos).

**Verdikt:** Fortschritt → **V1**. Wochenziel → **V1**. Tagesstreak → deine Entscheidung, siehe Abschnitt 9.

---

### 5.2 Karteikarten & Quiz

**Die Frage, die du gestellt hast — reicht das Schema? Antwort: Ja. Keine Nacharbeit an 75 Kapiteln nötig.**

Das ist die gute Nachricht des Dokuments. Im Detail:

| Quelle | Menge | Automatisch verwendbar? |
|---|---|---|
| `merke` → `karteikarte` | 139 | ✅ Frage + Antwort komplett da |
| `check` → Frage/Optionen/richtig/echo | 75 | ✅ Fertige Multiple-Choice-Fragen inklusive Erklärung zu jeder falschen Antwort |
| `zuordnen` → Aufgaben + Lösung | 63 | ✅ Fertig |
| `selbsttest` → Frage + Musterlösung | 228 | ⚠️ Offene Fragen — ein Computer kann sie nicht bewerten |

**277 automatisch auswertbare Übungen** (139 + 75 + 63) stecken schon in den Daten. Die 228 Selbsttest-Fragen kommen dazu, aber nur als Selbsteinschätzung („wusste ich" / „wusste ich nicht") — das ist bei Fällen und Berechnungen auch völlig in Ordnung, denn eine Musterlösung mit der eigenen zu vergleichen ist ohnehin die bessere Übung.

**Der einzige Schema-relevante Punkt: Karten brauchen eine feste Kennung.**
Heute ist eine Karte „Nummer 7 in der Reihenfolge". Sie muss werden: `lf10-k4-b2-m1` (Lernfeld, Kapitel, Abschnitt, laufende Nummer im Abschnitt). Wichtig: **Das erzeugt `build.py` automatisch aus der Struktur, die schon da ist.** Du musst keine einzige der 75 Dateien anfassen. Danach überlebt der Lernstand jede Textänderung und jeden neuen Merksatz.

**Zum Wiederholungsverfahren:**
Der Leitner-Kasten mit 3 Fächern ist gebaut ([azubipass.js:387](../quellen/azubipass.js)) und funktioniert. Für 139 Karten pro Lernfeld reicht er. Für 400+ Karten über alle Lernfelder reicht er nicht mehr, und zwar aus einem konkreten Grund: **Er kennt keine Zeit.** Du kannst eine Karte dreimal hintereinander in derselben Minute „gewusst" klicken und sie gilt als sitzend.

**Empfehlung: Leitner mit Wartezeiten.** Fach 1 = morgen wieder, Fach 2 = in 3 Tagen, Fach 3 = in 7 Tagen, Fach 4 = in 21 Tagen. Das ist echtes verteiltes Lernen (der Effekt, der beim Behalten tatsächlich wirkt), kostet aber nur ein zusätzliches Datum pro Karte — kein komplizierter Algorithmus. Bewusst **kein SM-2/Anki-Verfahren**: mehr Mathematik, kein spürbarer Unterschied bei dieser Kartenmenge.

**Verdikt:** Karten-IDs → **V1**. Lernfeldübergreifender Trainer mit Wartezeiten → **V1**. Checks/Zuordnen als Quizpool → **V2**.

---

### 5.3 Suche & Lesezeichen

**Suche.** Braucht ein Inhaltsverzeichnis aller Texte — eine Datei `suchindex.json`, die `build.py` beim Bauen nebenbei mitschreibt. Grobe Rechnung: 75 Kapitel × ~6 KB Text = ~450 KB, gepackt etwa 120 KB. Völlig vertretbar.

**Bewusst ohne Suchbibliothek.** Es gibt fertige Werkzeuge dafür (Lunr, FlexSearch, ~40 KB). Für 75 Kapitel ist einfaches „kommt das Wort vor?" auf jedem Handy sofort fertig — die Bibliothek würde nur Gewicht und eine Abhängigkeit hinzufügen. Falls sich das später als zu grob anfühlt, kann man immer noch nachrüsten.

**Was die Suche finden soll:** Kapiteltitel, Abschnittsüberschriften, Fließtext, **und** die Begriffe und Paragraphen aus `gemeinsam.json`. Letzteres ist fast gratis und macht die Suche sofort nützlich: „§ 377 HGB" tippen → Gesetzestext plus alle Stellen, wo er vorkommt.

**Lesezeichen.** Neues Feld im Konto, kein Eingriff ins Schema. Einfach.

**Notizen — ehrliche Einschätzung: lass es weg.**
Du hast ein Obsidian-Vault. Du schreibst Notizen dort. Eine zweite Notizfunktion in der Lern-App wird dreimal benutzt und dann nie wieder, und sie ist der einzige Teil, der irgendwann den Speicher sprengen könnte. Wenn du beim Lernen etwas festhalten willst, ist „Kapitel als Lesezeichen + Schwachstellenliste" der ehrlichere Weg.

**Verdikt:** Suche → **V1**. Lesezeichen → **V1**. Notizen → **Verworfen**, Begründung oben.

---

### 5.4 Offline & Dark Mode

**Offline.** Zwei Dinge fehlen: ein Service Worker (das Programm, das die Seiten im Gerät zwischenspeichert) und eingebettete Schriften. Letzteres ist ein einziger Befehl — `schriften.py` einmal laufen lassen, dann steckt die Schrift in der Seite und der Google-Link verschwindet von selbst ([gemeinsames.py:26](../quellen/gemeinsames.py) ist dafür schon gebaut).

Zwischenspeicher-Bedarf: 3,3 MB HTML + ~400 KB Schriften. Für eine installierte App ist das nichts.

**Aber verschwenderisch:** Von den 3,3 MB sind ~1,7 MB dieselben 135 KB CSS/JS, 13-mal kopiert. Wenn ohnehin am Build gearbeitet wird, kann man CSS und JS in eigene Dateien auslegen → 3,3 MB werden ~1,7 MB, und der Browser lädt sie nur einmal statt 13-mal. **Haken:** Danach lässt sich eine `lf3.html` nicht mehr per Doppelklick öffnen, sie braucht einen Server. Für eine App ist das egal — für „schnell mal auf dem Schul-PC zeigen" nicht. Deine Entscheidung, siehe Abschnitt 9.

**Dark Mode — hier bin ich unbequem: das ist mehr Arbeit, als es klingt.**

Die 8 Farbvariablen in `:root` umzudrehen ist eine halbe Stunde. Das Problem sind zwei andere Sachen:

1. **Rund 40 hartkodierte Farben** in den Grafik-Styles — überall steht `rgba(245,245,240,.62)` statt einer Variable. Jede davon muss zur Variable werden, sonst bleibt im Dark Mode heller Text auf hellem Grund stehen.

2. **Die dunklen Inseln.** Das Design lebt davon, dass Grafiken (`.sig`), Zusammenfassungen (`.zus`), der Hero und Tabellen-Details **dunkel auf hellem Papier** liegen. Im Dark Mode verschwinden sie — dunkel auf dunkel. Die Lösung ist nicht „auch umdrehen" (dann wären es helle Kästen auf dunklem Grund, das zerstört den Charakter), sondern: **die Inseln werden eine Stufe heller als die Seite.** Aus „dunkle Insel auf hellem Papier" wird „leicht erhobene Insel auf tiefem Grund". Der Rhythmus bleibt, die Richtung dreht sich.

Realistischer Aufwand: ein voller Arbeitstag, plus ein `pruefe.py`-Durchlauf im Dark Mode, sonst rutscht irgendwo der Kontrast unter die Lesbarkeitsgrenze.

**Verdikt:** Offline → **V1**. Dark Mode → **V2** (nicht weil unwichtig, sondern weil es der teuerste Punkt der Liste ist und die App auch ohne ihn eine App ist).

---

### 5.5 Was ich zusätzlich vorschlage

| # | Funktion | Nutzen | Aufwand | Wann |
|---|---|---|---|---|
| 1 | **Prüfungs-Countdown** — „noch 109 Tage bis AP2" | Hoch: gibt allem einen Bezugspunkt | **Winzig** — der Termin steht schon in [landing.config.json:32](../quellen/landing.config.json) | V1 |
| 2 | **„Weiterlernen"-Karte** auf der Startseite | Sehr hoch: App öffnen → ein Tipp → weiter, wo du warst | **Winzig** — die Position wird schon gespeichert ([azubipass.js:43](../quellen/azubipass.js)) | V1 |
| 3 | **Export / Backup** — Fortschritt als Datei sichern und zurückspielen | Hoch: rettet dich beim Handywechsel | Klein | V1 |
| 4 | **Schwachstellen-Liste** — was du falsch hattest oder nicht wusstest | **Sehr hoch**: die ehrlichste Lernhilfe überhaupt | Klein — falsche Checks, falsche Zuordnungen und jedes „Weiß ich nicht" werden **schon heute gespeichert** und nur nie ausgewertet | V1 |
| 5 | **Spickzettel pro Lernfeld** — alle Merksätze eines Lernfelds auf einer Seite | Hoch: das perfekte Ding für die Bahnfahrt und den Abend vor der Prüfung | Sehr klein — Daten liegen da | V2 |
| 6 | **Begriffs- und Paragraphenlexikon** — A–Z, durchsuchbar | Mittel-hoch | Sehr klein — `gemeinsam.json` ist genau das schon | V2 |
| 7 | **Lernsession mit Zeitbudget** — „ich hab 15 Minuten" → passende Mischung | Mittel | Mittel | V2 |
| 8 | **Prüfungssimulation** — 90 Minuten, gemischt über alle Lernfelder | Hoch, aber erst ab Oktober | Mittel | V3 (September/Oktober) |

**Nr. 4 ist mein stärkster Vorschlag.** Die Daten liegen seit Monaten in deinem `localStorage` und niemand hat sie je angeschaut. Eine Liste „Diese 12 Sachen hattest du falsch" ist mehr wert als jede Gamification.

---

### 5.6 Priorisierung — die vollständige Liste

**Version 1 · Muss**
- Handy-Politur: Touch-Ziele, Tabellen-Wischhinweis, `100svh`, Kommazahlen, Grafik-Beschriftungen
- Schriften einbetten
- Installierbar + offline
- Ein zentrales Konto + Export/Import
- Adressen pro Kapitel + funktionierende Zurück-Taste
- Startseite mit Weiterlernen, Gesamtfortschritt, Countdown, Wochenziel
- Karten-IDs + lernfeldübergreifender Trainer mit Wartezeiten
- Suche
- Lesezeichen
- Schwachstellen-Liste

**Version 2 · Bald**
- Dark Mode
- Quizpool aus Checks und Zuordnungen
- Spickzettel pro Lernfeld
- Begriffslexikon
- Lernsession mit Zeitbudget

**Version 3 · Wenn V1 und V2 sich bewährt haben**
- Prüfungssimulation (sinnvoll ab Oktober)

**Verworfen — mit Begründung**

| Was | Warum nicht |
|---|---|
| **Notizen an Kapiteln** | Du hast Obsidian. Zweitsystem, das nach drei Wochen tot ist. |
| **Push-Benachrichtigungen** | Auf dem iPhone bei PWAs stark eingeschränkt, und „Zeit zu lernen!"-Meldungen werden bei einem Werkzeug, das man bewusst aufsucht, weggewischt und dann abgeschaltet. |
| **Cloud-Sync / Benutzerkonto** | Server, laufende Kosten, Passwörter, DSGVO — für **einen** Nutzer auf **einem** Handy. Der Export-Knopf löst dasselbe Problem an einem Nachmittag. |
| **Punkte, Level, Maskottchen, Konfetti** | Du hast entschieden, dass das Design bleibt. Das Design ist ruhig und erwachsen. Ein Feuerwerk beim Kapitelabschluss würde genau die Wirkung kaputtmachen, für die du die Seite gebaut hast. |
| **App Store / Play Store** | 99 €/Jahr bei Apple, Review-Prozess, zweiter Veröffentlichungsweg — für null zusätzliche Funktion. Eine installierte PWA sieht auf dem Homescreen identisch aus. |
| **Umbau auf React/Vue** | Ein funktionierendes Vanilla-JS-Projekt neu zu schreiben, um dasselbe zu können. Klassischer Zeitfresser. |
| **Suchbibliothek** | 40 KB und eine Abhängigkeit für 75 Kapitel, die einfache Suche in Millisekunden schafft. |

---

## 6 · Kritische Prüfung des eigenen Konzepts

### Was daran ist überkonstruiert?

Ich hab das Konzept nochmal gegen die Ponytail-Fragen laufen lassen (Muss das existieren? Gibt es was Vorhandenes? Geht es kürzer?) — vier Sachen sind rausgeflogen oder geschrumpft:

- **Suchbibliothek** → raus. Teilstring-Suche reicht.
- **SM-2-Algorithmus** → geschrumpft auf „Leitner plus Wartezeit". Gleicher Effekt, ein Datum statt einer Formel.
- **Router-Bibliothek** → raus. Die History-API des Browsers kann das in ~30 Zeilen.
- **Ein zweites Build-Skript für die App** → raus. Stattdessen ein kleiner Zusatzschritt, der nach `build.py` einmal läuft. Bestehendes erweitern, nicht daneben neu bauen.

**Was ich bewusst drin lasse, obwohl es Aufwand ist:** die Karten-IDs. Ohne sie ist der Lernstand ein Datenschaden, der nicht auffällt. Das ist kein Komfort, das ist Korrektheit.

### Wo baue ich Features, die du nie nutzen wirst?

Ehrlich, drei Verdachtsfälle:

1. **Notizen** — schon rausgeworfen, siehe oben.
2. **Lernsession mit Zeitbudget** — klingt gut, in der Praxis öffnet man die App und fängt an. Ein Timer ist eher Bevormundung. Deshalb V2 und nicht V1: wenn du nach zwei Monaten merkst, dass du es nie vermisst hast, baue ich es nie.
3. **Tagesstreak** — siehe 5.1. Ich vermute, der Streak nervt dich in Woche 3 mehr, als er in Woche 1 motiviert hat.

**Und ein vierter, unbequemer:** In deinem Vault steht als Muster notiert, dass du dazu neigst, Qualitätswerkzeuge zu bauen statt Sachen fertig zu machen. Dieses Konzept hat genau die Bauart, die dieses Muster füttert — eine App zu bauen fühlt sich produktiver an, als für die AP2 zu lernen. **Die AP2 ist am 24. November 2026, das sind noch 109 Tage.** Deshalb ist der Fahrplan in Abschnitt 8 so geschnitten, dass **Abschnitt 1 und 2 zusammen an einem Wochenende fertig sind** und die App danach benutzbar ist. Alles Weitere ist optional. Wenn du nach Abschnitt 2 aufhörst und stattdessen lernst, war das die richtige Entscheidung.

### Welche technischen Risiken gibt es?

**1. iOS löscht deine Daten nach 7 Tagen. ⚠️**
Safari räumt `localStorage` von Webseiten auf, die 7 Tage nicht benutzt wurden. **Ausnahme: PWAs, die zum Homescreen hinzugefügt wurden** — die sind ausgenommen. Das heißt: Installieren ist bei iPhone nicht Komfort, sondern Datenschutz für deinen Fortschritt. Plus der Export-Knopf als zweite Sicherung.

**2. Speicherlimit.** `localStorage` sind ~5 MB. Dein Fortschritt liegt bei deutlich unter 100 KB, selbst mit allen Selbsttest-Antworten. Kein Problem. (Wären Notizen dazugekommen, wäre es irgendwann eines geworden — noch ein Grund, sie wegzulassen.)

**3. Browserdaten löschen.** Wenn du in den Einstellungen „Websitedaten löschen" antippst, ist alles weg, auch bei installierter PWA. Dagegen hilft nur der Export. Deshalb steht er in V1.

**4. Der Kartenstand-Bug.** Siehe 4.3. Er ist heute schon aktiv. Bei jedem Merksatz, den du je nachträglich hinzugefügt hast, ist der Leitner-Stand des betroffenen Lernfelds still verrutscht.

### Was passiert mit meinem Fortschritt, wenn ein Kapitel neu gebaut wird?

**Heute:** Korrigiere ich einen Tippfehler in einem einzigen Absatz von LF10-K4, ändert sich der Textabdruck des ganzen Kapitels — und **alles** aus diesem Kapitel ist weg: erreichte Lernziele, angeklickte Checks, Zuordnungen, dein getippter Selbsttext. Wegen eines Kommas.

Der Mechanismus ist richtig gedacht (lieber verlieren als falsch zuordnen), aber zu grob geschnitten. In der App wird er schlimmer, weil dann auch Gesamtfortschritt und Wochenziel daran hängen — dein Fortschrittsbalken würde nach einer Rechtschreibkorrektur sichtbar zurückspringen.

**Vorschlag, dreiteilig:**

1. **Der Abdruck wandert vom Kapitel zum einzelnen Baustein.** Ein Tippfehler im Absatz kostet dann diesen Absatz, nicht das Kapitel.
2. **Der Kapitel-Haken wird getrennt gespeichert, ohne Abdruck.** „Ich hab dieses Kapitel gelesen" bleibt wahr, auch wenn sich ein Komma geändert hat.
3. **Karten hängen an ihrer ID, nicht an ihrer Position.** Ein neuer Merksatz kommt als neue Karte in Fach 1 dazu und lässt alles andere in Ruhe.

Danach gilt: Neu bauen kostet dich nichts mehr außer den Antworten auf Fragen, die sich tatsächlich geändert haben. Genau so soll es sein.

---

## 7 · Struktur & Screens

### 7.1 Die fünf Bereiche

```
┌─ HEUTE ────────── Startseite. Weiterlernen · Countdown · Fortschritt · fällige Karten
│
├─ LERNEN ───────── 13 Lernfelder → Kapitelliste → Kapitel (das bestehende Leseerlebnis)
│
├─ ÜBEN ─────────── Fällige Karten · Quiz · Schwachstellen · Spickzettel (V2)
│
├─ SUCHE ────────── Volltext über alle Lernfelder + Begriffe + Paragraphen
│
└─ ICH ──────────── Fortschritt im Detail · Lesezeichen · Export · Dark Mode · Einstellungen
```

**Startansicht: HEUTE.** Begründung: Beim Öffnen soll genau eine Frage beantwortet sein — „was mache ich jetzt?". Eine Lernfeldliste als Start beantwortet die nicht, sie stellt sie.

### 7.2 Navigationsmuster: Tab-Leiste unten

**Warum Tab-Leiste und nicht Drawer (Hamburger-Menü):**

- **Daumenreichweite.** Am Handy hält man einhändig. Unten ist erreichbar, oben links (wo der Hamburger sitzt) ist die schlechteste Stelle des Bildschirms.
- **Sichtbarkeit.** Eine Tab-Leiste zeigt dir, dass es „Üben" gibt. Ein Drawer versteckt es. Bei fünf Bereichen ist Verstecken das Gegenteil von hilfreich.
- **Erwartung.** Auf iOS und Android ist die Tab-Leiste der Standard für Apps mit wenigen Hauptbereichen. Vertraut = keine Lernkurve.

**Vier Tabs, nicht fünf:** Heute · Lernen · Üben · Ich. **Die Suche kommt als Lupe in die Kopfzeile** — Suche ist eine Aktion, kein Ort, und sie soll aus jedem Kontext heraus erreichbar sein.

**Wichtige Ausnahme:** Im Lesemodus fährt die Tab-Leiste beim Runterscrollen weg und beim Hochscrollen wieder rein. Sonst frisst sie dauerhaft 56px vom Lesefenster — und Lesen ist das, wofür die App da ist.

### 7.3 Die Screens im Einzelnen

#### HEUTE

| | |
|---|---|
| **Zweck** | In einem Blick zeigen, was heute dran ist |
| **Inhalt** | Weiterlernen-Karte (Lernfeld, Kapitel, Position) · Countdown zur AP2 · Gesamtfortschritt · Wochenziel · Anzahl fälliger Karten |
| **Wichtigste Aktion** | „Weiterlernen" — großer Knopf, ein Tipp bis zum Text |
| **Leerzustand** | Beim allerersten Start: „Fang mit LF1 an" statt einer leeren Fläche |
| **Fehlerzustand** | Wenn der Fortschritt nicht lesbar ist: ehrliche Meldung + Angebot, ein Backup einzuspielen. Nie stillschweigend auf null setzen. |
| **Ladezustand** | Entfällt — alles liegt lokal, das ist sofort da |

#### LERNEN · Lernfeldliste

| | |
|---|---|
| **Zweck** | Überblick über alle 13 Lernfelder |
| **Inhalt** | Pro Lernfeld: Nummer, Titel, Kapitelzahl, Minuten, Fortschrittsbalken, AP1/AP2-Kennzeichnung |
| **Wichtigste Aktion** | Lernfeld antippen |
| **Leerzustand** | Gibt es nicht, 13 sind immer da |
| **Besonderheit** | Angefangene Lernfelder oben, unberührte darunter — die Reihenfolge folgt deinem Lernen, nicht der Nummerierung |

#### LERNEN · Kapitelliste

Im Kern das bestehende `.buch`-Element ([build.py:331](../quellen/build.py)) — es funktioniert und sieht gut aus. Ergänzt um: Haken bei geschafften Kapiteln, Fortschrittspunkt beim laufenden, Lesezeichen-Markierung.

#### LERNEN · Kapitel (Lesemodus)

**Das ist der wichtigste Screen der App und der, an dem am wenigsten geändert wird.** Der bestehende Aufbau bleibt: Auftakt → Lernziele → Abschnitte mit Grafiken und Checks → Zusammenfassung → Selbsttest → Prüfungstipp → Weiter.

Geändert wird nur, was am Handy nicht funktioniert (siehe 7.4).

| | |
|---|---|
| **Leerzustand** | Entfällt |
| **Fehlerzustand** | Wenn eine Grafik-Variante fehlt, steht sichtbar „Bauteil … ist noch nicht gebaut" — das gibt es schon ([azubipass.js:510](../quellen/azubipass.js)) und ist genau richtig |
| **Ladezustand** | Bei ~250 KB pro Lernfeld: kurzer Platzhalter beim ersten Öffnen, danach aus dem Zwischenspeicher sofort |

#### ÜBEN

| | |
|---|---|
| **Zweck** | Wiederholen, ohne ein Kapitel aufmachen zu müssen |
| **Inhalt** | Drei Einstiege: „Heute fällig (23)" · „Quiz" · „Deine Schwachstellen (7)" |
| **Wichtigste Aktion** | Fällige Karten starten |
| **Leerzustand** | **Der wichtigste Leerzustand der App.** Keine Karten fällig heißt nicht „nichts zu tun" — es heißt „du bist durch". Also: „Alles Fällige erledigt. Nächste Karten morgen — willst du vorarbeiten?" mit Knopf. Niemals ein leerer Bildschirm. |
| **Fehlerzustand** | Wenn nach einem Rebuild Karten-IDs unbekannt sind: „5 neue Karten sind dazugekommen" — als Information, nicht als Fehler |

#### SUCHE

| | |
|---|---|
| **Zweck** | „Wo stand nochmal was zum Zahlungsverzug?" |
| **Inhalt** | Eingabefeld, Treffer gruppiert nach Lernfeld, Suchwort im Fundstück hervorgehoben |
| **Wichtigste Aktion** | Treffer antippen → direkt an die Stelle im Kapitel |
| **Leerzustand** | Vor der Eingabe: die letzten Suchen + „Häufig gesucht: § 377 HGB, Skonto, Deckungsbeitrag" |
| **Kein Treffer** | Nicht nur „nichts gefunden", sondern der nächstähnliche Begriff aus dem Lexikon |

#### ICH

| | |
|---|---|
| **Zweck** | Fortschritt im Detail, Datensicherheit, Einstellungen |
| **Inhalt** | Fortschritt pro Lernfeld · Lesezeichen · Karten-Statistik · **Export/Import** · Dark Mode · Schriftgröße |
| **Wichtigste Aktion** | Export — und er gehört sichtbar nach oben, nicht in ein Untermenü |

### 7.4 Wie das bestehende Design aufs Handy übersetzt wird

**Kein neues Design. Dieselben Farben, dieselben Schriften, dieselbe Haltung — nur richtig gerechnet für 375 Pixel.**

#### Text und Abstände

| | Heute | Am Handy | Warum |
|---|---|---|---|
| Fließtext | 19px / 1,62 | **18px / 1,65** | 19px Serif bei 375px Breite ergibt sehr kurze Zeilen. 18px mit etwas mehr Zeilenabstand liest sich ruhiger |
| Seitenrand | 24px | **20px** | Bringt ~40 Zeichen pro Zeile statt 36 |
| Kapitelnummer | 118px → 76px | **56px** | 76px füllt bei 375px ein Viertel der Bildhöhe, nur um „K4" zu sagen |
| Überschrift H3 | 27px | **23px** | |
| Abschnittsabstand | 56px | **40px** | Am Handy kostet jeder Leerraum echtes Lesefenster |

#### Tippziele

Alle interaktiven Elemente bekommen `min-height:44px`. Betroffen: `.zu-btn`, `.wahl button`, `.stufe-btn`, `.opt`, `.dreher`, `.buch li`, `.mx-chip`, `.zu-knoepfe`. Und `-webkit-tap-highlight-color` auf einen goldenen Schimmer statt des grauen Standardkastens — kostet nichts, fühlt sich sofort weniger nach Webseite an.

#### Tabellen

Zwei Fälle, unterschiedlich behandelt:

- **Bis 3 Spalten:** umbrechen in Karten (jede Zeile wird ein kleiner Block mit Spaltenname davor). Liest sich am Handy deutlich besser.
- **Ab 4 Spalten:** bleibt eine Tabelle zum Wischen — Kartenlayout würde hier die Vergleichbarkeit zerstören, und genau darum geht es bei einer 4-Spalten-Tabelle. **Aber mit sichtbarem Hinweis:** ein weicher Verlaufsschatten am rechten Rand, der verschwindet, sobald man am Ende ist. Erste Spalte bleibt beim Wischen stehen.

#### Die 16 Grafiken

Ich hab sie in drei Gruppen sortiert, weil sie unterschiedlich viel Arbeit machen:

**Gruppe A — skalieren von selbst, nur Schriften nachziehen** (4)
`organigramm`, `kreislauf`, `brief`, `breakeven` — sind SVG mit `width:100%`. Beschriftungen relativ zur Zeichenfläche skalieren statt fixer Pixel.

**Gruppe B — brauchen einen Umbruch** (7)
`t-konto`, `veraenderung`, `stufen`, `kalkulationsleiter`, `staffel`, `balkenplan`, `matrix` — sind Raster mit fixen Spaltenbreiten. Unter 700px: `.konten` und `.regler` auf eine Spalte, `.lz` bekommt Beschriftung über statt neben dem Feld, `.staffel-stufe` bricht auf zwei Zeilen.

**Gruppe C — brauchen Mindestbreite + Wischen** (5)
`lagerkurve`, `durchlauf`, `vergleich`, `liquiditaet`, `kette` — Zeitachsen und Kurven, die man nicht sinnvoll stapeln kann. Feste Mindestbreite (~560px), waagerecht wischbar, mit demselben Verlaufsschatten wie bei Tabellen. Besser eine wischbare Kurve als eine unlesbare.

#### Begriffs-Blase → Blatt von unten

Unter 700px wird aus `#blase` ein Bottom-Sheet: fährt von unten ein, volle Breite, Griff zum Wegwischen, dunkler Schleier dahinter. Und **das `resize`-Schließen wird auf echte Größenänderungen eingegrenzt**, damit die Adressleiste sie nicht mehr wegräumt.

#### Kleinkram mit großer Wirkung

- `100vh` → `100svh` (kein Springen mehr)
- `-webkit-text-size-adjust:100%` (kein Aufblasen im Querformat)
- `inputmode="decimal"` + Komma-Eingabe akzeptieren (Rechner funktionieren endlich)
- `overscroll-behavior:contain` (kein versehentliches Neuladen beim Nach-oben-Ziehen)
- `theme-color`-Meta in Tinte-Grün — die Statusleiste des Handys färbt sich mit, das ist der billigste „das ist eine App"-Effekt, den es gibt
- Fortschrittsbalken von 3px auf 4px und unter den sicheren Bereich, damit er nicht unterm Notch verschwindet

#### Dark Mode

Ausgangspunkt sind deine Farben, nur die Rollen tauschen:

| Rolle | Hell (heute) | Dunkel |
|---|---|---|
| Seite | `--creme #F5F5F0` | `#141614` (fast schwarz, minimal grün gebrochen) |
| Karten/Kästen | `--papier #FBFBF8` | `#1C1F1C` |
| Text | `--text #1A1D1A` | `#E8E8E2` (nicht reinweiß — reinweiß auf schwarz flimmert) |
| Tinte (Akzent) | `#1B4332` | `#7FC4A0` — dieselbe Farbe, aufgehellt |
| Gold | `#C9A227` | `#D6B44A` — leicht entsättigt, sonst brennt es |
| **Dunkle Inseln** (`.sig`, `.zus`, Hero) | dunkel auf hell | **`#242822` — eine Stufe HELLER als die Seite** |

Die letzte Zeile ist der eigentliche Trick. Der Rhythmus „Papier, Insel, Papier" bleibt erhalten, nur die Richtung dreht sich. Das Ergebnis sieht nach demselben Produkt aus, nicht nach einer fremden App.

Umgesetzt über `prefers-color-scheme` (folgt automatisch der Handy-Einstellung) **plus** manuellem Schalter unter „Ich" — Handy dunkel, Lern-App aber trotzdem hell (oder umgekehrt) ist ein legitimer Wunsch.

---

## 8 · Technischer Fahrplan

### 8.1 Was sich wo ändert

**`build.py` — erweitern, nicht ersetzen**
- Stabile Karten-IDs vergeben (aus Lernfeld/Kapitel/Abschnitt, automatisch)
- Beim Bauen den Suchtext mit ausgeben
- `theme-color` und den Manifest-Verweis in den Kopf schreiben
- Optional: CSS/JS auslagern statt einbetten

**Neu: ein kleiner Zusatzschritt (`build_app.py`, ~100 Zeilen)**
Läuft **nach** allen `build.py`-Läufen, einmal, und schreibt:
- `suchindex.json` — alle Texte, Begriffe, Paragraphen
- `karten.json` — alle Karten aus allen Lernfeldern mit IDs
- `manifest.json` — Name, Symbol, Farben (macht die Seite installierbar)
- `sw.js` — der Service Worker mit der Liste aller zu speichernden Dateien
- `app.html` — die Schale mit Startseite, Tab-Leiste und Suche

Warum ein Zusatzschritt und kein zweites Bausystem: Er liest nur, was `build.py` ohnehin erzeugt. Ändert sich ein Kapitel, läuft alles automatisch mit.

**JSON-Schema: keine Pflichtänderung.** Die 75 Kapiteldateien bleiben, wie sie sind.

**`azubipass.css`**
- Neuer Breakpoint-Block unter 700px (der fehlende)
- Tippziele auf 44px
- Tabellen-Umbruch und Wischhinweis
- Grafik-Anpassungen Gruppe B und C
- Bottom-Sheet
- Später: Dark-Mode-Variablen + die ~40 hartkodierten Farben zu Variablen machen

**`azubipass.js`**
- Adressverwaltung über die History-API (~30 Zeilen) → Zurück-Taste, Links, Lesezeichen
- Ein zentraler Speicher statt 13 — **inklusive Übernahme des bestehenden Fortschritts**, damit nichts verloren geht
- Feinerer Textabdruck (pro Baustein) + Kapitel-Haken ohne Abdruck
- Trainer: Wartezeiten statt reiner Fächer, Karten-IDs statt Positionen
- Bottom-Sheet, Tab-Leiste, Suche, Export/Import
- Kommazahlen in allen Rechnern

**`pruefe.py` — der wichtigste Punkt, den man leicht übersieht**
Ein zweiter Durchlauf mit `viewport 390×844` (iPhone-Größe), plus ein dritter im Dark Mode. **Ohne das ist das Freigabe-Tor genau in die Richtung blind, um die es in diesem ganzen Dokument geht.** Zusätzlich eine neue Prüfung: „gibt es klickbare Elemente unter 44px?" — der Computer findet die zuverlässiger als du.

### 8.2 Wo deine Daten liegen

**Ein Eintrag, ein Format:**

```
azubipass:konto
├── version          (für spätere Umstellungen)
├── fortschritt      pro Kapitel: gelesen, Lernziele, Checks, Zuordnungen, Selbsttest
├── karten           pro Karten-ID: Fach, nächster Termin, Fehlversuche
├── lesezeichen
├── aktivitaet       welche Tage gelernt (für das Wochenziel)
└── zuletzt          Lernfeld + Kapitel + Position
```

Größe: geschätzt 40–80 KB voll ausgereizt. Das Limit sind 5 MB.

**Export:** Ein Knopf schreibt genau diese Struktur als `azubipass-fortschritt-2026-08-07.json` — teilbar, in die Cloud legbar, per Mail an dich selbst. Import liest sie zurück und fragt vorher: überschreiben oder zusammenführen.

**Umstellung vom Alten:** Beim ersten Start der App werden die 13 alten Einträge eingelesen, zusammengeführt und der alte Zustand bleibt vorerst liegen (nicht löschen — falls etwas schiefgeht, ist er noch da).

### 8.3 Die Bauabschnitte

Jeder Abschnitt ist für sich fertig, für sich testbar, und nach jedem kann man aufhören.

---

**Abschnitt 1 · Am Handy ordentlich**
*Keine neue Funktion. Die bestehende Seite wird am Handy richtig gut.*

Schriften einbetten · `100svh` · Tippziele auf 44px · Tabellen-Wischhinweis · Kommazahlen · Grafiken Gruppe A/B/C · Bottom-Sheet · Blasen-Bug beheben · `pruefe.py` mit Handy-Durchlauf

**Fertig, wenn:** `pruefe.py` bei 390×844 über alle 14 Seiten grün ist.
**Danach:** Die Seite fühlt sich am Handy schon zu 80 % wie eine App an. Ohne dass eine einzige neue Funktion existiert.

---

**Abschnitt 2 · Installierbar**

`manifest.json` · App-Symbol · Service Worker · Offline-Test im Flugmodus · Hinweis „Zum Homescreen hinzufügen"

**Fertig, wenn:** Symbol auf dem Homescreen, Start im Flugmodus, alle 13 Lernfelder lesbar.
**Danach:** Es ist eine App. Ab hier ist alles Weitere optional.

> **Abschnitte 1 und 2 sind zusammen ein Wochenende.** Danach hast du das, wonach du gefragt hast. Alles ab hier macht sie besser, nicht erst möglich.

---

**Abschnitt 3 · Ein Konto**

Zentraler Speicher · Übernahme des alten Fortschritts · feinerer Textabdruck · Export/Import

**Fertig, wenn:** Fortschritt exportiert, Browserdaten gelöscht, importiert — alles wieder da.
**Warum vor Abschnitt 5:** Sonst wird der Fortschritt zweimal gebaut.

---

**Abschnitt 4 · Adressen & Zurück-Taste**

History-API · Adresse pro Kapitel · Zurück-Taste · Deep-Links

**Fertig, wenn:** Zurück-Taste geht ein Kapitel zurück, ein kopierter Link öffnet dasselbe Kapitel.

---

**Abschnitt 5 · Die App-Schale**

Startseite · Tab-Leiste · Gesamtfortschritt · Countdown · Weiterlernen · Wochenziel

**Fertig, wenn:** App öffnen → ein Tipp → du liest weiter, wo du aufgehört hast.

---

**Abschnitt 6 · Üben**

Karten-IDs · lernfeldübergreifender Trainer mit Wartezeiten · Schwachstellenliste

**Fertig, wenn:** 400+ Karten aus allen Lernfeldern in einem Stapel, „heute fällig" stimmt, Schwachstellen zeigen echte Fehler von dir.

---

**Abschnitt 7 · Suche**

Suchindex · Suchbildschirm · Sprung an die Fundstelle · Begriffslexikon

---

**Abschnitt 8 · Dark Mode**

Farben zu Variablen · dunkle Inseln umkehren · Schalter · `pruefe.py` im Dark Mode

---

## 9 · Offene Entscheidungen für Lukes

Acht Punkte, bei denen ich nicht für dich entscheiden will. Zu jedem meine Empfehlung und warum.

---

**1. Wo soll die App liegen?**

Ein Service Worker läuft **nicht** über `file://` — du kannst die App nicht per Doppelklick starten. Sie braucht eine echte Adresse mit HTTPS.

→ **Empfehlung: GitHub Pages.** Kostenlos, dein Vault liegt ohnehin auf GitHub, HTTPS ist dabei, und „hochladen" heißt einfach pushen. Alternative wäre Netlify (auch kostenlos, etwas komfortabler).

**Das ist die einzige Entscheidung, die alle anderen blockiert** — ohne Hosting kein Abschnitt 2.

---

**2. LF6 fehlt.**

In `quellen/` liegen LF1–LF5, LF7–LF13 und Buchführung. **Kein LF6.** Absicht (weil nicht prüfungsrelevant) oder übersehen?

→ Falls Absicht: Die Landing-Page sollte das erklären, sonst sieht es nach einer Lücke aus.

---

**3. Tagesstreak oder Wochenziel?**

→ **Empfehlung: Wochenziel** („4 von 7 Tagen"). Ein Streak bei 30-Minuten-Kapiteln reißt garantiert und demotiviert dann mehr, als er vorher motiviert hat. Falls Streak, dann nur mit Joker.

---

**4. CSS und JS auslagern?**

**Dafür:** 3,3 MB → 1,7 MB, schnelleres Laden, nur eine Datei zu pflegen.
**Dagegen:** Einzelne `lf3.html` lässt sich nicht mehr per Doppelklick öffnen.

→ **Empfehlung: ja, aber erst in Abschnitt 2** — dort steht ohnehin ein Server bereit. Ein Kapitel schnell auf einem fremden Rechner zeigen geht dann über die Web-Adresse.

---

**5. Free/Premium — gilt das noch?**

`landing.config.json` enthält Preise (6,99 € / 11,99 € / 54,99 € / Abos), und `build_landing.py` rechnet damit. In deinen Notizen steht dagegen, dass AzubiPass nicht verkauft wird.

→ **Wenn nicht verkauft wird:** raus damit. Die `frei`-Kennzeichnung pro Kapitel fällt weg, die Landing-Page wird ehrlicher, die App wird einfacher. **Wenn doch verkauft werden soll:** muss das *vor* Abschnitt 5 geklärt sein, weil dann eine Zugangsverwaltung dazukommt — und das ist ein komplett anderes Projekt.

---

**6. Feinerer Textabdruck — einverstanden?**

Heute kostet ein korrigiertes Komma den kompletten Fortschritt eines Kapitels.

→ **Empfehlung: ja** (Abdruck pro Baustein, Kapitel-Haken ohne Abdruck). Kleiner Eingriff, verhindert dauerndes stilles Zurücksetzen.

---

**7. Nur für dich oder auch für andere Azubis?**

Ändert nichts an den Abschnitten 1–8, aber an Kleinigkeiten: Bei „nur für dich" kann der Prüfungstermin fest verdrahtet sein und der Ton persönlich bleiben. Bei „auch für andere" braucht es einen einstellbaren Termin, einen Startbildschirm für Neue und mehr Sorgfalt bei den Texten.

→ **Empfehlung: erstmal nur für dich bauen.** Aufmachen kann man später — der umgekehrte Weg ist teurer.

---

**8. Wann fängst du an — und wann hörst du auf?**

Bis zur AP2 sind es **109 Tage**. Abschnitte 1+2 sind ein Wochenende und liefern die App. Abschnitte 3–8 sind gute Verbesserungen, aber keine davon bringt dir einen Punkt in der Prüfung.

→ **Empfehlung: Abschnitte 1 und 2 an einem Wochenende, dann zwei Wochen nur damit lernen.** Danach entscheiden, was du tatsächlich vermisst hast — und nur das bauen. Das ist die einzige Reihenfolge, bei der die App dem Lernen dient und nicht umgekehrt.

---

*Sobald du die Punkte oben durch hast, kann Abschnitt 1 gebaut werden.*
