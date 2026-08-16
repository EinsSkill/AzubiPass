/* AzubiPass · Eigene Probeklausur
   ---------------------------------------------------------------------------
   Der Nutzer wählt die Kapitel seiner nächsten Klassenarbeit, AzubiPass stellt
   daraus örtlich eine Probeklausur zusammen. Keine amtliche IHK-Simulation,
   keine KI: Der „Generator" ist ein regelbasierter Zusammensteller.

   Warum eine eigene Datei und kein Anbau an app.js: Das hier ist ein
   geschlossener Gegenstand — Rechner, Zusammensteller, Renderer, Bewertung und
   Oberfläche einer Prüfung. In app.js stünde es als Fremdkörper, der die fünf
   Schirme dort auf das Doppelte bringt.

   Alles hängt an window.APK. app.js ruft genau eine Sache auf: APK.zeige().    */

window.APK = (function () {
  "use strict";

  var AP = window.AP;
  var el = AP.el, mkEl = AP.mkEl;

  var SCHLUESSEL = "azubipass:probeklausur:v1";
  var FASSUNG = 1;

  var DAUERN = [30, 45, 60, 90];
  var DAUER_STANDARD = 60;
  var EIGEN_MIN = 15, EIGEN_MAX = 180, EIGEN_SCHRITT = 5;

  var vorrat = null;          // mittel/aufgaben.json
  var laedt = null;
  var ersterBlick = true;     // siehe laeuft()

  /* ================================================== Kleinkram */

  function zahlText(n) {
    return Number(n).toLocaleString("de-DE",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* Punkte sehen ohne Nachkommastelle ruhiger aus — halbe gibt es aber, sobald
     ein Buchungssatz nur zur Hälfte stimmt. Also nur zeigen, was da ist. */
  function punkteText(n) {
    var g = Math.round(n * 10) / 10;
    return (Number.isInteger(g) ? String(g) : g.toFixed(1).replace(".", ","));
  }

  /* Klausurdauern nennt man in Minuten — „90 Min." liest sich in einer Prüfung
     richtiger als „1,5 Std.". */
  function minutenText(m) {
    return m + " Min.";
  }

  /* Eine getippte Zahl lesen.

     Am deutschen Handy kommt „1.234,56", auf einer Rechnertastatur „1234.56".
     Beide müssen gehen. Steht nur ein Punkt drin, ist er mehrdeutig: „1.500"
     meint im Rechnungswesen tausendfünfhundert, „1.5" anderthalb. Entschieden
     wird an der Gruppenlänge — drei Ziffern hinter dem letzten Punkt und
     Ziffern davor heißt Tausendertrennung. */
  function zahlLesen(roh) {
    var s = String(roh == null ? "" : roh).trim()
      .replace(/\s/g, "").replace(/€/g, "");
    if (!s) return null;
    if (s.indexOf(",") !== -1) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      var teile = s.split(".");
      if (teile.length > 2 || (teile.length === 2 && teile[1].length === 3 && teile[0].length)) {
        s = teile.join("");
      }
    }
    if (!/^-?\d*\.?\d*$/.test(s)) return null;
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  function knopf(klasse, text, beiKlick) {
    var b = el("button", klasse, text);
    b.type = "button";
    if (beiKlick) b.addEventListener("click", beiKlick);
    return b;
  }

  /* ================================================== Formelrechner

     Die Aufgaben rechnen: „ak - kumuliert", „runde(ak / nutzungsdauer, 2)",
     „saldo > 5000". Das mit new Function auszuwerten wäre drei Zeilen kurz und
     eine offene Tür: Was in einer Aufgabendatei steht, liefe dann als
     JavaScript im Browser des Nutzers.

     Deshalb ein eigener, winziger Rechner. Er kennt Zahlen, die Variablen der
     Aufgabe, sieben Rechenzeichen, Vergleiche und sechs Funktionen — sonst
     nichts. Alles andere ist ein Fehler, und zwar ein lauter.

     abrunden und aufrunden gibt es, weil manche Ergebnisse nur als ganze Zahl
     einen Sinn ergeben: Eine Break-Even-Menge von 342,86 Stück kann niemand
     verkaufen.                                                                 */

  var FUNKTIONEN = {
    runde: function (x, n) {
      var f = Math.pow(10, n === undefined ? 0 : n);
      return Math.round((x + Number.EPSILON) * f) / f;
    },
    abrunden: Math.floor,
    aufrunden: Math.ceil,
    min: Math.min,
    max: Math.max,
    abs: Math.abs
  };

  var MARKEN = /\s*(\d+\.?\d*|[A-Za-z_][A-Za-z0-9_]*|>=|<=|==|!=|&&|\|\||[-+*/(),<>])/g;

  function zerlegen(quelle) {
    var marken = [], pos = 0, m;
    MARKEN.lastIndex = 0;
    while ((m = MARKEN.exec(quelle)) !== null) {
      if (m.index !== pos) break;
      marken.push(m[1]);
      pos = MARKEN.lastIndex;
    }
    if (pos !== quelle.length) {
      throw new Error("Unverständlicher Ausdruck ab Zeichen " + (pos + 1) + ": " + quelle);
    }
    return marken;
  }

  function rechne(ausdruck, werte) {
    var marken = zerlegen(String(ausdruck)), i = 0;

    function schau() { return marken[i]; }
    function nimm(erwartet) {
      var t = marken[i++];
      if (erwartet && t !== erwartet) {
        throw new Error("„" + erwartet + "“ erwartet, „" + t + "“ gefunden");
      }
      return t;
    }

    function oder() {
      var l = und();
      while (schau() === "||") { nimm(); l = (und() || l); }
      return l;
    }
    function und() {
      var l = vergleich();
      while (schau() === "&&") { nimm(); var r = vergleich(); l = (l && r); }
      return l;
    }
    function vergleich() {
      var l = summe();
      var op = schau();
      if (op === ">" || op === "<" || op === ">=" || op === "<=" ||
          op === "==" || op === "!=") {
        nimm();
        var r = summe();
        if (op === ">") return l > r;
        if (op === "<") return l < r;
        if (op === ">=") return l >= r;
        if (op === "<=") return l <= r;
        if (op === "==") return Math.abs(l - r) < 1e-9;
        return Math.abs(l - r) >= 1e-9;
      }
      return l;
    }
    function summe() {
      var l = produkt();
      while (schau() === "+" || schau() === "-") {
        var op = nimm();
        var r = produkt();
        l = op === "+" ? l + r : l - r;
      }
      return l;
    }
    function produkt() {
      var l = vorzeichen();
      while (schau() === "*" || schau() === "/") {
        var op = nimm();
        var r = vorzeichen();
        if (op === "/" && r === 0) throw new Error("Teilung durch null: " + ausdruck);
        l = op === "*" ? l * r : l / r;
      }
      return l;
    }
    function vorzeichen() {
      if (schau() === "-") { nimm(); return -vorzeichen(); }
      if (schau() === "+") { nimm(); return vorzeichen(); }
      return wert();
    }
    function wert() {
      var t = schau();
      if (t === undefined) throw new Error("Ausdruck bricht ab: " + ausdruck);
      if (t === "(") { nimm(); var w = oder(); nimm(")"); return w; }
      if (/^\d/.test(t)) { nimm(); return parseFloat(t); }
      if (/^[A-Za-z_]/.test(t)) {
        nimm();
        if (schau() === "(") {
          if (!Object.prototype.hasOwnProperty.call(FUNKTIONEN, t)) {
            throw new Error("Unbekannte Funktion: " + t);
          }
          nimm("(");
          var args = [];
          if (schau() !== ")") {
            args.push(oder());
            while (schau() === ",") { nimm(); args.push(oder()); }
          }
          nimm(")");
          return FUNKTIONEN[t].apply(null, args);
        }
        if (!werte || !Object.prototype.hasOwnProperty.call(werte, t)) {
          throw new Error("Unbekannte Größe: " + t);
        }
        return werte[t];
      }
      throw new Error("Unerwartetes Zeichen „" + t + "“ in: " + ausdruck);
    }

    var ergebnis = oder();
    if (i !== marken.length) throw new Error("Rest nach dem Ausdruck: " + ausdruck);
    return ergebnis;
  }

  /* ================================================== Zufall mit Gedächtnis

     Ein Seed, eine Klausur. Ohne das wäre „dieselbe Klausur noch einmal" nicht
     möglich und ein Neuladen mitten in der Bearbeitung würde alle Zahlen
     austauschen.                                                              */

  function saat(text) {
    var h = 2166136261;
    text = String(text);
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function wuerfel(seed) {
    var a = saat(seed) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function neuerSeed() {
    return Date.now().toString(36) + "-" +
      Math.floor(Math.random() * 1679616).toString(36);
  }

  /* ================================================== Werte ziehen */

  var VERSUCHE = 240;

  function werteZiehen(b, seed) {
    if (!b.variablen) return {};
    for (var runde = 0; runde < VERSUCHE; runde++) {
      var w = {}, r = wuerfel(seed + "#" + b.id + "#" + runde), name;
      for (name in b.variablen) {
        if (!Object.prototype.hasOwnProperty.call(b.variablen, name)) continue;
        var v = b.variablen[name];
        if (typeof v === "number") { w[name] = v; continue; }
        if (v.fest !== undefined) { w[name] = v.fest; continue; }
        var schritt = v.schritt || 1;
        var stufen = Math.floor((v.bis - v.von) / schritt) + 1;
        w[name] = v.von + Math.floor(r() * stufen) * schritt;
        // Gleitkommareste bei Schrittweiten wie 0,5 wegputzen
        w[name] = Math.round(w[name] * 1e6) / 1e6;
      }
      for (name in (b.abgeleitet || {})) {
        if (!Object.prototype.hasOwnProperty.call(b.abgeleitet, name)) continue;
        w[name] = rechne(b.abgeleitet[name], w);
      }
      if (!b.pruefung_variablen || rechne(b.pruefung_variablen, w) === true) {
        return w;
      }
    }
    throw new Error("Baustein " + b.id + ": pruefung_variablen ist in " +
                    VERSUCHE + " Ziehungen nie erfüllt worden.");
  }

  /* ================================================== Kontenplan

     Die Aufgabendateien nennen Konten mal als Nummer („2800"), mal als
     Bezeichnung („Bank"). Beides muss auf dasselbe Konto zeigen — und zwar
     innen. Angezeigt wird immer die Bezeichnung; die Nummer steht daneben,
     weil Buchungssätze im Unterricht über Nummern laufen.                     */

  var kontenIndex = null;

  function schluessel(s) {
    return String(s || "").toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]/g, "");
  }

  function kontenAufbauen() {
    kontenIndex = { nach: {}, liste: [] };
    (vorrat && vorrat.kontenplan ? vorrat.kontenplan : []).forEach(function (k) {
      var eintrag = { nr: k.nr, name: k.name, klasse: k.klasse, alias: k.alias || [] };
      kontenIndex.liste.push(eintrag);
      kontenIndex.nach[k.nr] = eintrag;
      kontenIndex.nach[schluessel(k.name)] = eintrag;
      (k.alias || []).forEach(function (a) { kontenIndex.nach[schluessel(a)] = eintrag; });
    });
  }

  function konto(bezeichner) {
    if (!kontenIndex) kontenAufbauen();
    if (bezeichner == null || bezeichner === "") return null;
    var roh = String(bezeichner).trim();
    // „2800 — Guthaben bei Kreditinstituten" aus der Vervollständigung
    var vorn = roh.match(/^(\d{3,5})\b/);
    if (vorn && kontenIndex.nach[vorn[1]]) return kontenIndex.nach[vorn[1]];
    return kontenIndex.nach[roh] || kontenIndex.nach[schluessel(roh)] || null;
  }

  function kontoName(bezeichner) {
    var k = konto(bezeichner);
    return k ? k.name : String(bezeichner || "");
  }

  function alleKonten() {
    if (!kontenIndex) kontenAufbauen();
    return kontenIndex.liste;
  }

  /* ================================================== Zusammensteller

     Regelbasiert, nicht zufällig. Die Reihenfolge der Regeln ist die
     Reihenfolge, in der eine Lehrkraft eine Arbeit zusammenstellt: erst jedes
     Thema einmal, dann auffüllen, dabei Aufgabenarten und Niveaus mischen und
     die Zeit im Blick behalten.                                               */

  function kapitelSchluessel(b) { return b.lernfeld + ":" + b.kapitel; }

  function typen(b) {
    var raus = [];
    (b.eingabe || []).forEach(function (e) {
      if (raus.indexOf(e.block) === -1) raus.push(e.block);
    });
    return raus;
  }

  function bausteineZu(kapitel) {
    var gewaehlt = {};
    kapitel.forEach(function (k) { gewaehlt[k] = true; });
    return (vorrat ? vorrat.bausteine : []).filter(function (b) {
      return gewaehlt[kapitelSchluessel(b)];
    });
  }

  /* Wie lange dauert eine Klausur mindestens, wenn jedes gewählte Kapitel
     vorkommen soll? Die kürzeste Aufgabe je Kapitel, aufsummiert. Darunter
     lässt sich die Auswahl nicht ehrlich abdecken — und dann wird das gesagt
     statt still ein Kapitel weggelassen. */
  function mindestdauer(kapitel) {
    var summe = 0;
    kapitel.forEach(function (k) {
      var kandidaten = bausteineZu([k]);
      if (!kandidaten.length) return;
      summe += Math.min.apply(null, kandidaten.map(function (b) { return b.dauer_min; }));
    });
    return summe;
  }

  function stelleZusammen(wahl) {
    var kapitel = (wahl.kapitel || []).slice();
    var dauer = wahl.dauer || DAUER_STANDARD;
    var seed = wahl.seed || neuerSeed();
    var vorher = {};
    (wahl.vorher || []).forEach(function (id) { vorher[id] = true; });

    var kandidaten = bausteineZu(kapitel);
    if (!kapitel.length || !kandidaten.length) {
      return { fehler: "leer", kapitel: kapitel, seed: seed, dauer: dauer, aufgaben: [] };
    }

    var noetig = mindestdauer(kapitel);
    if (noetig > dauer) {
      return { fehler: "zu_kurz", mindestdauer: noetig, kapitel: kapitel,
               seed: seed, dauer: dauer, aufgaben: [] };
    }

    var r = wuerfel(seed + "|auswahl");
    // Ein fester Rauschwert je Baustein: gleicher Seed, gleiche Reihenfolge —
    // aber nicht immer die ersten Aufgaben einer Datei.
    var rauschen = {};
    kandidaten.forEach(function (b) { rauschen[b.id] = r(); });

    var gewaehlt = [], benutzt = {};
    var typZahl = {}, afbZahl = {}, kapZahl = {};
    var verbraucht = 0;

    function bewerte(b, restzeit, nurAbdeckung) {
      if (benutzt[b.id]) return -Infinity;
      if (b.dauer_min > restzeit) return -Infinity;
      var s = 0;
      typen(b).forEach(function (t) { s += typZahl[t] ? -2.2 : 2.4; });
      s -= (afbZahl[b.anforderungsbereich] || 0) * 1.6;
      if (!nurAbdeckung) s -= (kapZahl[kapitelSchluessel(b)] || 0) * 1.3;
      if (vorher[b.id]) s -= 2.6;
      // Zeit ausnutzen, aber schwach gewichtet: Sonst gewinnen immer die
      // langen offenen Aufgaben, und die Klausur besteht aus Aufsätzen.
      s += (b.dauer_min / Math.max(restzeit, 1)) * 0.4;
      return s + rauschen[b.id] * 0.8;
    }

    function nimm(b) {
      gewaehlt.push(b);
      benutzt[b.id] = true;
      verbraucht += b.dauer_min;
      typen(b).forEach(function (t) { typZahl[t] = (typZahl[t] || 0) + 1; });
      afbZahl[b.anforderungsbereich] = (afbZahl[b.anforderungsbereich] || 0) + 1;
      var k = kapitelSchluessel(b);
      kapZahl[k] = (kapZahl[k] || 0) + 1;
    }

    function besterAus(menge, nurAbdeckung) {
      var best = null, bestwert = -Infinity;
      menge.forEach(function (b) {
        var w = bewerte(b, dauer - verbraucht, nurAbdeckung);
        if (w > bestwert) { bestwert = w; best = b; }
      });
      return bestwert === -Infinity ? null : best;
    }

    // Schritt 1 — jedes gewählte Kapitel einmal, in gewürfelter, aber
    // reproduzierbarer Reihenfolge. Sonst käme K1 immer zuerst dran und
    // bekäme bei knapper Zeit systematisch die besten Plätze.
    var reihenfolge = kapitel.slice().sort(function (a, b) {
      return wuerfel(seed + "|k|" + a)() - wuerfel(seed + "|k|" + b)();
    });
    /* Wer zuerst drankommt, darf nicht die ganze Zeit aufbrauchen: Für jedes
       noch nicht abgedeckte Kapitel bleibt seine kürzeste Aufgabe reserviert.
       Sonst nimmt K1 eine Sieben-Minuten-Aufgabe und für K9 ist nichts mehr da
       — genau die stille Auslassung, die es nicht geben soll. */
    reihenfolge.forEach(function (k, pos) {
      var reserve = 0;
      reihenfolge.slice(pos + 1).forEach(function (rest) {
        reserve += mindestdauer([rest]);
      });
      var frei = dauer - verbraucht - reserve;
      var b = null, bestwert = -Infinity;
      bausteineZu([k]).forEach(function (kandidat) {
        var wert = bewerte(kandidat, frei, true);
        if (wert > bestwert) { bestwert = wert; b = kandidat; }
      });
      if (bestwert > -Infinity && b) nimm(b);
    });

    // Schritt 2 — auffüllen, solange etwas passt
    for (var n = 0; n < 60; n++) {
      var b2 = besterAus(kandidaten, false);
      if (!b2) break;
      nimm(b2);
    }

    // Schritt 3 — Reihenfolge im Bogen: nach Kapitel, darin nach
    // Anforderungsbereich. Eine Klausur springt nicht zwischen Themen.
    var kapPos = {};
    (vorrat.kapitel || []).forEach(function (k, i) { kapPos[k.schluessel] = i; });
    gewaehlt.sort(function (a, b) {
      var d = (kapPos[kapitelSchluessel(a)] || 0) - (kapPos[kapitelSchluessel(b)] || 0);
      if (d) return d;
      d = a.anforderungsbereich - b.anforderungsbereich;
      return d || (a.id < b.id ? -1 : 1);
    });

    return {
      seed: seed, dauer: dauer, kapitel: kapitel,
      aufgaben: gewaehlt.map(function (b) { return b.id; }),
      minuten: verbraucht,
      punkte: gewaehlt.reduce(function (s, b) { return s + b.punkte; }, 0),
      abgedeckt: Object.keys(kapZahl).length
    };
  }

  function baustein(id) {
    if (!vorrat) return null;
    if (!vorrat._nachId) {
      vorrat._nachId = {};
      vorrat.bausteine.forEach(function (b) { vorrat._nachId[b.id] = b; });
    }
    return vorrat._nachId[id] || null;
  }

  /* ================================================== Klausurzustand

     Getrennt von azubipass:konto. Der Lernstand eines Jahres darf nicht daran
     hängen, dass eine Probeklausur sauber endet — und umgekehrt soll eine
     halbe Klausur den Lernstand nicht aufblähen.                              */

  var zustand = null;

  function frischerZustand() {
    return { v: FASSUNG, seed: null, kapitel: [], dauer: DAUER_STANDARD,
             ende: null, gestartet: false, abgegeben: false, aufgaben: [],
             werte: {}, antworten: {}, markiert: [], aktuell: 0, selbst: {},
             vorher: [], abgelaufen: false };
  }

  /* Defensiv laden: Was hier liegt, kann aus einer älteren Fassung stammen,
     von Hand verstellt oder halb geschrieben sein. Nichts davon darf die App
     zerlegen — im Zweifel gibt es eben keine laufende Klausur. */
  function zustandLaden() {
    var roh;
    try { roh = localStorage.getItem(SCHLUESSEL); } catch (e) { return null; }
    if (!roh) return null;
    var z;
    try { z = JSON.parse(roh); } catch (e) { return null; }
    if (!z || typeof z !== "object" || z.v !== FASSUNG) return null;
    if (!Array.isArray(z.aufgaben) || !z.aufgaben.length) return null;
    var frisch = frischerZustand();
    Object.keys(frisch).forEach(function (f) {
      if (z[f] === undefined || (Array.isArray(frisch[f]) && !Array.isArray(z[f]))) {
        z[f] = frisch[f];
      }
    });
    /* Aufgaben, die es nicht mehr gibt, still fallen lassen statt abstürzen —
       aber nur, wenn der Vorrat überhaupt schon geladen ist. Sonst gäbe es vor
       dem ersten fetch keine einzige gültige Aufgabe und jede laufende Klausur
       sähe verloren aus. */
    if (vorrat) {
      z.aufgaben = z.aufgaben.filter(function (id) { return !!baustein(id); });
      if (!z.aufgaben.length) return null;
    }
    if (z.aktuell >= z.aufgaben.length) z.aktuell = 0;
    return z;
  }

  function zustandSichern() {
    if (!zustand) return;
    try { localStorage.setItem(SCHLUESSEL, JSON.stringify(zustand)); }
    catch (e) { /* Speicher voll oder gesperrt — die Klausur läuft trotzdem */ }
  }

  /* Nur den Klausurschlüssel entfernen. localStorage.clear() würde den
     Lernstand eines Jahres mitnehmen. */
  function zustandVerwerfen() {
    try { localStorage.removeItem(SCHLUESSEL); } catch (e) {}
    zustand = null;
  }

  /* ================================================== Bewertung */

  function blockPunkte(b, e) {
    if (typeof e.punkte === "number") return e.punkte;
    return b.punkte;
  }

  function antwortVon(b, i) {
    var a = zustand.antworten[b.id];
    return a ? a[i] : undefined;
  }

  function werteVon(b) { return zustand.werte[b.id] || {}; }

  /* Sollwert eines Zahlenfelds: entweder eine Größe der Aufgabe oder eine
     feste Zahl in der Lösung. */
  function sollwert(e, w) {
    if (typeof e.loesung === "number") return e.loesung;
    if (Object.prototype.hasOwnProperty.call(w, e.loesung)) return w[e.loesung];
    return rechne(e.loesung, w);
  }

  function bewerteZahl(b, e, i) {
    var w = werteVon(b);
    var soll = sollwert(e, w);
    var ist = zahlLesen(antwortVon(b, i));
    var p = blockPunkte(b, e);
    var tol = e.toleranz != null ? e.toleranz : 0.01;
    if (ist == null) return { punkte: 0, soll: soll, folgefehler: false };
    if (Math.abs(ist - soll) <= tol) return { punkte: p, soll: soll, folgefehler: false };

    /* Folgefehler: Wer sich oben verrechnet, unten aber mit dem eigenen Wert
       korrekt weiterrechnet, bekommt den Schritt. Ohne diese Regel wird jede
       mehrstufige Rechenaufgabe unfair. */
    if (e.folgefehler_aus && e.folgefehler_aus.length) {
      var eigene = {}, ersetzt = {};
      Object.keys(w).forEach(function (k) { eigene[k] = w[k]; });
      var vollstaendig = true;
      e.folgefehler_aus.forEach(function (name) {
        var pos = -1;
        b.eingabe.forEach(function (x, xi) {
          if (x.block === "zahl" && x.loesung === name) pos = xi;
        });
        var v = pos >= 0 ? zahlLesen(antwortVon(b, pos)) : null;
        if (v == null) vollstaendig = false;
        else { eigene[name] = v; ersetzt[name] = true; }
      });
      /* Die Zwischenwerte einsetzen genügt nicht — alles, was auf ihnen
         aufbaut, muss mit ihnen neu gerechnet werden. Sonst stünde in eigene
         weiterhin das richtige Endergebnis und die Regel liefe ins Leere. */
      Object.keys(b.abgeleitet || {}).forEach(function (name) {
        if (ersetzt[name]) return;
        try { eigene[name] = rechne(b.abgeleitet[name], eigene); } catch (err) {}
      });
      if (vollstaendig) {
        var erwartet;
        try { erwartet = sollwert(e, eigene); } catch (err) { erwartet = null; }
        if (erwartet != null && Math.abs(ist - erwartet) <= tol) {
          return { punkte: p, soll: soll, folgefehler: true };
        }
      }
    }
    return { punkte: 0, soll: soll, folgefehler: false };
  }

  /* Mehrfachauswahl: je richtig Angekreuztem ein Anteil, je falsch
     Angekreuztem derselbe Anteil wieder ab, nie unter null. Eine Regel, überall
     dieselbe — „alles oder nichts" bestraft eine von vier Lücken wie gar nichts
     gewusst zu haben. */
  function bewerteAuswahl(b, e, i) {
    var p = blockPunkte(b, e);
    var a = antwortVon(b, i);
    if (!e.mehrfach) {
      var richtig = e.optionen.findIndex(function (o) { return !!o.richtig; });
      return { punkte: a === richtig ? p : 0, richtige: [richtig] };
    }
    var richtige = [];
    e.optionen.forEach(function (o, oi) { if (o.richtig) richtige.push(oi); });
    var gewaehlt = Array.isArray(a) ? a : [];
    var treffer = gewaehlt.filter(function (x) { return richtige.indexOf(x) !== -1; }).length;
    var daneben = gewaehlt.length - treffer;
    var anteil = richtige.length ? p / richtige.length : 0;
    return { punkte: Math.max(0, (treffer - daneben) * anteil), richtige: richtige };
  }

  function bewerteZuordnung(b, e, i) {
    var a = antwortVon(b, i) || {};
    var jeTreffer = b.bewertung.punkte_je_treffer;
    var treffer = 0;
    e.elemente.forEach(function (x, xi) { if (a[xi] === x.loesung) treffer++; });
    var p = jeTreffer != null ? treffer * jeTreffer
          : (e.elemente.length ? blockPunkte(b, e) * treffer / e.elemente.length : 0);
    return { punkte: p, treffer: treffer };
  }

  function bewerteReihenfolge(b, e, i) {
    var a = antwortVon(b, i);
    var jeTreffer = b.bewertung.punkte_je_treffer;
    var treffer = 0;
    if (Array.isArray(a)) {
      a.forEach(function (xi, platz) {
        if (e.elemente[xi] && e.elemente[xi].position === platz + 1) treffer++;
      });
    }
    var p = jeTreffer != null ? treffer * jeTreffer
          : (e.elemente.length ? blockPunkte(b, e) * treffer / e.elemente.length : 0);
    return { punkte: p, treffer: treffer };
  }

  /* Buchungssatz: Zeilen sind gleichwertig.

     Wer „Bank an Forderungen" in umgekehrter Zeilenfolge einträgt, hat den
     Satz trotzdem gebildet. Deshalb wird nicht Zeile gegen Zeile geprüft,
     sondern jede Lösungszeile bekommt die am besten passende, noch freie
     Eingabezeile. Punkte gibt es je Bestandteil: Seite plus Konto, und der
     Betrag.                                                                    */
  function bewerteBuchungssatz(b, e, i) {
    var w = werteVon(b);
    var eingaben = antwortVon(b, i) || [];
    var loesung = e.loesung || [];
    var jeZeile = b.bewertung.punkte_je_zeile;
    var proZeile = jeZeile != null ? jeZeile
                 : (loesung.length ? blockPunkte(b, e) / loesung.length : 0);

    function betragSoll(z) {
      if (z.betrag == null) return null;
      if (typeof z.betrag === "number") return z.betrag;
      return Object.prototype.hasOwnProperty.call(w, z.betrag)
        ? w[z.betrag] : rechne(z.betrag, w);
    }

    function passung(soll, ist) {
      if (!ist) return 0;
      var seite = soll.soll != null ? "soll" : "haben";
      var kSoll = konto(soll[seite]);
      var kIst = konto(ist.konto);
      var kontoOk = ist.seite === seite && kSoll && kIst && kSoll.nr === kIst.nr ? 1 : 0;
      var b1 = betragSoll(soll);
      var b2 = zahlLesen(ist.betrag);
      var betragOk = (b1 != null && b2 != null && Math.abs(b1 - b2) <= 0.01) ? 1 : 0;
      return kontoOk + betragOk;
    }

    var frei = eingaben.map(function (_, n) { return n; });
    var punkte = 0, zeilen = [];
    loesung.forEach(function (z) {
      var bestPos = -1, bestWert = 0;
      frei.forEach(function (n) {
        var v = passung(z, eingaben[n]);
        if (v > bestWert) { bestWert = v; bestPos = n; }
      });
      if (bestPos >= 0) frei.splice(frei.indexOf(bestPos), 1);
      punkte += proZeile * bestWert / 2;
      var seite = z.soll != null ? "soll" : "haben";
      zeilen.push({ seite: seite, konto: konto(z[seite]), betrag: betragSoll(z),
                    erreicht: bestWert });
    });
    return { punkte: punkte, zeilen: zeilen };
  }

  /* Offene Antworten bewertet der Nutzer selbst — aber nicht nach Gefühl.
     Er hakt einzelne Kriterien ab, und nur die zählen. Nicht angesehen heißt
     null Punkte, nicht „wird schon gestimmt haben". */
  function bewerteSelbst(b) {
    var haken = zustand.selbst[b.id] || [];
    var raster = (b.bewertung.raster || []);
    var p = 0;
    var angehakt = 0;
    raster.forEach(function (k, ki) { if (haken[ki]) { p += k.punkte; angehakt++; } });
    return { punkte: p, offen: angehakt === 0 };
  }

  function bewerteBaustein(b) {
    if (b.bewertung.art === "selbstbewertung") {
      var s = bewerteSelbst(b);
      return { punkte: s.punkte, moeglich: b.punkte, selbst: true, offen: s.offen };
    }
    var summe = 0;
    b.eingabe.forEach(function (e, i) {
      if (e.block === "zahl") summe += bewerteZahl(b, e, i).punkte;
      else if (e.block === "auswahl") summe += bewerteAuswahl(b, e, i).punkte;
      else if (e.block === "zuordnung") summe += bewerteZuordnung(b, e, i).punkte;
      else if (e.block === "reihenfolge") summe += bewerteReihenfolge(b, e, i).punkte;
      else if (e.block === "buchungssatz") summe += bewerteBuchungssatz(b, e, i).punkte;
    });
    return { punkte: Math.min(summe, b.punkte), moeglich: b.punkte, selbst: false };
  }

  function ergebnis() {
    var jeKapitel = {}, erreicht = 0, moeglich = 0, offen = 0;
    zustand.aufgaben.forEach(function (id) {
      var b = baustein(id);
      if (!b) return;
      var e = bewerteBaustein(b);
      erreicht += e.punkte;
      moeglich += e.moeglich;
      if (e.selbst && e.offen) offen++;
      var k = kapitelSchluessel(b);
      if (!jeKapitel[k]) jeKapitel[k] = { erreicht: 0, moeglich: 0, schluessel: k };
      jeKapitel[k].erreicht += e.punkte;
      jeKapitel[k].moeglich += e.moeglich;
    });
    return {
      erreicht: erreicht, moeglich: moeglich, offen: offen,
      prozent: moeglich ? Math.round(erreicht / moeglich * 1000) / 10 : 0,
      kapitel: Object.keys(jeKapitel).map(function (k) { return jeKapitel[k]; })
    };
  }

  /* ================================================== Belege

     Die Vorlage ist eigener HTML-Code aus quellen/belege/ und darf deshalb als
     HTML eingesetzt werden. Die eingefüllten Werte dürfen es nicht — sie
     stammen aus den Aufgabendaten. Also wird jeder Wert vor dem Einsetzen
     entschärft.                                                                */

  function entschaerfen(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* Ein Wert kann selbst noch einen Platzhalter enthalten — „{netto}" aus den
     Vorgaben wird erst hier zur gewürfelten Zahl. */
  function fuellen(text, w) {
    return String(text == null ? "" : text).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
      function (ganz, name) {
        if (w && Object.prototype.hasOwnProperty.call(w, name)) {
          return typeof w[name] === "number" ? zahlText(w[name]) : String(w[name]);
        }
        return ganz;
      });
  }

  function belegHtml(anlage, w) {
    var vorlage = vorrat.belege[anlage.beleg];
    var gefuellt = anlage.beleg_gefuellt || { werte: {}, zeilen: [] };
    if (!vorlage) return null;
    var werte = {}, k;
    for (k in gefuellt.werte) werte[k] = fuellen(gefuellt.werte[k], w);
    var zeilen = (gefuellt.zeilen || []).map(function (z) {
      var neu = {};
      for (var f in z) neu[f] = fuellen(z[f], w);
      return neu;
    });

    if (vorlage.saldo_fortschreiben) {
      var alt = zahlLesen(werte.saldo_alt) || 0;
      zeilen.forEach(function (z) {
        alt += (zahlLesen(z.haben) || 0) - (zahlLesen(z.soll) || 0);
      });
      werte.saldo_neu = zahlText(alt);
      werte.saldo_alt = zahlText(zahlLesen(werte.saldo_alt) || 0);
    }

    var marke = vorlage.marke;
    var html = vorlage.html;
    if (marke) {
      var muster = new RegExp("<!--\\s*" + marke + ":start\\s*-->([\\s\\S]*?)<!--\\s*" +
                              marke + ":ende\\s*-->");
      var treffer = html.match(muster);
      if (treffer) {
        var block = treffer[1];
        html = html.replace(muster, zeilen.map(function (z) {
          return block.replace(/\{([a-z0-9_]+)\.([a-z0-9_]+)\}/gi, function (ganz, m, feld) {
            return m === marke ? entschaerfen(z[feld] == null ? "" : z[feld]) : ganz;
          });
        }).join(""));
      }
    }
    return html.replace(/\{([a-z0-9_]+)\}/gi, function (ganz, name) {
      return Object.prototype.hasOwnProperty.call(werte, name)
        ? entschaerfen(werte[name]) : "";
    });
  }

  /* ================================================== Anzeige einer Aufgabe

     Klausurmodus, und nur der. Keine Farbe für richtig oder falsch, kein Echo,
     keine Erklärung, keine mitlaufende Summe. Verweise werden auf das reine
     Wort reduziert — AP.mk macht genau das.                                    */

  function anzeigeBlock(a, w) {
    if (a.block === "text") {
      return mkEl("p", "pk--text", fuellen(a.inhalt, w));
    }
    if (a.block === "tabelle") {
      return tabelle(a, w);
    }
    if (a.block === "anlage") {
      var d = el("details", "pk--anlage");
      if (!a.zugeklappt) d.open = true;
      var s = el("summary", null, a.titel || "Anlage");
      d.appendChild(s);
      var innen = el("div", "pk--anlage-inhalt");
      if (a.beleg) {
        var html = belegHtml(a, w);
        if (html) {
          var huelle = el("div", "pk--beleg-rahmen");
          huelle.innerHTML = html;
          innen.appendChild(huelle);
        } else {
          innen.appendChild(el("p", "pk--fehlt", "Beleg „" + a.beleg + "“ fehlt."));
        }
      } else if (a.inhalt && a.inhalt.block === "tabelle") {
        innen.appendChild(tabelle(a.inhalt, w));
      } else if (a.inhalt) {
        innen.appendChild(mkEl("p", null, fuellen(a.inhalt, w)));
      }
      d.appendChild(innen);
      return d;
    }
    return null;
  }

  function tabelle(t, w) {
    var rahmen = el("div", "pk--tabellenrahmen");
    var tb = el("table", "pk--tabelle");
    var kopf = el("tr");
    (t.spalten || []).forEach(function (s, i) {
      var th = el("th", i > 0 ? "pk--rechts" : null, s);
      th.scope = "col";
      kopf.appendChild(th);
    });
    var thead = el("thead"); thead.appendChild(kopf); tb.appendChild(thead);
    var body = el("tbody");
    (t.zeilen || []).forEach(function (z) {
      var tr = el("tr");
      z.forEach(function (c, i) {
        tr.appendChild(mkEl("td", i > 0 ? "pk--zahl" : null, fuellen(c, w)));
      });
      body.appendChild(tr);
    });
    tb.appendChild(body);
    rahmen.appendChild(tb);
    return rahmen;
  }

  function antwortSetzen(b, i, wert) {
    if (!zustand.antworten[b.id]) zustand.antworten[b.id] = {};
    zustand.antworten[b.id][i] = wert;
    zustandSichern();
  }

  function eingabeBlock(b, e, i) {
    if (e.block === "zahl") return feldZahl(b, e, i);
    if (e.block === "auswahl") return feldAuswahl(b, e, i);
    if (e.block === "zuordnung") return feldZuordnung(b, e, i);
    if (e.block === "reihenfolge") return feldReihenfolge(b, e, i);
    if (e.block === "buchungssatz") return feldBuchungssatz(b, e, i);
    if (e.block === "textfeld") return feldText(b, e, i);
    var p = el("p", "pk--fehlt", "Aufgabentyp „" + e.block + "“ wird noch nicht dargestellt.");
    return p;
  }

  var laufendeNr = 0;
  function kennung(vorsilbe) { return vorsilbe + "-" + (++laufendeNr); }

  function feldZahl(b, e, i) {
    var zeile = el("div", "pk--feldzeile");
    var id = kennung("pkz");
    var lab = el("label", "pk--feldname", e.label || "Ergebnis");
    lab.htmlFor = id;
    var eingabe = el("input", "pk--zahlfeld");
    eingabe.id = id;
    AP.kommafeld(eingabe);
    eingabe.value = antwortVon(b, i) || "";
    eingabe.addEventListener("input", function () {
      antwortSetzen(b, i, eingabe.value);
    });
    var einheit = el("span", "pk--einheit", (e.einheit || "") +
      (e.punkte != null ? " · " + punkteText(e.punkte) + " P." : ""));
    zeile.appendChild(lab);
    zeile.appendChild(eingabe);
    zeile.appendChild(einheit);
    return zeile;
  }

  function feldAuswahl(b, e, i) {
    var box = el("fieldset", "pk--auswahl");
    var lg = el("legend", "pk--frage");
    lg.innerHTML = AP.mk((e.frage || e.label || b.operator) +
      (e.mehrfach ? " (Mehrfachauswahl)" : ""));
    box.appendChild(lg);
    var name = kennung("pka");
    var gewaehlt = antwortVon(b, i);

    e.optionen.forEach(function (o, oi) {
      var id = name + "-" + oi;
      var lab = el("label", "pk--option");
      lab.htmlFor = id;
      var feld = el("input");
      feld.type = e.mehrfach ? "checkbox" : "radio";
      feld.name = name;
      feld.id = id;
      feld.value = String(oi);
      if (e.mehrfach) {
        feld.checked = Array.isArray(gewaehlt) && gewaehlt.indexOf(oi) !== -1;
      } else {
        feld.checked = gewaehlt === oi;
      }
      feld.addEventListener("change", function () {
        if (e.mehrfach) {
          var liste = Array.isArray(antwortVon(b, i)) ? antwortVon(b, i).slice() : [];
          var pos = liste.indexOf(oi);
          if (feld.checked && pos === -1) liste.push(oi);
          if (!feld.checked && pos !== -1) liste.splice(pos, 1);
          liste.sort(function (x, y) { return x - y; });
          antwortSetzen(b, i, liste);
        } else {
          antwortSetzen(b, i, oi);
        }
      });
      lab.appendChild(feld);
      lab.appendChild(mkEl("span", null, o.text));
      box.appendChild(lab);
    });
    return box;
  }

  /* Zuordnung ohne Ziehen.

     Antippen, Ziel antippen — das geht am Handy, mit der Maus und mit der
     Tastatur, weil alles Knöpfe sind. Ziehen wäre hübscher und am Handy
     zuverlässig schlechter. Der Zustand steht als Text im Ziel, nicht nur als
     Farbe.                                                                     */
  function feldZuordnung(b, e, i) {
    var box = el("div", "pk--zuordnung");
    if (e.lead) box.appendChild(mkEl("p", "pk--frage", e.lead));

    var gewaehltesEl = null;
    var stand = antwortVon(b, i) || {};
    var melder = el("p", "pk--status");
    melder.setAttribute("role", "status");
    melder.setAttribute("aria-live", "polite");

    var raster = el("div", "pk--zu-raster");
    var stapel = el("div", "pk--zu-stapel");
    var ziele = el("div", "pk--zu-ziele");
    raster.appendChild(stapel);
    raster.appendChild(ziele);

    function zeichnen() {
      stapel.innerHTML = "";
      stapel.appendChild(el("p", "pk--titelchen", "Zum Zuordnen antippen"));
      e.elemente.forEach(function (x, xi) {
        if (stand[xi] !== undefined) return;
        var b1 = el("button", "pk--zu-el");
        b1.type = "button";
        b1.innerHTML = AP.mk(x.text);
        b1.setAttribute("aria-pressed", gewaehltesEl === xi ? "true" : "false");
        if (gewaehltesEl === xi) b1.classList.add("gewaehlt");
        b1.addEventListener("click", function () {
          gewaehltesEl = gewaehltesEl === xi ? null : xi;
          melder.textContent = gewaehltesEl === null ? "Auswahl aufgehoben."
            : "Ausgewählt. Jetzt ein Ziel antippen.";
          zeichnen();
        });
        stapel.appendChild(b1);
      });
      if (!stapel.querySelector(".pk--zu-el")) {
        stapel.appendChild(el("p", "pk--leise", "Alle zugeordnet."));
      }

      ziele.innerHTML = "";
      e.ziele.forEach(function (z) {
        var kasten = el("div", "pk--zu-ziel");
        var kopf = el("button", "pk--zu-zielkopf", z);
        kopf.type = "button";
        kopf.setAttribute("aria-label", "Ziel " + z +
          (gewaehltesEl === null ? "" : " — hier ablegen"));
        kopf.addEventListener("click", function () {
          if (gewaehltesEl === null) { melder.textContent = "Erst ein Element antippen."; return; }
          stand[gewaehltesEl] = z;
          antwortSetzen(b, i, stand);
          melder.textContent = "Zugeordnet zu " + z + ".";
          gewaehltesEl = null;
          zeichnen();
        });
        kasten.appendChild(kopf);
        var drin = el("div", "pk--zu-drin");
        Object.keys(stand).forEach(function (xi) {
          if (stand[xi] !== z) return;
          var raus = el("button", "pk--zu-gesetzt");
          raus.type = "button";
          raus.innerHTML = AP.mk(e.elemente[xi].text);
          raus.appendChild(el("span", "pk--zu-weg", "zurücklegen"));
          raus.addEventListener("click", function () {
            delete stand[xi];
            antwortSetzen(b, i, stand);
            melder.textContent = "Zurückgelegt.";
            zeichnen();
          });
          drin.appendChild(raus);
        });
        if (!drin.children.length) drin.appendChild(el("p", "pk--leise", "leer"));
        kasten.appendChild(drin);
        ziele.appendChild(kasten);
      });
    }

    zeichnen();
    box.appendChild(raster);
    box.appendChild(melder);
    return box;
  }

  function feldReihenfolge(b, e, i) {
    var box = el("div", "pk--reihenfolge");
    if (e.lead) box.appendChild(mkEl("p", "pk--frage", e.lead));
    var stand = Array.isArray(antwortVon(b, i)) ? antwortVon(b, i).slice() : null;
    if (!stand || stand.length !== e.elemente.length) {
      stand = e.elemente.map(function (_, xi) { return xi; });
    }
    var liste = el("ol", "pk--rf-liste");
    var melder = el("p", "pk--status");
    melder.setAttribute("role", "status");
    melder.setAttribute("aria-live", "polite");

    function zeichnen(fokus) {
      liste.innerHTML = "";
      stand.forEach(function (xi, platz) {
        var li = el("li", "pk--rf-zeile");
        li.appendChild(mkEl("span", "pk--rf-text", e.elemente[xi].text));
        var steuer = el("span", "pk--rf-steuer");
        var hoch = knopf("pk--rf-knopf", "▲", function () { schieben(platz, -1); });
        var runter = knopf("pk--rf-knopf", "▼", function () { schieben(platz, 1); });
        hoch.setAttribute("aria-label", "„" + e.elemente[xi].text + "“ nach oben");
        runter.setAttribute("aria-label", "„" + e.elemente[xi].text + "“ nach unten");
        hoch.disabled = platz === 0;
        runter.disabled = platz === stand.length - 1;
        hoch.dataset.platz = platz;
        steuer.appendChild(hoch);
        steuer.appendChild(runter);
        li.appendChild(steuer);
        liste.appendChild(li);
      });
      if (fokus != null) {
        var ziel = liste.querySelectorAll(".pk--rf-zeile")[fokus];
        var k = ziel && ziel.querySelector(".pk--rf-knopf:not(:disabled)");
        if (k) k.focus({ preventScroll: true });
      }
    }

    function schieben(platz, richtung) {
      var neu = platz + richtung;
      if (neu < 0 || neu >= stand.length) return;
      var t = stand[platz]; stand[platz] = stand[neu]; stand[neu] = t;
      antwortSetzen(b, i, stand);
      melder.textContent = "Auf Platz " + (neu + 1) + " von " + stand.length + ".";
      zeichnen(neu);
    }

    antwortSetzen(b, i, stand);
    zeichnen(null);
    box.appendChild(liste);
    box.appendChild(melder);
    return box;
  }

  /* Buchungssatz.

     Eine Zeile ist: Seite, Konto, Betrag. Genau so steht sie auch in der
     Lösung, deshalb bleibt die Bewertung nachvollziehbar. Die Vervollständigung
     durchsucht den ganzen Kontenplan und bevorzugt nichts — sonst wäre sie eine
     versteckte Hilfe. */
  function feldBuchungssatz(b, e, i) {
    var box = el("div", "pk--buchungssatz");
    if (e.label) box.appendChild(el("p", "pk--titelchen", e.label));
    var zahlZeilen = e.zeilen || (e.loesung ? e.loesung.length : 2);
    var stand = Array.isArray(antwortVon(b, i)) ? antwortVon(b, i).slice() : [];
    // Keine Seite vorbelegt: Soll oder Haben ist Teil der Antwort, nicht der
    // Aufgabenstellung. Ein voreingestelltes „Soll" wäre eine halbe Lösung.
    while (stand.length < zahlZeilen) stand.push({ seite: "", konto: "", betrag: "" });

    var kopf = el("div", "pk--bs-kopf");
    ["Seite", "Konto", "Betrag in €"].forEach(function (t) {
      kopf.appendChild(el("span", null, t));
    });
    box.appendChild(kopf);

    stand.forEach(function (z, zi) {
      var zeile = el("div", "pk--bs-zeile");

      var seiten = el("div", "pk--bs-seite");
      seiten.setAttribute("role", "group");
      seiten.setAttribute("aria-label", "Zeile " + (zi + 1) + ": Seite");
      [["soll", "Soll"], ["haben", "Haben"]].forEach(function (s) {
        var k = knopf("pk--bs-seitenknopf" + (z.seite === s[0] ? " an" : ""), s[1], function () {
          z.seite = s[0];
          antwortSetzen(b, i, stand);
          seiten.querySelectorAll(".pk--bs-seitenknopf").forEach(function (x) {
            x.classList.toggle("an", x.dataset.seite === z.seite);
            x.setAttribute("aria-pressed", x.dataset.seite === z.seite ? "true" : "false");
          });
        });
        k.dataset.seite = s[0];
        k.setAttribute("aria-pressed", z.seite === s[0] ? "true" : "false");
        seiten.appendChild(k);
      });
      zeile.appendChild(seiten);

      var kontoFeld = el("input", "pk--bs-konto");
      kontoFeld.type = "text";
      kontoFeld.autocomplete = "off";
      kontoFeld.setAttribute("list", "pk--kontenliste");
      kontoFeld.setAttribute("aria-label", "Zeile " + (zi + 1) + ": Konto");
      kontoFeld.placeholder = "Nummer oder Bezeichnung";
      kontoFeld.value = z.konto || "";
      kontoFeld.addEventListener("input", function () {
        z.konto = kontoFeld.value;
        antwortSetzen(b, i, stand);
      });
      zeile.appendChild(kontoFeld);

      var betrag = el("input", "pk--bs-betrag");
      AP.kommafeld(betrag);
      betrag.setAttribute("aria-label", "Zeile " + (zi + 1) + ": Betrag in Euro");
      betrag.placeholder = "Betrag";
      betrag.value = z.betrag || "";
      betrag.addEventListener("input", function () {
        z.betrag = betrag.value;
        antwortSetzen(b, i, stand);
      });
      zeile.appendChild(betrag);
      box.appendChild(zeile);
    });

    antwortSetzen(b, i, stand);
    if (e.punkte != null) {
      box.appendChild(el("p", "pk--leise", punkteText(e.punkte) + " Punkte"));
    }
    return box;
  }

  function feldText(b, e, i) {
    var box = el("div", "pk--textfeld");
    var id = kennung("pkt");
    if (e.frage) {
      var lab = el("label", "pk--frage");
      lab.htmlFor = id;
      lab.innerHTML = AP.mk(e.frage);
      box.appendChild(lab);
    }
    var feld = el("textarea");
    feld.id = id;
    feld.rows = e.zeilen || 6;
    feld.value = antwortVon(b, i) || "";
    feld.addEventListener("input", function () { antwortSetzen(b, i, feld.value); });
    box.appendChild(feld);
    return box;
  }

  function beantwortet(b) {
    var a = zustand.antworten[b.id];
    if (!a) return false;
    return b.eingabe.some(function (e, i) {
      var v = a[i];
      if (v === undefined || v === null || v === "") return false;
      if (e.block === "zuordnung") return Object.keys(v).length > 0;
      if (e.block === "reihenfolge") return true;
      if (e.block === "buchungssatz") {
        return v.some(function (z) { return (z.konto || "").trim() || (z.betrag || "").trim(); });
      }
      if (Array.isArray(v)) return v.length > 0;
      return String(v).trim() !== "";
    });
  }

  /* ================================================== Oberfläche */

  var buehne = null;     // der #ueben-Schirm
  var zurueckZurUebersicht = null;
  var ansicht = "auswahl";
  var wahlKapitel = {}, wahlDauer = DAUER_STANDARD, wahlEigen = DAUER_STANDARD;
  var uhr = null;
  /* Das Kapitel, mit dem die Adresse hereingekommen ist. Nur zum Anzeigen —
     die Wahrheit über die Auswahl steht in wahlKapitel. */
  var vorgewaehlt = null;

  function kapitelListe() {
    return (vorrat ? vorrat.kapitel : []);
  }

  function lernfelder() {
    var raus = [], nach = {};
    kapitelListe().forEach(function (k) {
      if (!nach[k.lernfeld]) {
        nach[k.lernfeld] = { id: k.lernfeld, titel: k.lernfeldTitel, kapitel: [] };
        raus.push(nach[k.lernfeld]);
      }
      nach[k.lernfeld].kapitel.push(k);
    });
    return raus;
  }

  function gewaehlteKapitel() {
    return kapitelListe().map(function (k) { return k.schluessel; })
      .filter(function (s) { return wahlKapitel[s]; });
  }

  function kapitelName(schluessel) {
    var t = kapitelListe().filter(function (k) { return k.schluessel === schluessel; })[0];
    return t ? "K" + t.nummer + " · " + t.titel : schluessel;
  }

  function kapitelZiel(schluessel) {
    var t = kapitelListe().filter(function (k) { return k.schluessel === schluessel; })[0];
    return t ? t.zu : null;
  }

  function neuZeichnen() {
    if (!buehne) return;
    buehne.innerHTML = "";
    laufendeNr = 0;
    if (uhr) { clearInterval(uhr); uhr = null; }
    if (ansicht === "auswahl") ansichtAuswahl();
    else if (ansicht === "pruefen") ansichtZusammenfassung();
    else if (ansicht === "klausur") ansichtKlausur();
    else if (ansicht === "auswertung") ansichtAuswertung();
    window.scrollTo(0, 0);
  }

  /* Derselbe Bereichskopf wie in app.js — Mono-Augenbraue in Gold, Titel in
     Source Serif 4, Beitext in IBM Plex Sans. Die Probeklausur soll nicht wie
     eine angehängte Fremdseite wirken, sondern wie ein Teil derselben App. */
  function kopfzeile(titel, unter, augenbraue) {
    var k = el("div", "schirm-kopf pk--kopf");
    if (augenbraue) k.appendChild(el("p", "schirm-augenbraue", augenbraue));
    k.appendChild(el("h1", null, titel));
    if (unter) k.appendChild(el("p", null, unter));
    return k;
  }

  function zurueckKnopf(text, beiKlick) {
    var b = knopf("kn-neben pk--zurueck", text, beiKlick);
    return b;
  }

  /* ---------------------------------------- Auswahl */

  function ansichtAuswahl() {
    buehne.appendChild(zurueckKnopf("‹ Übersicht", function () {
      if (zurueckZurUebersicht) zurueckZurUebersicht();
    }));
    buehne.appendChild(kopfzeile("Prüf genau das, was du brauchst.",
      "Wähle die Kapitel deiner nächsten Klassenarbeit, leg die Dauer fest und "
      + "starte ohne Umwege.", "Eigene Probeklausur"));

    if (!kapitelListe().length) {
      buehne.appendChild(hinweiskasten(
        "Für dieses Lernfeld sind noch keine Aufgaben hinterlegt. Sobald welche "
        + "da sind, kannst du hier eine Probeklausur zusammenstellen."));
      return;
    }

    var laufend = zustandLaden();
    if (laufend && laufend.gestartet && !laufend.abgegeben) {
      buehne.appendChild(fortsetzkasten(laufend));
    }

    /* Aus einem Kapitel hereingekommen: sagen, was vorgewählt wurde. Ein still
       gesetztes Häkchen weiter unten sieht sonst aus wie ein Rest von gestern. */
    if (vorgewaehlt && wahlKapitel[vorgewaehlt]) {
      var kasten = el("div", "pk--hinweis pk--vorwahl");
      kasten.appendChild(el("p", null,
        "Vorgewählt aus dem Kapitel: " + kapitelName(vorgewaehlt)
        + ". Du kannst weitere Kapitel dazunehmen."));
      buehne.appendChild(kasten);
    }

    var lf = lernfelder();
    lf.forEach(function (feld) {
      buehne.appendChild(lernfeldGruppe(feld));
    });

    buehne.appendChild(dauerwahl());
    buehne.appendChild(aktionszone());
    standAktualisieren();
  }

  function hinweiskasten(text, knopftext, beiKlick) {
    var k = el("div", "pk--hinweis");
    k.appendChild(el("p", null, text));
    if (knopftext) k.appendChild(knopf("kn-haupt", knopftext, beiKlick));
    return k;
  }

  function fortsetzkasten(laufend) {
    var k = el("div", "pk--hinweis pk--laufend");
    var rest = Math.max(0, Math.round((laufend.ende - Date.now()) / 60000));
    k.appendChild(el("p", null,
      "Du hast eine begonnene Probeklausur: " + laufend.aufgaben.length + " Aufgaben, "
      + (laufend.ende ? "noch etwa " + rest + " Min." : "ohne Restzeit") + "."));
    var reihe = el("div", "knopfreihe");
    reihe.appendChild(knopf("kn-haupt", "Weiterschreiben", function () {
      zustand = laufend;
      ansicht = "klausur";
      neuZeichnen();
    }));
    reihe.appendChild(knopf("kn-neben", "Verwerfen", function () {
      if (!window.confirm("Die begonnene Probeklausur wirklich verwerfen? "
          + "Deine Antworten darin gehen verloren. Dein Lernstand bleibt unberührt.")) return;
      zustandVerwerfen();
      neuZeichnen();
    }));
    k.appendChild(reihe);
    return k;
  }

  function lernfeldGruppe(feld) {
    var gruppe = el("section", "pk--gruppe");
    var kopf = el("div", "pk--gruppenkopf");

    var auf = el("button", "pk--gruppenauf");
    auf.type = "button";
    auf.setAttribute("aria-expanded", "true");
    var pfeil = el("span", "pk--pfeil", "▾");
    auf.appendChild(pfeil);
    auf.appendChild(el("span", "pk--gruppenname", feld.titel));
    var zaehler = el("span", "pk--gruppenzahl");
    auf.appendChild(zaehler);

    var alle = el("button", "pk--gruppenalle");
    alle.type = "button";

    kopf.appendChild(auf);
    kopf.appendChild(alle);
    gruppe.appendChild(kopf);

    var liste = el("div", "pk--kapitelliste");
    feld.kapitel.forEach(function (k) {
      liste.appendChild(kapitelZeile(k));
    });
    gruppe.appendChild(liste);

    auf.addEventListener("click", function () {
      var offen = auf.getAttribute("aria-expanded") === "true";
      auf.setAttribute("aria-expanded", offen ? "false" : "true");
      liste.hidden = offen;
      pfeil.textContent = offen ? "▸" : "▾";
    });

    alle.addEventListener("click", function () {
      var voll = feld.kapitel.every(function (k) { return wahlKapitel[k.schluessel]; });
      feld.kapitel.forEach(function (k) { wahlKapitel[k.schluessel] = !voll; });
      liste.querySelectorAll("input[type=checkbox]").forEach(function (c) {
        c.checked = !voll;
      });
      standAktualisieren();
    });

    gruppe._auffrischen = function () {
      var n = feld.kapitel.filter(function (k) { return wahlKapitel[k.schluessel]; }).length;
      var voll = n === feld.kapitel.length;
      zaehler.textContent = n ? n + " von " + feld.kapitel.length + " gewählt"
                              : feld.kapitel.length + " Kapitel";
      gruppe.dataset.stand = voll ? "voll" : n ? "teils" : "keins";
      alle.textContent = voll ? "Alle abwählen" : "Ganzes Lernfeld";
      alle.setAttribute("aria-label",
        (voll ? "Alle Kapitel abwählen in " : "Alle Kapitel wählen in ") + feld.titel);
    };
    return gruppe;
  }

  function kapitelZeile(k) {
    var lab = el("label", "pk--kapitel");
    var box = el("input");
    box.type = "checkbox";
    box.checked = !!wahlKapitel[k.schluessel];
    box.addEventListener("change", function () {
      wahlKapitel[k.schluessel] = box.checked;
      standAktualisieren();
    });
    lab.appendChild(box);
    var text = el("span", "pk--kapiteltext");
    var oben = el("span", "pk--kapitelzeile");
    oben.appendChild(el("span", "pk--kapitelnr", "K" + k.nummer));
    oben.appendChild(el("span", "pk--kapiteltitel", k.titel));
    text.appendChild(oben);
    text.appendChild(el("span", "pk--kapitelmeta",
      k.bausteine + " Aufgaben · " + k.punkte + " Punkte"));
    lab.appendChild(text);
    return lab;
  }

  function dauerwahl() {
    var box = el("section", "pk--dauer");
    box.appendChild(el("h2", "abschnittstitel", "Wie lange soll die Klausur dauern?"));

    var reihe = el("div", "pk--dauerknoepfe");
    reihe.setAttribute("role", "group");
    reihe.setAttribute("aria-label", "Bearbeitungsdauer");

    var eigenBox = el("div", "pk--eigenzeit");
    var eigenId = kennung("pkd");
    var eigenLab = el("label", null, "Eigene Dauer: ");
    eigenLab.htmlFor = eigenId;
    var eigenWert = el("output", "pk--eigenwert", minutenText(wahlEigen));
    eigenLab.appendChild(eigenWert);
    var schieber = el("input");
    schieber.type = "range";
    schieber.id = eigenId;
    schieber.min = String(EIGEN_MIN);
    schieber.max = String(EIGEN_MAX);
    schieber.step = String(EIGEN_SCHRITT);
    schieber.value = String(wahlEigen);
    schieber.addEventListener("input", function () {
      wahlEigen = parseInt(schieber.value, 10);
      wahlDauer = wahlEigen;
      eigenWert.textContent = minutenText(wahlEigen);
      knoepfeAuffrischen();
      standAktualisieren();
    });
    eigenBox.appendChild(eigenLab);
    eigenBox.appendChild(schieber);

    function knoepfeAuffrischen() {
      reihe.querySelectorAll("button").forEach(function (b) {
        var an = parseInt(b.dataset.dauer, 10) === wahlDauer;
        b.classList.toggle("an", an);
        b.setAttribute("aria-pressed", an ? "true" : "false");
      });
      eigenBox.classList.toggle("an", DAUERN.indexOf(wahlDauer) === -1);
    }

    DAUERN.forEach(function (d) {
      var b = knopf(null, d + " Min.", function () {
        wahlDauer = d;
        knoepfeAuffrischen();
        standAktualisieren();
      });
      b.dataset.dauer = String(d);
      reihe.appendChild(b);
    });

    box.appendChild(reihe);
    box.appendChild(eigenBox);
    knoepfeAuffrischen();
    return box;
  }

  /* Wie viele Aufgaben die aktuelle Auswahl ergibt. Fester Seed: Die Zahl soll
     eine Eigenschaft der Auswahl sein und nicht bei jedem Neuzeichnen eine
     andere. */
  function aufgabenSchaetzung(gewaehlt) {
    var probe = stelleZusammen({ kapitel: gewaehlt, dauer: wahlDauer, seed: "schaetzung" });
    return probe.aufgaben.length;
  }

  var zoneText = null, zoneKnopf = null, zoneWarnung = null;

  function aktionszone() {
    var zone = el("div", "pk--aktionszone");
    zoneWarnung = el("p", "pk--zonewarnung");
    zoneWarnung.setAttribute("role", "status");
    zoneText = el("p", "pk--zonetext");
    zoneKnopf = knopf("kn-haupt pk--zonknopf", "Auswahl prüfen", function () {
      ansicht = "pruefen";
      neuZeichnen();
    });
    zone.appendChild(zoneWarnung);
    var innen = el("div", "pk--zoneinnen");
    innen.appendChild(zoneText);
    innen.appendChild(zoneKnopf);
    zone.appendChild(innen);
    return zone;
  }

  function standAktualisieren() {
    buehne.querySelectorAll(".pk--gruppe").forEach(function (g) {
      if (g._auffrischen) g._auffrischen();
    });
    var gewaehlt = gewaehlteKapitel();
    if (!zoneText) return;

    /* Kapitelzahl, Dauer und wie viele Aufgaben daraus ungefähr entstehen.
       Die Zahl ist nicht geraten: Sie kommt aus demselben Zusammensteller, der
       die Klausur später baut — nur mit festem Seed, damit sie beim Tippen
       nicht bei jedem Klick zappelt. Vor dem Start kann sie sich noch um eine
       Aufgabe verschieben, deshalb steht „ca." davor. */
    zoneText.textContent = gewaehlt.length
      ? gewaehlt.length + (gewaehlt.length === 1 ? " Kapitel" : " Kapitel")
        + " · " + minutenText(wahlDauer) + " · ca. " + aufgabenSchaetzung(gewaehlt)
        + " Aufgaben"
      : "Noch kein Kapitel gewählt";
    zoneKnopf.disabled = !gewaehlt.length;

    var noetig = gewaehlt.length ? mindestdauer(gewaehlt) : 0;
    if (gewaehlt.length && noetig > wahlDauer) {
      zoneWarnung.textContent = "Für " + gewaehlt.length + " Kapitel brauchst du "
        + "mindestens " + noetig + " Minuten — sonst bliebe ein Kapitel außen vor.";
      zoneWarnung.hidden = false;
      zoneKnopf.disabled = true;
    } else {
      zoneWarnung.hidden = true;
      zoneWarnung.textContent = "";
    }
  }

  /* ---------------------------------------- Zusammenfassung */

  var vorschau = null;

  function ansichtZusammenfassung() {
    var gewaehlt = gewaehlteKapitel();
    vorschau = stelleZusammen({
      kapitel: gewaehlt, dauer: wahlDauer, seed: neuerSeed(),
      vorher: letzteAufgaben()
    });

    buehne.appendChild(zurueckKnopf("‹ Auswahl ändern", function () {
      ansicht = "auswahl";
      neuZeichnen();
    }));
    buehne.appendChild(kopfzeile("Bereit?", null, "Deine Probeklausur"));

    if (vorschau.fehler === "zu_kurz") {
      buehne.appendChild(hinweiskasten(
        "Damit jedes gewählte Kapitel vorkommt, brauchst du mindestens "
        + vorschau.mindestdauer + " Minuten. Gewählt sind " + wahlDauer
        + ". Nimm mehr Zeit oder weniger Kapitel — still ein Kapitel wegzulassen "
        + "wäre die schlechtere Lösung.",
        "Zurück zur Auswahl", function () { ansicht = "auswahl"; neuZeichnen(); }));
      return;
    }
    if (vorschau.fehler || !vorschau.aufgaben.length) {
      buehne.appendChild(hinweiskasten(
        "Zu dieser Auswahl gibt es keine Aufgaben.",
        "Zurück zur Auswahl", function () { ansicht = "auswahl"; neuZeichnen(); }));
      return;
    }

    var liste = el("dl", "pk--zusammenfassung");
    function zeile(name, wert) {
      liste.appendChild(el("dt", null, name));
      liste.appendChild(el("dd", null, wert));
    }
    zeile("Kapitel", String(gewaehlt.length));
    zeile("Gewählte Dauer", minutenText(wahlDauer));
    zeile("Aufgaben", String(vorschau.aufgaben.length));
    zeile("Erreichbare Punkte", String(vorschau.punkte));
    zeile("Geschätzte Bearbeitungszeit", minutenText(vorschau.minuten));
    buehne.appendChild(liste);

    var kap = el("ul", "pk--kapitelchips");
    gewaehlt.forEach(function (s) {
      kap.appendChild(el("li", "pk--chip", kapitelName(s)));
    });
    buehne.appendChild(kap);

    if (vorschau.minuten < wahlDauer - 5) {
      buehne.appendChild(el("p", "pk--leise",
        "Die Aufgaben füllen die Zeit nicht ganz aus — mehr passt aus diesen "
        + "Kapiteln nicht sinnvoll hinein. Angezeigt ist die ehrliche Schätzung."));
    }

    buehne.appendChild(el("p", "pk--merksatz",
      "Während der Klausur werden keine Lösungen gezeigt. Erlaubt sind Kontenplan "
      + "und Taschenrechner — beide findest du oben in der Klausur."));

    var zone = el("div", "pk--aktionszone");
    var innen = el("div", "pk--zoneinnen");
    innen.appendChild(el("p", "pk--zonetext",
      vorschau.aufgaben.length + " Aufgaben · " + vorschau.punkte + " Punkte"));
    innen.appendChild(knopf("kn-haupt pk--zonknopf", "Probeklausur starten", starten));
    zone.appendChild(innen);
    buehne.appendChild(zone);
  }

  function letzteAufgaben() {
    var alt = zustandLaden();
    return alt ? (alt.aufgaben || []) : [];
  }

  function starten() {
    var alt = zustandLaden();
    var vorher = alt ? alt.aufgaben : [];
    zustand = frischerZustand();
    zustand.seed = vorschau.seed;
    zustand.kapitel = vorschau.kapitel;
    zustand.dauer = vorschau.dauer;
    zustand.aufgaben = vorschau.aufgaben;
    zustand.vorher = vorher;
    zustand.gestartet = true;
    // Absolute Endzeit, kein Herunterzählen: Wer die App schließt, verliert
    // Zeit — genau wie in einer echten Klausur. Und ein Neuladen setzt nichts
    // zurück.
    zustand.ende = Date.now() + vorschau.dauer * 60000;
    zustand.werte = {};
    var fehler = [];
    zustand.aufgaben.forEach(function (id) {
      var b = baustein(id);
      try { zustand.werte[id] = werteZiehen(b, zustand.seed); }
      catch (e) { fehler.push(id); zustand.werte[id] = {}; }
    });
    if (fehler.length) {
      zustand.aufgaben = zustand.aufgaben.filter(function (id) {
        return fehler.indexOf(id) === -1;
      });
    }
    zustandSichern();
    ansicht = "klausur";
    neuZeichnen();
  }

  /* ---------------------------------------- Klausur */

  function restsekunden() {
    if (!zustand || !zustand.ende) return null;
    return Math.max(0, Math.round((zustand.ende - Date.now()) / 1000));
  }

  function uhrText(s) {
    if (s == null) return "—";
    var m = Math.floor(s / 60), r = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }

  function ansichtKlausur() {
    if (!zustand || !zustand.aufgaben.length) {
      ansicht = "auswahl"; neuZeichnen(); return;
    }
    var b = baustein(zustand.aufgaben[zustand.aktuell]);
    if (!b) { zustand.aktuell = 0; b = baustein(zustand.aufgaben[0]); }

    buehne.classList.add("pk--imbogen");
    buehne.appendChild(klausurkopf());
    if (zustand.abgelaufen) buehne.appendChild(ablaufmeldung());

    var bogen = el("article", "pk--bogen");
    var kopf = el("header", "pk--aufgabenkopf");
    kopf.appendChild(el("span", "pk--aufgabennr",
      "Aufgabe " + (zustand.aktuell + 1) + " von " + zustand.aufgaben.length));
    kopf.appendChild(el("span", "pk--aufgabenmeta",
      b.punkte + " Punkte · ca. " + b.dauer_min + " Min."));
    bogen.appendChild(kopf);
    bogen.appendChild(el("p", "pk--operator", b.operator));

    var w = werteVon(b);
    (b.anzeige || []).forEach(function (a) {
      var teil = anzeigeBlock(a, w);
      if (teil) bogen.appendChild(teil);
    });
    var eingaben = el("div", "pk--eingaben");
    (b.eingabe || []).forEach(function (e, i) {
      eingaben.appendChild(eingabeBlock(b, e, i));
    });
    bogen.appendChild(eingaben);
    buehne.appendChild(bogen);

    buehne.appendChild(kontenliste());
    buehne.appendChild(navigation(b));
    starteUhr();
  }

  function klausurkopf() {
    var kopf = el("div", "pk--klausurkopf");

    var oben = el("div", "pk--kk-oben");
    oben.appendChild(el("span", "pk--kk-marke", "Probeklausur"));
    var uhrfeld = el("span", "pk--kk-uhr");
    uhrfeld.id = "pk-uhr";
    uhrfeld.setAttribute("role", "timer");
    uhrfeld.setAttribute("aria-live", "off");
    oben.appendChild(uhrfeld);
    kopf.appendChild(oben);

    var balken = el("div", "pk--fortschritt");
    var span = el("span");
    span.style.width = Math.round((zustand.aktuell + 1) / zustand.aufgaben.length * 100) + "%";
    balken.appendChild(span);
    balken.setAttribute("role", "progressbar");
    balken.setAttribute("aria-valuemin", "1");
    balken.setAttribute("aria-valuemax", String(zustand.aufgaben.length));
    balken.setAttribute("aria-valuenow", String(zustand.aktuell + 1));
    balken.setAttribute("aria-label", "Fortschritt in der Klausur");
    kopf.appendChild(balken);

    var werkzeuge = el("div", "pk--werkzeuge");
    werkzeuge.appendChild(knopf("pk--wz", "Übersicht", uebersichtOeffnen));
    werkzeuge.appendChild(knopf("pk--wz", "Kontenplan", kontenplanOeffnen));
    werkzeuge.appendChild(knopf("pk--wz", "Rechner", rechnerOeffnen));
    var merk = knopf("pk--wz pk--merk", "", markieren);
    merk.id = "pk-merk";
    werkzeuge.appendChild(merk);
    werkzeuge.appendChild(knopf("pk--wz pk--verlassen", "Später weiter", function () {
      zustandSichern();
      ansicht = "auswahl";
      buehne.classList.remove("pk--imbogen");
      neuZeichnen();
    }));
    kopf.appendChild(werkzeuge);
    // Erst jetzt beschriften: Über die Kennung wäre der Knopf noch nicht zu
    // finden — der Kopf hängt in diesem Moment noch nicht im Dokument.
    merkKnopfAuffrischen(merk);
    return kopf;
  }

  function ablaufmeldung() {
    var k = el("div", "pk--hinweis pk--abgelaufen");
    k.setAttribute("role", "alert");
    k.appendChild(el("p", null,
      "Die Zeit ist abgelaufen. Deine Antworten sind gesichert — du kannst sie "
      + "noch ansehen und dann abgeben."));
    k.appendChild(knopf("kn-haupt", "Jetzt abgeben", abgeben));
    return k;
  }

  function markieren() {
    var id = zustand.aufgaben[zustand.aktuell];
    var pos = zustand.markiert.indexOf(id);
    if (pos === -1) zustand.markiert.push(id); else zustand.markiert.splice(pos, 1);
    zustandSichern();
    merkKnopfAuffrischen();
  }

  function merkKnopfAuffrischen(knopfEl) {
    var b = knopfEl || document.getElementById("pk-merk");
    if (!b) return;
    var an = zustand.markiert.indexOf(zustand.aufgaben[zustand.aktuell]) !== -1;
    b.textContent = an ? "★ Gemerkt" : "☆ Später ansehen";
    b.classList.toggle("an", an);
    b.setAttribute("aria-pressed", an ? "true" : "false");
  }

  function navigation(b) {
    var nav = el("div", "pk--aktionszone");
    var innen = el("div", "pk--zoneinnen pk--navzone");
    var zurueck = knopf("kn-neben", "‹ Zurück", function () {
      if (zustand.aktuell > 0) { zustand.aktuell--; zustandSichern(); neuZeichnen(); }
    });
    zurueck.disabled = zustand.aktuell === 0;
    innen.appendChild(zurueck);

    if (zustand.aktuell < zustand.aufgaben.length - 1) {
      innen.appendChild(knopf("kn-haupt", "Weiter ›", function () {
        zustand.aktuell++;
        zustandSichern();
        neuZeichnen();
      }));
    } else {
      innen.appendChild(knopf("kn-haupt", "Abgeben", abgeben));
    }
    nav.appendChild(innen);
    return nav;
  }

  function starteUhr() {
    var feld = document.getElementById("pk-uhr");
    if (!feld) return;
    function tick() {
      var s = restsekunden();
      feld.textContent = uhrText(s);
      // Der Zustand darf nicht nur an der Farbe hängen — das Wort steht daneben.
      feld.classList.toggle("knapp", s != null && s <= 300);
      feld.setAttribute("aria-label", s == null ? "Keine Restzeit"
        : "Restzeit " + Math.floor(s / 60) + " Minuten"
          + (s <= 300 ? ", weniger als fünf Minuten" : ""));
      feld.dataset.knapp = s != null && s <= 300 ? "wenig Zeit" : "";
      if (s === 0 && !zustand.abgelaufen) {
        zustand.abgelaufen = true;
        zustandSichern();
        neuZeichnen();
      }
    }
    tick();
    uhr = setInterval(tick, 1000);
  }

  /* ---------------------------------------- Blätter von unten */

  function blatt(titel, aufbau) {
    var huelle = el("div", "pk--blatt");
    huelle.setAttribute("role", "dialog");
    huelle.setAttribute("aria-modal", "true");
    huelle.setAttribute("aria-label", titel);
    var innen = el("div", "pk--blatt-innen");
    var kopf = el("div", "pk--blatt-kopf");
    kopf.appendChild(el("h2", null, titel));
    var zu = knopf("pk--blatt-zu", "Schließen", schliessen);
    kopf.appendChild(zu);
    innen.appendChild(kopf);
    var koerper = el("div", "pk--blatt-koerper");
    aufbau(koerper, schliessen);
    innen.appendChild(koerper);
    huelle.appendChild(innen);
    huelle.addEventListener("click", function (ev) {
      if (ev.target === huelle) schliessen();
    });
    function beiTaste(ev) { if (ev.key === "Escape") schliessen(); }
    function schliessen() {
      document.removeEventListener("keydown", beiTaste);
      huelle.remove();
    }
    document.addEventListener("keydown", beiTaste);
    document.body.appendChild(huelle);
    zu.focus({ preventScroll: true });
    return huelle;
  }

  function uebersichtOeffnen() {
    blatt("Aufgabenübersicht", function (koerper, zu) {
      var gitter = el("div", "pk--uebersicht");
      zustand.aufgaben.forEach(function (id, n) {
        var b = baustein(id);
        var fertig = beantwortet(b);
        var gemerkt = zustand.markiert.indexOf(id) !== -1;
        var k = knopf("pk--ue-feld", String(n + 1), function () {
          zustand.aktuell = n;
          zustandSichern();
          zu();
          neuZeichnen();
        });
        k.classList.toggle("fertig", fertig);
        k.classList.toggle("gemerkt", gemerkt);
        k.classList.toggle("hier", n === zustand.aktuell);
        k.setAttribute("aria-label", "Aufgabe " + (n + 1) + ": "
          + (fertig ? "beantwortet" : "offen") + (gemerkt ? ", gemerkt" : "")
          + (n === zustand.aktuell ? ", aktuell" : ""));
        if (gemerkt) k.appendChild(el("span", "pk--ue-stern", "★"));
        gitter.appendChild(k);
      });
      koerper.appendChild(gitter);
      var offen = zustand.aufgaben.filter(function (id) {
        return !beantwortet(baustein(id));
      }).length;
      koerper.appendChild(el("p", "pk--leise",
        offen ? offen + " Aufgaben noch ohne Antwort." : "Alle Aufgaben beantwortet."));
      koerper.appendChild(el("p", "pk--leise",
        "Ausgefüllt = beantwortet, ★ = später noch einmal ansehen."));
    });
  }

  function kontenplanOeffnen() {
    blatt("Kontenplan", function (koerper) {
      var suche = el("input", "pk--kp-suche");
      suche.type = "search";
      suche.placeholder = "Nummer oder Bezeichnung …";
      suche.setAttribute("aria-label", "Im Kontenplan suchen");
      koerper.appendChild(suche);
      var liste = el("ul", "pk--kp-liste");
      koerper.appendChild(liste);
      function zeichnen() {
        var frage = schluessel(suche.value);
        liste.innerHTML = "";
        alleKonten().forEach(function (k) {
          // Auch unter der Schulbezeichnung finden: Wer „Bank" sucht, meint
          // 2800 und soll nicht erst wissen, dass es dort anders heißt.
          var heu = schluessel(k.nr + k.name + k.alias.join(""));
          if (frage && heu.indexOf(frage) === -1) return;
          var li = el("li");
          li.appendChild(el("span", "pk--kp-nr", k.nr));
          var name = el("span", "pk--kp-name", k.name);
          if (k.alias.length) {
            name.appendChild(el("small", "pk--kp-alias", "auch: " + k.alias.join(", ")));
          }
          li.appendChild(name);
          liste.appendChild(li);
        });
        if (!liste.children.length) {
          liste.appendChild(el("li", "pk--leise", "Kein Konto gefunden."));
        }
      }
      suche.addEventListener("input", zeichnen);
      zeichnen();
    });
  }

  /* Ein Taschenrechner, mehr nicht: vier Grundrechenarten und Prozent.
     Ausgewertet wird mit demselben Rechner wie die Aufgabenformeln — kein
     zweiter Weg, auf dem Text zu Code werden könnte. */
  function rechnerOeffnen() {
    blatt("Taschenrechner", function (koerper) {
      var anzeige = el("output", "pk--rechner-anzeige", "0");
      var feld = el("input", "pk--rechner-feld");
      AP.kommafeld(feld);
      feld.setAttribute("aria-label", "Rechenaufgabe, zum Beispiel 1250 * 0,19");
      feld.placeholder = "z. B. 1250 * 0,19";
      function rechnen() {
        var text = feld.value.trim().replace(/,/g, ".");
        if (!text) { anzeige.textContent = "0"; return; }
        try {
          var wert = rechne(text, {});
          anzeige.textContent = typeof wert === "number" ? zahlText(wert) : String(wert);
        } catch (e) {
          anzeige.textContent = "—";
        }
      }
      feld.addEventListener("input", rechnen);
      koerper.appendChild(feld);
      koerper.appendChild(anzeige);
      koerper.appendChild(el("p", "pk--leise",
        "Plus, minus, mal, geteilt und Klammern. Komma oder Punkt, beides geht."));
      feld.focus({ preventScroll: true });
    });
  }

  /* ---------------------------------------- Abgabe */

  function abgeben() {
    var offen = zustand.aufgaben.filter(function (id) {
      return !beantwortet(baustein(id));
    });
    if (offen.length && !zustand.abgelaufen) {
      if (!window.confirm(offen.length + " Aufgabe" + (offen.length === 1 ? " ist" : "n sind")
          + " noch ohne Antwort. Trotzdem abgeben?")) return;
    }
    zustand.abgegeben = true;
    zustand.ende = null;
    zustandSichern();
    if (uhr) { clearInterval(uhr); uhr = null; }
    buehne.classList.remove("pk--imbogen");
    ansicht = "auswertung";
    neuZeichnen();
  }

  /* ---------------------------------------- Auswertung */

  function ansichtAuswertung() {
    var offeneAufgaben = zustand.aufgaben.map(baustein).filter(function (b) {
      return b && b.bewertung.art === "selbstbewertung";
    });

    buehne.appendChild(kopfzeile("Auswertung", null));

    if (offeneAufgaben.length) {
      buehne.appendChild(el("h2", "abschnittstitel", "Offene Antworten selbst bewerten"));
      buehne.appendChild(el("p", "pk--leise",
        "Ein Rechner kann einen Fließtext nicht bewerten. Lies deine Antwort neben "
        + "der Musterlösung und hake genau das ab, was wirklich darin steht. Nur "
        + "abgehakte Kriterien zählen."));
      offeneAufgaben.forEach(function (b) {
        buehne.appendChild(selbstbewertung(b));
      });
    }

    var summe = el("div", "pk--summe");
    summe.id = "pk-summe";
    buehne.appendChild(summe);
    summeZeichnen();

    buehne.appendChild(el("h2", "abschnittstitel", "Ergebnis je Kapitel"));
    var kapitelBox = el("div");
    kapitelBox.id = "pk-kapitel";
    buehne.appendChild(kapitelBox);
    kapitelZeichnen();

    buehne.appendChild(el("h2", "abschnittstitel", "Aufgaben im Einzelnen"));
    zustand.aufgaben.forEach(function (id, n) {
      var b = baustein(id);
      if (b) buehne.appendChild(loesungsblock(b, n));
    });

    // Am Ende der Auswertung klebt nichts: Hier ist man fertig, und ein
    // schwebender Balken über den Lösungen wäre nur im Weg.
    var zone = el("div", "pk--aktionszone pk--zoneende");
    var innen = el("div", "pk--zoneinnen");
    innen.appendChild(knopf("kn-haupt", "Neue Variante erstellen", function () {
      wahlKapitel = {};
      zustand.kapitel.forEach(function (k) { wahlKapitel[k] = true; });
      wahlDauer = zustand.dauer;
      ansicht = "pruefen";
      neuZeichnen();
    }));
    innen.appendChild(knopf("kn-neben", "Auswahl ändern", function () {
      wahlKapitel = {};
      zustand.kapitel.forEach(function (k) { wahlKapitel[k] = true; });
      wahlDauer = zustand.dauer;
      ansicht = "auswahl";
      neuZeichnen();
    }));
    zone.appendChild(innen);
    buehne.appendChild(zone);
  }

  function summeZeichnen() {
    var kasten = document.getElementById("pk-summe");
    if (!kasten) return;
    var e = ergebnis();
    kasten.innerHTML = "";
    var gross = el("p", "pk--punktzahl");
    gross.appendChild(el("b", null, punkteText(e.erreicht)));
    gross.appendChild(document.createTextNode(" von " + e.moeglich + " Punkten"));
    kasten.appendChild(gross);
    kasten.appendChild(el("p", "pk--prozent",
      String(e.prozent).replace(".", ",") + " %"));
    if (e.offen) {
      kasten.appendChild(el("p", "pk--leise", e.offen === 1
        ? "Eine offene Antwort ist noch nicht bewertet und zählt bis dahin null Punkte."
        : e.offen + " offene Antworten sind noch nicht bewertet und zählen bis "
          + "dahin null Punkte."));
    }
    kasten.appendChild(el("p", "pk--leise",
      "Keine Note: Notenschlüssel unterscheiden sich von Schule zu Schule."));
  }

  function kapitelZeichnen() {
    var kasten = document.getElementById("pk-kapitel");
    if (!kasten) return;
    var e = ergebnis();
    kasten.innerHTML = "";
    var ul = el("ul", "liste-schlicht");
    var schwach = [];
    e.kapitel.sort(function (a, b) {
      return (a.erreicht / a.moeglich) - (b.erreicht / b.moeglich);
    }).forEach(function (k) {
      var anteil = k.moeglich ? k.erreicht / k.moeglich : 0;
      if (anteil < 0.6) schwach.push(k);
      var li = el("li");
      var ziel = kapitelZiel(k.schluessel);
      var zeile = ziel ? el("a", "reihe") : el("div", "reihe");
      if (ziel) zeile.href = ziel;
      var oben = el("div", "reihe-oben");
      oben.appendChild(el("span", "reihe-titel", kapitelName(k.schluessel)));
      oben.appendChild(el("span", "reihe-meta",
        punkteText(k.erreicht) + "/" + k.moeglich + " · " + Math.round(anteil * 100) + " %"));
      zeile.appendChild(oben);
      var latte = el("div", "messlatte");
      var s = el("span");
      s.style.width = Math.round(anteil * 100) + "%";
      latte.appendChild(s);
      zeile.appendChild(latte);
      if (k.moeglich - k.erreicht > 0) {
        zeile.appendChild(el("div", "reihe-quelle",
          punkteText(k.moeglich - k.erreicht) + " Punkte verloren"
          + (ziel ? " · im Kapitel nachlesen" : "")));
      }
      li.appendChild(zeile);
      ul.appendChild(li);
    });
    kasten.appendChild(ul);
    if (schwach.length) {
      kasten.appendChild(el("p", "pk--merksatz", "Diese Kapitel solltest du wiederholen: "
        + schwach.map(function (k) { return kapitelName(k.schluessel); }).join(", ") + "."));
    }
  }

  function selbstbewertung(b) {
    var box = el("section", "pk--selbst");
    box.appendChild(el("h3", "pk--selbst-titel", b.operator));
    var w = werteVon(b);
    (b.anzeige || []).forEach(function (a) {
      var teil = anzeigeBlock(a, w);
      if (teil) box.appendChild(teil);
    });

    var meine = el("div", "pk--selbst-meine");
    meine.appendChild(el("p", "pk--titelchen", "Deine Antwort"));
    var text = "";
    b.eingabe.forEach(function (e, i) {
      if (e.block === "textfeld") text = antwortVon(b, i) || "";
    });
    meine.appendChild(el("p", "pk--selbst-text", text || "— keine Antwort —"));
    box.appendChild(meine);

    var muster = el("details", "pk--anlage");
    muster.appendChild(el("summary", null, "Musterlösung"));
    var mi = el("div", "pk--anlage-inhalt");
    mi.appendChild(mkEl("p", null, b.bewertung.musterloesung || ""));
    muster.appendChild(mi);
    box.appendChild(muster);

    box.appendChild(el("p", "pk--titelchen", "Was steht wirklich in deiner Antwort?"));
    var haken = zustand.selbst[b.id] || [];
    var raster = el("div", "pk--raster");
    (b.bewertung.raster || []).forEach(function (k, ki) {
      var lab = el("label", "pk--kriterium");
      var box2 = el("input");
      box2.type = "checkbox";
      box2.checked = !!haken[ki];
      box2.addEventListener("change", function () {
        var stand = (zustand.selbst[b.id] || []).slice();
        stand[ki] = box2.checked;
        zustand.selbst[b.id] = stand;
        zustandSichern();
        summeZeichnen();
        kapitelZeichnen();
      });
      lab.appendChild(box2);
      lab.appendChild(el("span", "pk--kriteriumtext", k.kriterium));
      lab.appendChild(el("span", "pk--kriteriumpunkte", punkteText(k.punkte) + " P."));
      raster.appendChild(lab);
    });
    box.appendChild(raster);
    if (!zustand.selbst[b.id]) {
      zustand.selbst[b.id] = (b.bewertung.raster || []).map(function () { return false; });
      zustandSichern();
    }
    return box;
  }

  function loesungsblock(b, n) {
    var box = el("section", "pk--loesung");
    var e = bewerteBaustein(b);
    var kopf = el("header", "pk--aufgabenkopf");
    kopf.appendChild(el("span", "pk--aufgabennr", "Aufgabe " + (n + 1)));
    kopf.appendChild(el("span", "pk--aufgabenmeta",
      punkteText(e.punkte) + " von " + e.moeglich + " Punkten"));
    box.appendChild(kopf);
    box.appendChild(el("p", "pk--operator", b.operator));

    var w = werteVon(b);
    var d = el("details", "pk--anlage");
    d.appendChild(el("summary", null, "Aufgabe und Lösung ansehen"));
    var innen = el("div", "pk--anlage-inhalt");
    (b.anzeige || []).forEach(function (a) {
      var teil = anzeigeBlock(a, w);
      if (teil) innen.appendChild(teil);
    });
    b.eingabe.forEach(function (blk, i) {
      innen.appendChild(loesungZuBlock(b, blk, i, w));
    });
    if (b.erklaerung) {
      innen.appendChild(mkEl("p", "pk--erklaerung", b.erklaerung));
    }
    innen.appendChild(el("p", "pk--leise", "Quelle: " + (b.quelle || "—")));
    d.appendChild(innen);
    box.appendChild(d);
    return box;
  }

  function loesungZuBlock(b, e, i, w) {
    var box = el("div", "pk--loesungsteil");
    var name = e.label || e.frage || e.lead || "";
    if (name) box.appendChild(mkEl("p", "pk--titelchen", name));

    if (e.block === "zahl") {
      var r = bewerteZahl(b, e, i);
      box.appendChild(vergleichszeile(
        antwortVon(b, i) || "—",
        zahlText(r.soll) + " " + (e.einheit || ""),
        r.punkte > 0,
        r.folgefehler ? "Folgefehler anerkannt" : null));
    } else if (e.block === "auswahl") {
      var a = bewerteAuswahl(b, e, i);
      var ul = el("ul", "pk--loesungsliste");
      e.optionen.forEach(function (o, oi) {
        var gewaehlt = e.mehrfach
          ? (antwortVon(b, i) || []).indexOf(oi) !== -1
          : antwortVon(b, i) === oi;
        var li = el("li", "pk--loesungszeile");
        li.appendChild(el("span", "pk--marke",
          o.richtig ? "richtig" : gewaehlt ? "falsch" : "—"));
        li.appendChild(mkEl("span", null, o.text + (gewaehlt ? " (deine Wahl)" : "")));
        if (gewaehlt && o.echo) li.appendChild(mkEl("p", "pk--echo", o.echo));
        ul.appendChild(li);
      });
      box.appendChild(ul);
      box.appendChild(el("p", "pk--leise", punkteText(a.punkte) + " Punkte"));
    } else if (e.block === "zuordnung") {
      var z = antwortVon(b, i) || {};
      var ul2 = el("ul", "pk--loesungsliste");
      e.elemente.forEach(function (x, xi) {
        var li = el("li", "pk--loesungszeile");
        li.appendChild(el("span", "pk--marke", z[xi] === x.loesung ? "richtig" : "falsch"));
        li.appendChild(mkEl("span", null, x.text));
        li.appendChild(el("span", "pk--loesungswert",
          "deine Antwort: " + (z[xi] || "—") + " · richtig: " + x.loesung));
        ul2.appendChild(li);
      });
      box.appendChild(ul2);
    } else if (e.block === "reihenfolge") {
      var rf = antwortVon(b, i) || [];
      var ol = el("ol", "pk--loesungsliste");
      e.elemente.slice().sort(function (x, y) { return x.position - y.position; })
        .forEach(function (x) {
          var xi = e.elemente.indexOf(x);
          var li = el("li", "pk--loesungszeile");
          li.appendChild(el("span", "pk--marke",
            rf[x.position - 1] === xi ? "richtig" : "falsch"));
          li.appendChild(mkEl("span", null, x.text));
          ol.appendChild(li);
        });
      box.appendChild(ol);
    } else if (e.block === "buchungssatz") {
      var bs = bewerteBuchungssatz(b, e, i);
      var deine = antwortVon(b, i) || [];
      var t1 = el("div", "pk--loesungssatz");
      t1.appendChild(el("p", "pk--titelchen", "Deine Eingabe"));
      deine.forEach(function (z) {
        t1.appendChild(el("p", "pk--satzzeile",
          (z.seite === "haben" ? "Haben" : "Soll") + "  "
          + (kontoName(z.konto) || "—") + "  " + (z.betrag || "—")));
      });
      box.appendChild(t1);
      var t2 = el("div", "pk--loesungssatz");
      t2.appendChild(el("p", "pk--titelchen", "Lösung"));
      bs.zeilen.forEach(function (z) {
        t2.appendChild(el("p", "pk--satzzeile",
          (z.seite === "haben" ? "Haben" : "Soll") + "  "
          + (z.konto ? z.konto.nr + " " + z.konto.name : "?") + "  "
          + (z.betrag != null ? zahlText(z.betrag) + " €" : "")));
      });
      box.appendChild(t2);
      box.appendChild(el("p", "pk--leise", punkteText(bs.punkte) + " Punkte"));
    } else if (e.block === "textfeld") {
      box.appendChild(el("p", "pk--leise",
        "Diese Antwort hast du oben selbst bewertet."));
    }
    return box;
  }

  function vergleichszeile(deine, richtige, ok, zusatz) {
    var p = el("div", "pk--vergleich");
    p.appendChild(el("span", "pk--marke", ok ? "richtig" : "falsch"));
    p.appendChild(el("span", "pk--loesungswert",
      "deine Antwort: " + deine + " · richtig: " + richtige));
    if (zusatz) p.appendChild(el("span", "pk--zusatz", zusatz));
    return p;
  }

  /* Die Vervollständigungsliste für Buchungssätze. Einmal im Dokument, für
     alle Felder — sie enthält den ganzen Kontenplan und bevorzugt nichts. */
  function kontenliste() {
    var dl = document.getElementById("pk--kontenliste");
    if (dl) return el("span");
    dl = document.createElement("datalist");
    dl.id = "pk--kontenliste";
    alleKonten().forEach(function (k) {
      var o = document.createElement("option");
      o.value = k.nr + " — " + k.name;
      dl.appendChild(o);
    });
    return dl;
  }

  /* ================================================== Einstieg */

  function laden() {
    if (vorrat) return Promise.resolve(vorrat);
    if (laedt) return laedt;
    laedt = fetch("mittel/aufgaben.json")
      .then(function (a) { return a.json(); })
      .then(function (d) { vorrat = d; kontenIndex = null; return d; });
    return laedt;
  }

  /* Von app.js aufgerufen. Alles Weitere passiert hier drin.

     `vorwahl` ist die Kapitelkennung aus der Adresse — der direkte Weg aus
     einem Kapitel heraus (`#ueben/probeklausur?kapitel=buchfuehrung:k3`).
     Eine unbekannte Kennung ist kein Fehler: Sie wird still übergangen und es
     erscheint die normale Auswahl. Nichts Gespeichertes wird davon berührt. */
  function zeige(schirm, zurueck, vorwahl) {
    buehne = schirm;
    zurueckZurUebersicht = zurueck;
    buehne.innerHTML = "";
    buehne.appendChild(el("p", "pk--leise", "Aufgaben werden geladen …"));

    laden().then(function () {
      var laufend = zustandLaden();
      if (laufend && laufend.gestartet && !laufend.abgegeben) {
        /* Eine begonnene Klausur geht allem vor — auch einer Kapitelkennung in
           der Adresse. Nach dem Start steht die Kennung nämlich weiterhin dort,
           und ein Neuladen mitten in der Klausur würde sonst in der Auswahl
           landen statt im Bogen. Eine abgeschlossene Klausur kommt dagegen
           NICHT ungefragt zurück. */
        vorgewaehlt = null;
        zustand = laufend;
        ansicht = "klausur";
        neuZeichnen();
        return;
      }

      var gewuenscht = vorwahl && kapitelListe().some(function (k) {
        return k.schluessel === vorwahl;
      }) ? vorwahl : null;

      vorgewaehlt = gewuenscht;
      if (gewuenscht) {
        // Aus einem Kapitel gekommen: genau dieses Kapitel steht an, sonst nichts.
        wahlKapitel = {};
        wahlKapitel[gewuenscht] = true;
      }
      ansicht = "auswahl";
      neuZeichnen();
    }).catch(function () {
      buehne.innerHTML = "";
      buehne.appendChild(zurueckKnopf("‹ Übersicht", function () {
        if (zurueckZurUebersicht) zurueckZurUebersicht();
      }));
      buehne.appendChild(kopfzeile("Aufgaben nicht gefunden",
        "mittel/aufgaben.json ließ sich nicht laden. Wurde build_app.py schon "
        + "ausgeführt — und läuft die Seite über einen Server statt per Doppelklick?"));
    });
  }

  /* Läuft gerade eine Klausur — und ist das die erste Frage seit dem Laden?

     app.js springt damit nach einem Neuladen sofort zurück in die begonnene
     Klausur, statt den Nutzer erst wieder durch die Übungsliste zu schicken.
     Nur beim ersten Mal: Sonst käme man aus der Klausur nie wieder heraus,
     weil „‹ Übersicht" jedes Mal zurückgeworfen würde. */
  function laeuft() {
    if (!ersterBlick) return false;
    ersterBlick = false;
    var z = zustandLaden();
    return !!(z && z.gestartet && !z.abgegeben);
  }

  function verlassen() {
    if (uhr) { clearInterval(uhr); uhr = null; }
    if (buehne) buehne.classList.remove("pk--imbogen");
  }

  /* ================================================== Prüfstand

     Was funktionstest.py von außen nicht sehen kann: dass 100 Ziehungen je
     Baustein plausibel sind, dass ein Seed reproduziert und dass ein unbekannter
     Ausdruck abgelehnt wird. Der Test fährt diese Funktionen im Browser an —
     ein zweiter Rechner in Python wäre ein zweiter Rechner, der abweichen kann. */

  var pruefstand = {
    laden: laden,
    rechne: rechne,
    werteZiehen: werteZiehen,
    stelleZusammen: stelleZusammen,
    konto: konto,
    zahlLesen: zahlLesen,
    vorrat: function () { return vorrat; },
    baustein: baustein,
    /* Bewerten und Auswerten arbeiten auf dem gespeicherten Zustand. Der Test
       schreibt ihn direkt in den Speicher und lässt hier rechnen — dieselbe
       Rechnung, die auch die Auswertung anzeigt. */
    bewerte: function (id) { zustand = zustandLaden(); return bewerteBaustein(baustein(id)); },
    ergebnis: function () { zustand = zustandLaden(); return ergebnis(); }
  };

  return {
    zeige: zeige, verlassen: verlassen, laden: laden, laeuft: laeuft,
    SCHLUESSEL: SCHLUESSEL, pruefstand: pruefstand
  };
})();
