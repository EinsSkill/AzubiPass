/* AzubiPass · App
   ---------------------------------------------------------------------------
   Die fünf Schirme: Heute, Lernen, Üben, Suche, Ich.

   Der Inhalt kommt aus mittel/inhalt.json, das build_app.py aus denselben
   Kapiteldateien erzeugt wie die Lernzettel. Nichts wird doppelt gepflegt.    */

(function () {
  "use strict";

  var AP = window.AP;
  var el = AP.el, mkEl = AP.mkEl, stand = AP.stand, sichern = AP.sichern;

  var inhalt = null;
  var suchdaten = null;                       // wird erst beim Suchen geholt
  var schirme = {};
  var verteiler = null;

  var PFEIL = '<svg width="17" height="10" viewBox="0 0 17 10" fill="none" aria-hidden="true">'
            + '<path d="M0 5h15M11 1l4 4-4 4" stroke="currentColor" stroke-width="1.6"/></svg>';

  /* Auf „Heute" bleibt die feste Kopfzeile leer: Die Wortmarke steht dort schon
     in der Ankunftszone, und zweimal „AzubiPass" übereinander sieht nach Fehler
     aus. Die Lupe daneben bleibt — sonst wäre die Suche von hier aus nicht mehr
     erreichbar, denn in der Leiste unten steht sie nicht. */
  var TITEL = { heute: "", lernen: "Lernfelder", ueben: "Üben",
                suche: "Suche", ich: "Ich" };

  /* ================================================== Rechnen auf dem Konto */

  function kapitelFertig(lfId, kapId) {
    var f = stand.fortschritt[lfId + "-" + kapId];
    return !!(f && f.fertig);
  }

  function lernfeldstand(lf) {
    var fertig = lf.kapitel.filter(function (k) { return kapitelFertig(lf.id, k.id); }).length;
    return { fertig: fertig, gesamt: lf.kapitel.length,
             anteil: lf.kapitel.length ? fertig / lf.kapitel.length : 0 };
  }

  function gesamtstand() {
    var fertig = 0, gesamt = 0;
    inhalt.lernfelder.forEach(function (lf) {
      var s = lernfeldstand(lf);
      fertig += s.fertig; gesamt += s.gesamt;
    });
    return { fertig: fertig, gesamt: gesamt, anteil: gesamt ? fertig / gesamt : 0 };
  }

  function faelligeKarten() {
    return inhalt.karten.filter(function (k) {
      return Object.prototype.hasOwnProperty.call(stand.karten, k.id) &&
             AP.istFaellig(k.id);
    });
  }

  function neueKarten() {
    return inhalt.karten.filter(function (k) {
      return !Object.prototype.hasOwnProperty.call(stand.karten, k.id);
    });
  }

  /* Alle Kapitel in einer Reihe, in der Reihenfolge, in der sie auch unter
     „Lernen" stehen. Einmal gerechnet und nicht bei jedem Aufruf neu: Der
     Startbildschirm fragt gleich dreimal danach. */
  var kapitelreihe = null;

  function alleKapitel() {
    if (kapitelreihe) return kapitelreihe;
    kapitelreihe = [];
    inhalt.lernfelder.forEach(function (lf) {
      lf.kapitel.forEach(function (k) {
        kapitelreihe.push({
          schluessel: lf.id + "-" + k.id,
          lernfeld: lf.id, lernfeldTitel: lf.titel,
          kapitel: k.id, nummer: k.nummer, titel: k.titel,
          zu: lf.seite + "#" + k.id
        });
      });
    });
    return kapitelreihe;
  }

  /* Welches Kapitel ist an der Reihe?

     Die eine Stelle, die das entscheidet. Vorher stand die Antwort im Konto —
     in stand.zuletzt lagen Titel und Nummer als Text, geschrieben zu dem
     Zeitpunkt, als das Kapitel zuletzt offen war. Wird ein Kapitel umbenannt
     oder verschwindet es, zeigte der Startbildschirm ins Leere.

     Deshalb liefert das Konto hier nur noch den Verweis. Alles, was angezeigt
     wird, kommt aus inhalt.lernfelder.

     art sagt, welcher der fünf Fälle es geworden ist — daran hängt die
     Beschriftung des Knopfes. */
  function lernziel() {
    var reihe = alleKapitel();
    if (!reihe.length) return null;

    function offen(k) { return !kapitelFertig(k.lernfeld, k.kapitel); }

    var z = stand.zuletzt;
    var stelle = -1;
    if (z && z.zu) {
      // kapitel steht erst seit dem einen Konto drin; bei übernommenen
      // Altbeständen muss die Kennung aus der Adresse kommen.
      var kapId = z.kapitel ||
        String(z.zu).split("#")[1] || "";
      stelle = reihe.map(function (k) { return k.schluessel; })
                    .indexOf(z.lernfeld + "-" + kapId);
    }

    if (stelle >= 0 && offen(reihe[stelle])) {
      return zielAus(reihe[stelle], "fortsetzen");
    }

    // Zuletzt gelesenes Kapitel ist durch: ab dort weitersuchen.
    if (stelle >= 0) {
      for (var i = stelle + 1; i < reihe.length; i++) {
        if (offen(reihe[i])) return zielAus(reihe[i], "naechstes");
      }
    }

    // Ohne eigenen Verlauf gibt es keine sinnvolle Empfehlung. Der erste
    // Besuch führt deshalb zur freien Themenwahl statt stillschweigend in LF1.
    if (!z || !z.zu) {
      return { art: "wahl", zu: "app.html#lernen", titel: "Wähle dein aktuelles Thema",
               lernfeld: null, wo: "Dein erster Schritt", knopf: "Thema auswählen" };
    }

    // Ungültiger Verweis oder hinten angekommen: das erste offene Kapitel
    // überhaupt. Ein beschädigter alter Verweis darf die App nicht zerlegen.
    for (var j = 0; j < reihe.length; j++) {
      if (offen(reihe[j])) {
        return zielAus(reihe[j], stelle >= 0 ? "naechstes"
                                : gesamtstand().fertig ? "naechstes" : "erstes");
      }
    }

    return { art: "fertig", zu: "app.html#ueben", titel: "Alle Kapitel durch.",
             wo: "", knopf: "Prüfungstraining öffnen" };
  }

  var KNOPFTEXT = { fortsetzen: "Kapitel fortsetzen", erstes: "Erstes Kapitel starten",
                    naechstes: "Nächstes Kapitel starten" };

  function zielAus(k, art) {
    return {
      art: art, zu: k.zu, titel: k.titel, lernfeld: k.lernfeld,
      wo: k.lernfeld.toUpperCase() + " · Kapitel " + k.nummer,
      knopf: KNOPFTEXT[art]
    };
  }

  /* ================================================== Prüfungstermin

     Nur ein bewusst gesetzter eigener Termin steuert den persönlichen
     Countdown. Ein unbrauchbarer Wert — von Hand in der Sicherungsdatei
     verstellt oder aus einer alten Fassung übrig — wird ignoriert, statt den
     Countdown zu zerlegen. */
  function pruefungsdatum() {
    if (AP.istDatum(stand.pruefungstermin)) return stand.pruefungstermin;
    return null;
  }

  /* In landing.config.json steht „AP2 · schriftliche Prüfung am 24. und 25.
     November 2026". Für die Kopfzeile ist das zu lang, die blanke Abkürzung
     aber zu wenig: „AP2" allein weiß im ersten Ausbildungsjahr niemand. Also
     ausgeschrieben — die Langform steht ohnehin unter „Ich". */
  var AUSGESCHRIEBEN = { AP1: "Abschlussprüfung Teil 1", AP2: "Abschlussprüfung Teil 2" };

  function pruefungsname() {
    var name = inhalt.pruefungName || "Abschlussprüfung";
    var kurz = name.split("·")[0].trim();
    return AUSGESCHRIEBEN[kurz] || kurz || name;
  }

  /* Countdown als fertiger Text. Eine negative Tageszahl darf hier nicht
     herauskommen — „noch -12 Tage" ist keine Information, sondern ein Fehler
     mit Minuszeichen davor. */
  /* `kurz` ist derselbe Stand ohne den Prüfungsnamen — für die Kopfzeile eines
     Abschnitts, in der der Name schon darüber steht. */
  function countdown() {
    var datum = pruefungsdatum();
    if (!datum) return { text: "Prüfungstermin festlegen", kurz: "offen", handeln: true };
    var tage = AP.tageBis(datum);
    if (tage < 0) return { text: "Prüfungstermin aktualisieren", kurz: "vorbei", handeln: true };
    var rest = tage === 0 ? "heute" : tage === 1 ? "morgen" : "noch " + tage + " Tage";
    return { text: pruefungsname() + " · " + rest, kurz: rest, handeln: false };
  }

  /* Was saß nicht? Drei Quellen, die es längst gibt und die nie jemand
     ausgewertet hat: falsch angeklickte Checks im Kapitel, falsch beantwortete
     Übungsfragen und jedes „Weiß ich nicht" im Selbsttest. */
  function schwachstellen() {
    var raus = [];
    var nachId = {};
    inhalt.quiz.forEach(function (q) { nachId[q.id] = q; });
    inhalt.tests.forEach(function (t) { nachId[t.id] = t; });

    Object.keys(stand.fortschritt).forEach(function (schluessel) {
      var f = stand.fortschritt[schluessel];
      Object.keys(f.checks || {}).forEach(function (id) {
        if (f.checks[id].r === false && nachId[id]) {
          raus.push({ q: nachId[id], grund: "falsch beantwortet" });
        }
      });
      Object.keys(f.zuordnen || {}).forEach(function (id) {
        if (f.zuordnen[id].f > 0 && nachId[id]) {
          raus.push({ q: nachId[id], grund: f.zuordnen[id].f + "× daneben" });
        }
      });
      Object.keys(f.test || {}).forEach(function (id) {
        if (f.test[id].z === "luecke" && nachId[id]) {
          raus.push({ q: nachId[id], grund: "als Lücke gemerkt" });
        }
      });
    });

    Object.keys(stand.quiz || {}).forEach(function (id) {
      if (stand.quiz[id].r === false && nachId[id]) {
        raus.push({ q: nachId[id], grund: "im Üben daneben" });
      }
    });

    var gesehen = {};
    return raus.filter(function (e) {
      if (gesehen[e.q.id]) return false;
      gesehen[e.q.id] = true;
      return true;
    });
  }

  function wochentage() {
    var raus = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var s = AP.tagesschluessel(d);
      raus.push({ schluessel: s, heute: i === 0,
                  kurz: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()],
                  gelernt: stand.aktivitaet.indexOf(s) !== -1 });
    }
    return raus;
  }

  /* ================================================== Bausteine */

  /* Der Bereichskopf aus dem Designsystem: Mono-Augenbraue in Gold, Titel in
     Source Serif 4, Beitext in IBM Plex Sans, darunter über einer Haarlinie
     eine einzelne Standzeile. Dieselbe Ordnung wie auf Heute — dort heißt die
     Augenbraue „AZUBIPASS" und die Standzeile ist der Countdown. */
  function kopfzeile(titel, unter, augenbraue, standName, standWert) {
    var k = el("div", "schirm-kopf");
    if (augenbraue) k.appendChild(el("p", "schirm-augenbraue", augenbraue));
    k.appendChild(el("h1", null, titel));
    if (unter) k.appendChild(el("p", null, unter));
    if (standName) {
      var z = el("div", "schirm-stand");
      z.appendChild(el("span", null, standName));
      z.appendChild(el("b", null, standWert));
      k.appendChild(z);
    }
    return k;
  }

  function balken(anteil) {
    var m = el("div", "messlatte");
    var s = el("span");
    m.appendChild(s);
    requestAnimationFrame(function () { s.style.width = Math.round(anteil * 100) + "%"; });
    return m;
  }

  function zahlenfeld(wert, einheit, beschriftung, dringend) {
    var z = el("div", "zahl" + (dringend ? " dringend" : ""));
    var b = el("b", null, String(wert));
    if (einheit) b.appendChild(el("small", null, einheit));
    z.appendChild(b);
    z.appendChild(el("span", null, beschriftung));
    return z;
  }

  function reihe(ziel, aufbau) {
    var a = el("a", "reihe");
    a.href = ziel;
    aufbau(a);
    return a;
  }

  function leerkasten(text, knopftext, beiKlick) {
    var k = el("div", "leer");
    k.appendChild(el("p", null, text));
    if (knopftext) {
      var b = el("button", "start", knopftext);
      b.addEventListener("click", beiKlick);
      k.appendChild(b);
    }
    return k;
  }

  /* ================================================== Heute */

  /* Drei Zonen statt einer Kennzahlenwand.

     1 · Ankunft  füllt fast den ersten Schirm: Wortmarke, Countdown, das
                  Kapitel, ein Weg. Von Zone 2 bleibt unten ein Streifen
                  stehen — daran sieht man, dass die Seite weitergeht, ohne
                  dass es jemand hinschreiben muss.
     2 · Heute    höchstens eine zeitkritische Nebensache.
     3 · Stand    das Feld aus echten Kapitelstrichen und die Woche.

     Erst der Weg, dann die Pflicht, dann die Bilanz. Vorher stand die Bilanz
     oben und der Weg irgendwo dazwischen. */
  function zeigeHeute(s) {
    s.innerHTML = "";
    s.appendChild(zoneAnkunft());
    s.appendChild(zoneHeute());
    s.appendChild(zoneStand());
  }

  function zoneAnkunft() {
    var z = el("section", "hm-zone hm-ankunft");

    var kopf = el("div", "hm-kopf");
    kopf.appendChild(el("span", "hm-marke", "AzubiPass"));
    var cd = countdown();
    if (cd.handeln) {
      var knopf = el("a", "hm-zaehler hm-zaehler-handeln", cd.text);
      knopf.href = "app.html#ich";
      kopf.appendChild(knopf);
    } else {
      kopf.appendChild(el("span", "hm-zaehler", cd.text));
    }
    z.appendChild(kopf);

    var ziel = lernziel();
    var block = el("a", "hm-kapitel");
    block.href = ziel ? ziel.zu : "app.html#lernen";

    if (!ziel) {
      block.appendChild(el("div", "hm-was", "Noch keine Lernfelder gebaut."));
      z.appendChild(block);
      return z;
    }

    if (ziel.wo) block.appendChild(el("div", "hm-wo", ziel.wo));
    block.appendChild(el("h1", "hm-was", ziel.titel));
    var weg = el("span", "hm-weiter");
    weg.appendChild(el("span", null, ziel.knopf));
    weg.insertAdjacentHTML("beforeend", PFEIL);
    block.appendChild(weg);
    z.appendChild(block);
    return z;
  }

  function zoneHeute() {
    var z = el("section", "hm-zone hm-heute");
    var faellig = faelligeKarten();
    var neu = neueKarten();

    if (faellig.length) {
      var a = el("a", "hm-pflicht");
      a.href = "app.html#ueben";
      a.appendChild(el("span", "hm-lbl",
        faellig.length === 1 ? "1 Wiederholung wartet" : faellig.length + " Wiederholungen warten"));
      a.appendChild(el("span", "hm-wert", "Jetzt üben"));
      z.appendChild(a);
    } else if (neu.length) {
      var neue = el("a", "hm-pflicht");
      neue.href = "app.html#ueben";
      neue.appendChild(el("span", "hm-lbl",
        neu.length === 1 ? "1 neue Karte bereit" : neu.length + " neue Karten bereit"));
      neue.appendChild(el("span", "hm-wert", "Jetzt lernen"));
      z.appendChild(neue);
    } else {
      /* Kein toter Knopf. „Nichts fällig" ist eine Nachricht, keine Aufgabe —
         also sieht sie auch nicht aus wie eine. */
      var ruht = el("div", "hm-pflicht hm-ruht");
      ruht.appendChild(el("span", "hm-lbl", "Heute keine Wiederholungen fällig"));
      z.appendChild(ruht);
    }

    /* Die beiden Hinweise stehen bewusst hier und nicht über der Hauptaktion:
       Der eine erscheint genau einmal im Leben des Kontos, der andere nur auf
       manchen Geräten. Beide dürfen den Weg nach vorn nicht wegdrücken. */
    if (stand.uebernommen) {
      var hinweis = el("div", "meldung hm-meldung");
      hinweis.textContent = "Dein bisheriger Fortschritt aus den einzelnen Lernzetteln "
        + "wurde übernommen. Der Karteikartenstand fängt neu an — er hing vorher an der "
        + "Position im Stapel und war dadurch verrutscht.";
      z.appendChild(hinweis);
      stand.uebernommen = false;
      sichern();
    }
    z.appendChild(einbauhinweis());
    return z;
  }

  function zoneStand() {
    var z = el("section", "hm-zone hm-stand");
    var g = gesamtstand();

    z.appendChild(el("p", "hm-titelchen", "Wo du stehst"));

    /* Ein Strich je Kapitel, eine Reihe je Lernfeld — und zwar an der Stelle,
       an der das Kapitel wirklich steht. Der Entwurf füllte die Striche der
       Reihe nach auf: Wer in LF8 anfängt, sah seinen Fortschritt in LF1
       leuchten. Das ist keine Vereinfachung, das ist eine falsche Auskunft. */
    var feld = el("div", "hm-feld");
    feld.setAttribute("role", "img");
    feld.setAttribute("aria-label",
      "Fortschritt: " + g.fertig + " von " + g.gesamt + " Kapiteln abgeschlossen.");
    var lauf = 0;
    inhalt.lernfelder.forEach(function (lf) {
      var st = lernfeldstand(lf);
      var r = el("div", "hm-reihe" + (st.fertig === st.gesamt && st.gesamt ? " fertig" : ""));
      r.setAttribute("title", lf.titel + " · " + st.fertig + " von " + st.gesamt);
      r.appendChild(el("span", "hm-kuerzel", kuerzel(lf.id)));
      var striche = el("div", "hm-striche");
      lf.kapitel.forEach(function (k) {
        var fertig = kapitelFertig(lf.id, k.id);
        var strich = el("span", "hm-strich" + (fertig ? " voll" : ""));
        strich.setAttribute("title", "K" + k.nummer + " · " + k.titel
          + (fertig ? " · abgeschlossen" : ""));
        if (fertig) strich.style.setProperty("--i", lauf++);
        striche.appendChild(strich);
      });
      r.appendChild(striche);
      feld.appendChild(r);
    });
    z.appendChild(feld);

    var bilanz = el("p", "hm-bilanz");
    bilanz.appendChild(el("b", null, String(g.fertig)));
    bilanz.appendChild(document.createTextNode(
      " von " + g.gesamt + " Kapiteln abgeschlossen"));
    z.appendChild(bilanz);

    var woche = wochentage();
    var gelernt = woche.filter(function (t) { return t.gelernt; }).length;
    z.appendChild(el("p", "hm-titelchen", "Diese Woche"));
    var w7 = el("div", "hm-woche");
    woche.forEach(function (t) {
      var f = el("div", "hm-wtag" + (t.gelernt ? " gelernt" : "")
                                  + (t.heute ? " heute" : ""), t.kurz);
      f.setAttribute("title", t.schluessel + (t.gelernt ? " · gelernt" : ""));
      w7.appendChild(f);
    });
    z.appendChild(w7);
    z.appendChild(el("p", "hm-wnotiz", "An " + gelernt + " von 7 Tagen gelernt"));
    return z;
  }

  /* Das Kürzel vor einer Fortschrittsreihe. „LF1" bis „LF13" stehen so in der
     Kennung; die Buchführung heißt dort ausgeschrieben und wäre in der schmalen
     Spalte doppelt so breit wie die Striche daneben. Der volle Name hängt als
     Titel an der Reihe. */
  function kuerzel(id) {
    var lf = inhalt.lernfelder.filter(function (x) { return x.id === id; })[0];
    if (lf && lf.kurz) return lf.kurz;
    return /^lf\d+$/.test(id) ? id.toUpperCase() : id.slice(0, 4).toUpperCase();
  }

  function lernfeldName(id) {
    var lf = inhalt.lernfelder.filter(function (x) { return x.id === id; })[0];
    return lf ? lf.titel : id;
  }

  /* ================================================== Lernen */

  function zeigeLernen(s) {
    s.innerHTML = "";
    var g = gesamtstand();
    s.appendChild(kopfzeile("Lernfelder",
      "Alles an einem Ort. Dein Fortschritt zeigt dir, wo du weitermachst — "
      + "nicht, was du versäumt hast.",
      "Deine Ausbildung",
      "Gesamtfortschritt", g.fertig + " / " + g.gesamt + " Kapitel"));

    /* Wo es weitergeht, steht auf Heute — und ab jetzt auch hier, weil Lernen
       der Ort ist, an dem man sucht. Es ist dasselbe Lernfeld, nicht ein
       zweites Ergebnis: beide fragen lernziel(). */
    var ziel = lernziel();
    var hier = ziel ? ziel.lernfeld : null;

    /* Bewusst in der gewohnten Reihenfolge und nicht nach Fortschritt sortiert:
       Eine Liste, die ihre Reihenfolge ändert, muss man jedes Mal neu lesen. */
    var liste = el("ul", "liste-schlicht");
    inhalt.lernfelder.forEach(function (lf) {
      var st = lernfeldstand(lf);
      var li = el("li");
      var zeile = reihe(lf.seite, function (a) {
        var oben = el("div", "reihe-oben");
        oben.appendChild(el("span", "reihe-nr", kuerzel(lf.id)));
        oben.appendChild(el("span", "reihe-titel", lf.titel));
        oben.appendChild(el("span", "reihe-meta", st.fertig + " / " + st.gesamt));
        a.appendChild(oben);
        if (lf.id === hier) {
          a.appendChild(el("div", "reihe-hinweis", "Hier weitermachen"));
        }
        a.appendChild(balken(st.anteil));
      });
      if (lf.id === hier) zeile.classList.add("aktuell");
      li.appendChild(zeile);
      liste.appendChild(li);
    });
    s.appendChild(liste);
  }

  /* ================================================== Üben */

  var uebenAnsicht = "start";
  var kartenWahl = { lernfeld: "alle", anzahl: 10 };
  var vokabelWahl = { block: "alle", anzahl: 10, richtung: "en-de", modus: "karte" };
  /* Kapitelkennung aus der Adresse. Wird an die Probeklausur durchgereicht und
     danach vergessen — sonst käme sie beim nächsten Öffnen wieder hoch. */
  var pkVorwahl = null;

  function zeigeUeben(s) {
    s.innerHTML = "";
    if (uebenAnsicht === "karten") return uebenKarten(s);
    if (uebenAnsicht === "quiz") return uebenQuiz(s);
    if (uebenAnsicht === "schwach") return uebenSchwach(s);
    if (uebenAnsicht === "vokabeln") return uebenVokabeln(s);
    /* Die Probeklausur bringt ihre ganze Oberfläche selbst mit — hier steht nur
       der Eingang. Sie ist der wichtigste Prüfungsweg und deshalb die erste
       Zeile, aber kein eigener Reiter: Geübt wird geübt. */
    if (uebenAnsicht === "start" && window.APK && window.APK.laeuft()) {
      uebenAnsicht = "probeklausur";
    }
    if (uebenAnsicht === "probeklausur" && window.APK) {
      var mit = pkVorwahl;
      pkVorwahl = null;
      return window.APK.zeige(s, function () {
        uebenAnsicht = "start";
        /* Stand die Probeklausur in der Adresse, muss sie beim Zurückgehen auch
           wieder heraus — sonst landet ein Neuladen erneut in ihr, obwohl der
           Nutzer sie gerade verlassen hat. Der Verteiler zeichnet dann neu. */
        if (adresse(verteiler.jetzt()).unter) location.hash = "#ueben";
        else zeigeUeben(s);
      }, mit);
    }

    var faellig = faelligeKarten();
    var neu = neueKarten();
    var schwach = schwachstellen();
    s.appendChild(kopfzeile("Üben",
      "Prüf genau das, was du brauchst — oder halt einfach die Karten warm.",
      "Prüfungstraining",
      "Bestand", inhalt.karten.length + " Karten · " + inhalt.quiz.length + " Fragen"));

    function hin(ziel) {
      return function (ev) {
        ev.preventDefault();
        location.hash = "#ueben/" + ziel;
      };
    }

    /* Die Probeklausur ist der wichtigste Prüfungsweg und steht deshalb als
       eigene Fläche über der Liste — aber immer noch unter „Üben" und nicht
       als fünfter Reiter. Geübt wird geübt. */
    var pk = el("a", "pk-eingang");
    pk.href = "#ueben/probeklausur";
    pk.appendChild(el("span", "pk-eingang-braue", "Eigene Probeklausur"));
    pk.appendChild(el("strong", "pk-eingang-titel",
      "Stell dir deine nächste Klassenarbeit selbst."));
    pk.appendChild(el("span", "pk-eingang-text",
      "Kapitel wählen, Dauer festlegen, unter Zeit schreiben — mit Auswertung "
      + "nach Kapiteln."));
    var weg = el("span", "pk-eingang-weg");
    weg.appendChild(el("span", null, "Klausur zusammenstellen"));
    weg.insertAdjacentHTML("beforeend", PFEIL);
    pk.appendChild(weg);
    pk.addEventListener("click", hin("probeklausur"));
    s.appendChild(pk);

    var liste = el("ul", "liste-schlicht");
    var kartenTitel = faellig.length ? "Fällige Wiederholungen" : "Neue Karteikarten";
    var kartenWert = faellig.length
      ? faellig.length + " fällig" + (neu.length ? " · " + neu.length + " neu" : "")
      : neu.length ? neu.length + " neu" : "für heute durch";
    var vokabelGesamt = (inhalt.vokabeln || []).reduce(function (summe, b) {
      return summe + (b.vokabeln || []).length;
    }, 0);
    [["karten", kartenTitel, kartenWert],
     ["quiz", "Übungsfragen", inhalt.quiz.length + " Fragen"],
     ["schwach", "Deine Schwachstellen", schwach.length
        ? schwach.length + " offen" : "nichts offen"],
     ["vokabeln", "Englisch-Vokabeltrainer",
        vokabelGesamt ? vokabelGesamt + " Vokabeln" : "noch nicht angelegt"]
    ].forEach(function (e) {
      var li = el("li");
      var a = el("a", "reihe");
      a.href = "#ueben/" + e[0];
      var oben = el("div", "reihe-oben");
      oben.appendChild(el("span", "reihe-titel", e[1]));
      oben.appendChild(el("span", "reihe-meta", e[2]));
      a.appendChild(oben);
      a.addEventListener("click", hin(e[0]));
      li.appendChild(a);
      liste.appendChild(li);
    });
    s.appendChild(liste);
  }

  function zurueckZuUeben(s) {
    var b = el("button", "kn-neben", "‹ Übersicht");
    b.addEventListener("click", function () { location.hash = "#ueben"; });
    return b;
  }

  /* Der Trainer kommt aus dem Kern und rechnet mit dunklem Grund unter sich —
     im Lernzettel ist das der .trainer-Bereich. Hier stellt ihn die Insel. */
  function uebenKarten(s) {
    s.appendChild(zurueckZuUeben(s));
    s.appendChild(kopfzeile("Karteikarten", null));

    /* Eine Sitzung beginnt bewusst mit einer kleinen Auswahl. Der komplette
       Bestand bleibt erreichbar, aber niemand landet beim ersten Tipp in 139
       Karten. Fällige Wiederholungen stehen innerhalb der Auswahl immer vor
       neuen Karten. */
    function mischen(folge) {
      var raus = folge.slice();
      for (var i = raus.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tausch = raus[i];
        raus[i] = raus[j];
        raus[j] = tausch;
      }
      return raus;
    }

    function sitzung() {
      var basis = inhalt.karten.filter(function (k) {
        return kartenWahl.lernfeld === "alle" || k.lernfeld === kartenWahl.lernfeld;
      });
      var faellig = basis.filter(function (k) {
        return Object.prototype.hasOwnProperty.call(stand.karten, k.id)
          && AP.istFaellig(k.id);
      });
      var neu = basis.filter(function (k) {
        return !Object.prototype.hasOwnProperty.call(stand.karten, k.id);
      });
      var verfuegbar = mischen(faellig).concat(mischen(neu));
      /* Sind heute nur spätere Karten im Thema, darf der Trainer trotzdem
         starten und seine ehrliche „Für heute durch"-Ansicht zeigen. */
      if (!verfuegbar.length) verfuegbar = mischen(basis);
      if (kartenWahl.anzahl > 0) verfuegbar = verfuegbar.slice(0, kartenWahl.anzahl);
      return { karten: verfuegbar, basis: basis.length,
               faellig: faellig.length, neu: neu.length };
    }

    var wahl = el("div", "tr-wahl");
    wahl.appendChild(el("h3", null, "Deine Sitzung"));
    wahl.appendChild(el("p", "tr-wahl-text",
      "Wähle ein Thema und eine kurze Kartenzahl. Wiederholungen kommen zuerst."));
    var felder = el("div", "tr-wahl-felder");

    var thema = el("label", "tr-wahl-feld");
    thema.appendChild(el("span", null, "Thema"));
    var themaAuswahl = el("select");
    themaAuswahl.setAttribute("aria-label", "Thema für die Karteikartensitzung");
    themaAuswahl.appendChild(el("option", null, "Alle Lernfelder"));
    themaAuswahl.options[0].value = "alle";
    inhalt.lernfelder.forEach(function (lf) {
      var option = el("option", null, kuerzel(lf.id) + " · " + lf.titel);
      option.value = lf.id;
      themaAuswahl.appendChild(option);
    });
    themaAuswahl.value = kartenWahl.lernfeld;
    thema.appendChild(themaAuswahl);
    felder.appendChild(thema);

    var umfang = el("label", "tr-wahl-feld");
    umfang.appendChild(el("span", null, "Umfang"));
    var umfangAuswahl = el("select");
    umfangAuswahl.setAttribute("aria-label", "Umfang der Karteikartensitzung");
    [[5, "5 Karten"], [10, "10 Karten"], [20, "20 Karten"],
     [0, "Alle passenden Karten"]].forEach(function (e) {
      var option = el("option", null, e[1]);
      option.value = String(e[0]);
      umfangAuswahl.appendChild(option);
    });
    umfangAuswahl.value = String(kartenWahl.anzahl);
    umfang.appendChild(umfangAuswahl);
    felder.appendChild(umfang);
    wahl.appendChild(felder);

    var info = el("p", "tr-wahl-info");
    info.setAttribute("aria-live", "polite");
    wahl.appendChild(info);
    var start = el("button", "kn-haupt", "Sitzung starten");
    wahl.appendChild(start);
    s.appendChild(wahl);

    var insel = el("div", "tr-insel");
    insel.hidden = true;
    var faecher = el("div", "tr-faecher");
    faecher.setAttribute("aria-label", "Verteilung auf die Fächer");
    var buehne = el("div", "tr-buehne");
    insel.appendChild(faecher);
    insel.appendChild(buehne);
    s.appendChild(insel);

    function aktualisieren() {
      var auswahl = sitzung();
      var heute = auswahl.faellig + " fällige Wiederholungen · "
        + auswahl.neu + " neue Karten";
      info.textContent = auswahl.basis
        ? (auswahl.faellig || auswahl.neu ? heute : "Heute ist in diesem Thema nichts fällig.")
        : "Für dieses Thema sind keine Karten hinterlegt.";
    }
    themaAuswahl.addEventListener("change", function () {
      kartenWahl.lernfeld = themaAuswahl.value;
      aktualisieren();
    });
    umfangAuswahl.addEventListener("change", function () {
      kartenWahl.anzahl = Number(umfangAuswahl.value);
      aktualisieren();
    });
    start.addEventListener("click", function () {
      wahl.hidden = true;
      insel.hidden = false;
      AP.trainer(buehne, faecher, sitzung().karten);
    });
    aktualisieren();
  }

  function uebenVokabeln(s) {
    s.appendChild(zurueckZuUeben(s));
    s.appendChild(kopfzeile("Englisch-Vokabeltrainer",
      "Englisch ab dem zweiten Lehrjahr — mit Grundwortschatz und eigenen Testblöcken."));

    var bloecke = inhalt.vokabeln || [];
    function pool() {
      var raus = [];
      bloecke.forEach(function (block) {
        if (vokabelWahl.block !== "alle" && vokabelWahl.block !== "fehler" &&
            vokabelWahl.block !== block.id) return;
        (block.vokabeln || []).forEach(function (v) {
          if (vokabelWahl.block === "fehler" && !fehlerhaft(v)) return;
          raus.push({
            id: v.id, en: v.en, de: v.de, beispiel: v.beispiel,
            hinweis: v.hinweis, alternativen: v.alternativen || [],
            blockTitel: block.titel, blockId: block.id
          });
        });
      });
      return raus;
    }
    function mischen(folge) {
      var raus = folge.slice();
      for (var i = raus.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tausch = raus[i]; raus[i] = raus[j]; raus[j] = tausch;
      }
      return raus;
    }
    function bekannt(id) {
      return Object.prototype.hasOwnProperty.call(stand.vokabeln || {}, id);
    }
    function fehlerhaft(v) {
      return bekannt(v.id) && (vstand(v.id).fehler || 0) > 0;
    }
    function vstand(id) {
      if (!stand.vokabeln) stand.vokabeln = {};
      return stand.vokabeln[id] || { fach: 1, faellig: AP.tagesschluessel(), fehler: 0 };
    }
    function faellig(v) {
      return bekannt(v.id) && AP.tageBis(vstand(v.id).faellig) <= 0;
    }
    function sitzung() {
      var alle = pool();
      var wiederholen = alle.filter(faellig);
      var neu = alle.filter(function (v) { return !bekannt(v.id); });
      var raus = mischen(wiederholen).concat(mischen(neu));
      if (!raus.length) raus = mischen(alle);
      return vokabelWahl.anzahl > 0 ? raus.slice(0, vokabelWahl.anzahl) : raus;
    }

    var wahl = el("div", "tr-wahl voc-wahl");
    wahl.appendChild(el("h3", null, "Deine Vokabelsitzung"));
    wahl.appendChild(el("p", "tr-wahl-text",
      "Wähle einen Block, die Abfragerichtung und eine kurze Sitzung. Falsche Wörter kommen am Ende noch einmal."));
    var felder = el("div", "tr-wahl-felder voc-wahl-felder");

    function auswahlFeld(titel, aria, optionen, wert, beiAenderung) {
      var label = el("label", "tr-wahl-feld");
      label.appendChild(el("span", null, titel));
      var select = el("select");
      select.setAttribute("aria-label", aria);
      optionen.forEach(function (e) {
        var option = el("option", null, e[1]);
        option.value = String(e[0]);
        select.appendChild(option);
      });
      select.value = String(wert);
      select.addEventListener("change", function () {
        beiAenderung(select.value);
        aktualisieren();
      });
      label.appendChild(select);
      felder.appendChild(label);
      return select;
    }

    var fehlerGesamt = pool().filter(fehlerhaft).length;
    var blockOptionen = [["alle", "Alle Vokabelblöcke"]];
    blockOptionen.push(["fehler", "Meine Fehler (" + fehlerGesamt + ")"]);
    bloecke.forEach(function (b) {
      blockOptionen.push([b.id, b.titel + " (" + (b.vokabeln || []).length + ")"]);
    });
    auswahlFeld("Block", "Vokabelblock", blockOptionen, vokabelWahl.block,
      function (v) { vokabelWahl.block = v; });
    auswahlFeld("Richtung", "Abfragerichtung",
      [["en-de", "Englisch → Deutsch"], ["de-en", "Deutsch → Englisch"]],
      vokabelWahl.richtung, function (v) { vokabelWahl.richtung = v; });
    auswahlFeld("Modus", "Abfragemodus",
      [["karte", "Karteikarte"], ["eingabe", "Eingabe"]],
      vokabelWahl.modus, function (v) { vokabelWahl.modus = v; });
    auswahlFeld("Umfang", "Umfang der Vokabelsitzung",
      [[5, "5 Vokabeln"], [10, "10 Vokabeln"], [20, "20 Vokabeln"],
       [0, "Alle passenden Vokabeln"]],
      vokabelWahl.anzahl, function (v) { vokabelWahl.anzahl = Number(v); });

    var info = el("p", "tr-wahl-info");
    info.setAttribute("aria-live", "polite");
    wahl.appendChild(felder);
    wahl.appendChild(info);
    var start = el("button", "kn-haupt", "Sitzung starten");
    wahl.appendChild(start);
    s.appendChild(wahl);

    var insel = el("div", "tr-insel");
    insel.hidden = true;
    var buehne = el("div", "tr-buehne");
    insel.appendChild(buehne);
    s.appendChild(insel);

    function aktualisieren() {
      var alle = pool();
      var wiederholen = alle.filter(faellig).length;
      var neu = alle.filter(function (v) { return !bekannt(v.id); }).length;
      var fehler = alle.filter(fehlerhaft).length;
      info.textContent = alle.length
        ? wiederholen + " fällige Wiederholungen · " + neu + " neue Vokabeln"
          + (fehler ? " · " + fehler + " mit Fehlern" : "")
        : "Für diesen Block sind keine Vokabeln hinterlegt.";
      start.disabled = !alle.length;
    }

    start.addEventListener("click", function () {
      var karten = sitzung();
      if (!karten.length) return;
      wahl.hidden = true;
      insel.hidden = false;
      var pos = 0;

      function normalisieren(wort) {
        return String(wort || "").toLocaleLowerCase("de-DE")
          .replace(/[.,!?]/g, "").replace(/\s+/g, " ").trim();
      }
      function bewerten(v, gewusst) {
        var f = vstand(v.id);
        if (gewusst) f.fach = Math.min(f.fach + 1, AP.FAECHER);
        else { f.fach = 1; f.fehler = (f.fehler || 0) + 1; karten.push(v); }
        f.faellig = AP.plusTage(AP.WARTEN[f.fach - 1]);
        stand.vokabeln[v.id] = f;
        AP.heuteGelernt();
        sichern();
        pos++;
        zeichnen();
      }
      function bewertungsreihe(v, echo) {
        var reihe = el("div", "tr-urteil");
        var nochmal = el("button", "tr-nochmal", "Nochmal");
        var gewusst = el("button", "tr-gewusst", "Wusste ich");
        nochmal.addEventListener("click", function () { bewerten(v, false); });
        gewusst.addEventListener("click", function () { bewerten(v, true); });
        reihe.appendChild(nochmal); reihe.appendChild(gewusst);
        echo.appendChild(reihe);
        gewusst.focus({ preventScroll: true });
      }
      function zeichnen() {
        buehne.innerHTML = "";
        if (pos >= karten.length) {
          buehne.appendChild(leerkasten("Sitzung abgeschlossen.",
            "Neue Sitzung wählen", function () {
              wahl.hidden = false; insel.hidden = true; aktualisieren();
            }));
          return;
        }
        var v = karten[pos];
        var frage = vokabelWahl.richtung === "en-de" ? v.en : v.de;
        var antwort = vokabelWahl.richtung === "en-de" ? v.de : v.en;
        var antworten = [antwort].concat(v.alternativen || []);
        var seite = el("div", "tr-seite");
        seite.appendChild(el("div", "tr-herkunft",
          v.blockTitel + " · " + (pos + 1) + " von " + karten.length));
        seite.appendChild(el("p", "tr-frage", frage));
        if (vokabelWahl.modus === "eingabe") {
          var eingabe = el("input", "voc-eingabe");
          eingabe.type = "text"; eingabe.autocomplete = "off";
          eingabe.setAttribute("aria-label", "Deine Übersetzung");
          var pruefen = el("button", "dreher", "Antwort prüfen");
          var echo = el("div", "voc-echo");
          pruefen.addEventListener("click", function () {
            pruefen.disabled = true; eingabe.disabled = true;
            var richtig = antworten.some(function (a) {
              return normalisieren(eingabe.value) === normalisieren(a);
            });
            echo.className = "voc-echo " + (richtig ? "richtig" : "falsch");
            echo.appendChild(el("b", null, richtig ? "Richtig." : "Noch einmal."));
            echo.appendChild(document.createTextNode(" Lösung: " + antwort));
            if (v.alternativen && v.alternativen.length) {
              echo.appendChild(document.createTextNode(" / " + v.alternativen.join(" / ")));
            }
            if (v.beispiel) echo.appendChild(mkEl("p", null, v.beispiel));
            if (v.hinweis) echo.appendChild(el("p", "voc-hinweis", "Hinweis: " + v.hinweis));
            bewertungsreihe(v, echo);
          });
          seite.appendChild(eingabe); seite.appendChild(pruefen); seite.appendChild(echo);
          eingabe.focus({ preventScroll: true });
        } else {
          var zeigen = el("button", "dreher", "Antwort zeigen");
          zeigen.addEventListener("click", function () {
            var hinten = el("div", "tr-antwort");
            hinten.appendChild(el("div", "bk", "Übersetzung"));
            hinten.appendChild(el("p", null, antwort));
            if (v.alternativen && v.alternativen.length) {
              hinten.appendChild(el("p", "voc-alternativen",
                "Auch möglich: " + v.alternativen.join(" · ")));
            }
            if (v.beispiel) hinten.appendChild(mkEl("p", "voc-beispiel", v.beispiel));
            if (v.hinweis) hinten.appendChild(el("p", "voc-hinweis", "Hinweis: " + v.hinweis));
            zeigen.remove(); seite.appendChild(hinten);
            requestAnimationFrame(function () { hinten.classList.add("da"); });
            bewertungsreihe(v, hinten);
          });
          seite.appendChild(zeigen);
          zeigen.focus({ preventScroll: true });
        }
        buehne.appendChild(seite);
      }
      zeichnen();
    });
    aktualisieren();
  }

  /* Der Übungsteil greift die Checks und Zuordnungen auf, die in den Kapiteln
     stehen. Absichtlich getrennt vom Kapitelstand gespeichert: Im Kapitel ist
     eine Frage einmal beantwortet und bleibt es, hier soll man sie beliebig oft
     wiederholen können. */
  function uebenQuiz(s) {
    s.appendChild(zurueckZuUeben(s));
    s.appendChild(kopfzeile("Übungsfragen", null));
    var buehne = el("div");
    s.appendChild(buehne);

    function mischen(folge) {
      for (var i = folge.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tausch = folge[i];
        folge[i] = folge[j];
        folge[j] = tausch;
      }
      return folge;
    }

    var reihenfolge = mischen(inhalt.quiz.slice());
    var pos = 0;

    function naechste() {
      buehne.innerHTML = "";
      if (pos >= reihenfolge.length) {
        buehne.appendChild(leerkasten("Alle Fragen einmal durch.", "Noch einmal mischen",
          function () { pos = 0; mischen(reihenfolge); naechste(); }));
        return;
      }
      var q = reihenfolge[pos];
      var kasten = el("div", "check");
      kasten.appendChild(el("div", "check-kopf",
        (pos + 1) + " von " + reihenfolge.length + " · " + q.lernfeldTitel));
      kasten.appendChild(mkEl("p", "check-frage", q.frage));

      if (q.art === "check") frageCheck(kasten, q, weiter);
      else frageZuordnen(kasten, q, weiter);
      buehne.appendChild(kasten);
    }

    function weiter() {
      var reihe2 = el("div", "knopfreihe");
      var w = el("button", "kn-haupt", "Nächste Frage");
      w.addEventListener("click", function () { pos++; naechste(); });
      var hin = el("a", "kn-neben");
      hin.href = reihenfolge[pos].zu;
      hin.textContent = "Im Kapitel nachlesen";
      reihe2.appendChild(w);
      reihe2.appendChild(hin);
      buehne.querySelector(".check").appendChild(reihe2);
      w.focus({ preventScroll: true });
    }

    function merke(id, richtig) {
      var e = stand.quiz[id] || { n: 0 };
      e.n++; e.r = richtig;
      stand.quiz[id] = e;
      AP.heuteGelernt();
      sichern();
    }

    function frageCheck(kasten, q, fertig) {
      var opts = el("div", "optionen");
      var echo = el("p", "check-echo");
      echo.setAttribute("role", "status");
      mischen(q.optionen.slice()).forEach(function (o) {
        var b = el("button", "opt");
        if (o.id) b.dataset.optionId = o.id;
        b.dataset.optionIndex = String(q.optionen.indexOf(o));
        b.innerHTML = AP.mk(o.text);
        b.addEventListener("click", function () {
          opts.querySelectorAll(".opt").forEach(function (x) { x.disabled = true; });
          b.classList.add(o.richtig ? "richtig" : "falsch");
          if (!o.richtig) {
            Array.prototype.slice.call(opts.children).forEach(function (x) {
              var xId = x.dataset.optionId;
              var original = xId
                ? q.optionen.filter(function (y) { return y.id === xId; })[0]
                : q.optionen[Number(x.dataset.optionIndex)];
              /* Alte Inhaltsdateien hatten noch keine IDs. In diesem Fall
                 reicht die sichtbare Beschriftung als Fallback. */
              if (!original) original = q.optionen.filter(function (y) {
                return AP.mk(y.text).replace(/<[^>]+>/g, "") === x.textContent;
              })[0];
              var richtig = original && original.richtig;
              if (richtig) x.classList.add("richtig");
            });
          }
          echo.textContent = o.echo;
          echo.classList.add("da");
          merke(q.id, !!o.richtig);
          fertig();
        });
        opts.appendChild(b);
      });
      kasten.appendChild(opts);
      kasten.appendChild(echo);
    }

    function frageZuordnen(kasten, q, fertig) {
      var offen = q.aufgaben.length, daneben = 0;
      q.aufgaben.forEach(function (a) {
        var r = el("div", "zu-reihe");
        r.appendChild(mkEl("span", "zu-text", a.text));
        var kn = el("span", "zu-knoepfe");
        q.kategorien.forEach(function (kat) {
          var b = el("button", "zu-btn", kat);
          b.addEventListener("click", function () {
            kn.querySelectorAll(".zu-btn").forEach(function (x) { x.disabled = true; });
            var ok = kat === a.loesung;
            b.classList.add(ok ? "richtig" : "falsch");
            if (!ok) {
              kn.querySelectorAll(".zu-btn").forEach(function (x) {
                if (x.textContent === a.loesung) x.classList.add("richtig");
              });
              daneben++;
            }
            if (--offen === 0) { merke(q.id, daneben === 0); fertig(); }
          });
          kn.appendChild(b);
        });
        r.appendChild(kn);
        kasten.appendChild(r);
      });
    }

    naechste();
  }

  function uebenSchwach(s) {
    s.appendChild(zurueckZuUeben(s));
    var liste = schwachstellen();
    s.appendChild(kopfzeile("Deine Schwachstellen",
      liste.length ? "Was du falsch hattest oder nicht wusstest — aus Kapiteln, "
                     + "Übungen und Selbsttests zusammengetragen."
                   : null));

    if (!liste.length) {
      s.appendChild(leerkasten(
        "Noch nichts daneben — oder noch nichts beantwortet. Sobald du eine "
        + "Übungsfrage falsch hast oder im Selbsttest „Weiß ich nicht" + "“"
        + " drückst, steht sie hier.",
        "Übungsfragen starten",
        function () { location.hash = "#ueben/quiz"; }));
      return;
    }

    var ul = el("ul", "liste-schlicht");
    liste.forEach(function (e) {
      var li = el("li");
      li.appendChild(reihe(e.q.zu, function (a) {
        var oben = el("div", "reihe-oben");
        oben.appendChild(el("span", "reihe-titel", AP.mk(e.q.frage).replace(/<[^>]+>/g, "")));
        a.appendChild(oben);
        a.appendChild(el("div", "reihe-quelle",
          e.q.lernfeldTitel + " · " + e.q.kapitel + " · " + e.grund));
      }));
      ul.appendChild(li);
    });
    s.appendChild(ul);
  }

  /* ================================================== Suche */

  function zeigeSuche(s) {
    if (s.dataset.gebaut) { s.querySelector("input").focus({ preventScroll: true }); return; }
    s.dataset.gebaut = "1";
    s.appendChild(kopfzeile("Suche", "Über alle Lernfelder, Begriffe und Paragraphen."));

    var feld = el("div", "suchfeld");
    feld.insertAdjacentHTML("beforeend",
      '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">'
      + '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.6"/>'
      + '<path d="M16.3 16.3 21 21" stroke="currentColor" stroke-width="1.6" '
      + 'stroke-linecap="round"/></svg>');
    var eingabe = el("input");
    eingabe.type = "search";
    eingabe.placeholder = "Zahlungsverzug, § 377 HGB, Skonto …";
    eingabe.setAttribute("aria-label", "Suchbegriff");
    feld.appendChild(eingabe);
    s.appendChild(feld);

    var zahl = el("p", "such-zahl");
    s.appendChild(zahl);
    var raus = el("div");
    s.appendChild(raus);

    function vorschlaege() {
      raus.innerHTML = "";
      raus.appendChild(el("div", "abschnittstitel", "Häufig gebraucht"));
      var ul = el("ul", "liste-schlicht");
      ["Zahlungsverzug", "Skonto", "Deckungsbeitrag", "§ 377 HGB", "DIN 5008"]
        .forEach(function (w) {
          var li = el("li");
          var a = el("a", "reihe");
          a.href = "#suche";
          a.appendChild(el("div", "reihe-titel", w));
          a.addEventListener("click", function (ev) {
            ev.preventDefault();
            eingabe.value = w;
            suchen();
          });
          li.appendChild(a);
          ul.appendChild(li);
        });
      raus.appendChild(ul);
    }

    function hervorheben(text, worte) {
      var e = el("span");
      var rest = text, teile = [];
      var muster = new RegExp("(" + worte.map(function (w) {
        return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }).join("|") + ")", "ig");
      rest.replace(muster, function (treffer, _g, index) {
        teile.push([index, treffer]);
        return treffer;
      });
      if (!teile.length) { e.textContent = text; return e; }
      var pos = 0;
      teile.forEach(function (t) {
        e.appendChild(document.createTextNode(text.slice(pos, t[0])));
        /* Eigene Klasse, nicht das nackte mark: Im Kapitel bedeutet mark
           „wichtige Aussage". Ein Suchtreffer bedeutet „hier steht dein Wort".
           Zwei Bedeutungen, zwei Flächen — sonst liest man das eine als das
           andere. */
        e.appendChild(el("mark", "such-treffer", t[1]));
        pos = t[0] + t[1].length;
      });
      e.appendChild(document.createTextNode(text.slice(pos)));
      return e;
    }

    function ausschnitt(text, wort) {
      var i = text.toLowerCase().indexOf(wort.toLowerCase());
      if (i < 0) return text.slice(0, 150) + (text.length > 150 ? " …" : "");
      var von = Math.max(0, i - 60);
      return (von ? "… " : "") + text.slice(von, von + 190)
             + (von + 190 < text.length ? " …" : "");
    }

    var laeuft = null;
    function suchen() {
      var frage = eingabe.value.trim();
      if (frage.length < 2) { zahl.textContent = ""; vorschlaege(); return; }
      if (!suchdaten) {
        zahl.textContent = "Suchindex wird geladen …";
        holeSuche().then(suchen);
        return;
      }

      var worte = frage.toLowerCase().split(/\s+/).filter(Boolean);
      var treffer = [];

      inhalt.begriffe.forEach(function (b) {
        var heu = (b.titel + " " + b.text).toLowerCase();
        if (worte.every(function (w) { return heu.indexOf(w) !== -1; })) {
          treffer.push({ art: "begriff", b: b,
                         rang: b.titel.toLowerCase().indexOf(worte[0]) === 0 ? 0 : 2 });
        }
      });

      suchdaten.forEach(function (e) {
        var heu = (e.t + " " + e.x).toLowerCase();
        if (worte.every(function (w) { return heu.indexOf(w) !== -1; })) {
          treffer.push({ art: "text", e: e,
                         rang: e.t.toLowerCase().indexOf(worte[0]) !== -1 ? 1 : 3 });
        }
      });

      treffer.sort(function (a, b) { return a.rang - b.rang; });
      zahl.textContent = treffer.length
        ? treffer.length + (treffer.length === 1 ? " Treffer" : " Treffer")
        : "Nichts gefunden.";

      raus.innerHTML = "";
      if (!treffer.length) {
        raus.appendChild(leerkasten(
          "Für „" + frage + "“ gibt es keinen Treffer. Vielleicht ein anderes "
          + "Wort — die Suche findet nur, was wörtlich vorkommt."));
        return;
      }

      var ul = el("ul", "liste-schlicht");
      treffer.slice(0, 60).forEach(function (t) {
        var li = el("li");
        if (t.art === "begriff") {
          li.appendChild(reihe("#suche", function (a) {
            var oben = el("div", "reihe-oben");
            oben.appendChild(el("span", "reihe-nr", t.b.art === "Begriff" ? "Begriff" : "Gesetz"));
            var titel = el("span", "reihe-titel");
            titel.appendChild(hervorheben(t.b.titel, worte));
            oben.appendChild(titel);
            a.appendChild(oben);
            a.appendChild(el("div", "reihe-quelle", t.b.text));
            a.addEventListener("click", function (ev) { ev.preventDefault(); });
          }));
        } else {
          li.appendChild(reihe(t.e.zu, function (a) {
            var oben = el("div", "reihe-oben");
            var titel = el("span", "reihe-titel");
            titel.appendChild(hervorheben(t.e.t, worte));
            oben.appendChild(titel);
            a.appendChild(oben);
            var aus = el("div", "reihe-quelle");
            aus.appendChild(hervorheben(ausschnitt(t.e.x, worte[0]), worte));
            a.appendChild(aus);
            a.appendChild(el("div", "reihe-quelle", t.e.lft + " · " + t.e.k));
          }));
        }
        ul.appendChild(li);
      });
      raus.appendChild(ul);
    }

    eingabe.addEventListener("input", function () {
      clearTimeout(laeuft);
      laeuft = setTimeout(suchen, 140);
    });
    vorschlaege();
    eingabe.focus({ preventScroll: true });
  }

  function holeSuche() {
    return fetch("mittel/suche.json")
      .then(function (a) { return a.json(); })
      .then(function (d) { suchdaten = d; })
      .catch(function () { suchdaten = []; });
  }

  /* ================================================== Ich */

  /* Ein Abschnitt unter „Ich": offener Block mit Haarlinie darüber, Mono-Titel
     links, optional eine Kennzahl rechts. Keine Karte, kein Schatten. */
  function feldgruppe(titel, wert) {
    var g = el("section", "feldgruppe");
    var h = el("h2");
    h.appendChild(el("span", null, titel));
    if (wert) h.appendChild(el("b", null, wert));
    g.appendChild(h);
    return g;
  }

  function probeklausurId(e) {
    return e && (e.id || [e.ende, e.seed, e.prozent].join("|"));
  }

  function probeklausurZeit(e) {
    if (!e) return 0;
    var t = Date.parse(e.aktualisiertAm || e.beendetAm || "");
    return isNaN(t) ? 0 : t;
  }

  function probeklausurProzent(e) {
    return e && typeof e.prozent === "number"
      ? String(e.prozent).replace(".", ",") + " %"
      : "—";
  }

  function zeitstempel(wert) {
    var t = Date.parse(wert || "");
    return isNaN(t) ? 0 : t;
  }

  function objekt(wert) {
    return wert && typeof wert === "object" && !Array.isArray(wert) ? wert : {};
  }

  function werteZusammenfuehren(lokal, fremd, fremdIstNeuer) {
    var alt = objekt(lokal), neu = objekt(fremd), raus = {};
    Object.keys(alt).forEach(function (id) { raus[id] = alt[id]; });
    Object.keys(neu).forEach(function (id) {
      if (!Object.prototype.hasOwnProperty.call(raus, id) || fremdIstNeuer) {
        raus[id] = neu[id];
      }
    });
    return raus;
  }

  function fortschrittZusammenfuehren(lokal, fremd, fremdIstNeuer) {
    var alt = objekt(lokal), neu = objekt(fremd);
    var raus = {
      ziele: Array.isArray(alt.ziele) ? alt.ziele.slice() : [],
      checks: werteZusammenfuehren(alt.checks, neu.checks, fremdIstNeuer),
      zuordnen: werteZusammenfuehren(alt.zuordnen, neu.zuordnen, fremdIstNeuer),
      test: werteZusammenfuehren(alt.test, neu.test, fremdIstNeuer),
      fertig: alt.fertig === true
    };
    (Array.isArray(neu.ziele) ? neu.ziele : []).forEach(function (ziel) {
      if (raus.ziele.indexOf(ziel) === -1) raus.ziele.push(ziel);
    });
    if (fremdIstNeuer && typeof neu.fertig === "boolean") raus.fertig = neu.fertig;
    else if (neu.fertig === true) raus.fertig = true;
    return raus;
  }

  function zeigeProbeklausuren(s) {
    var ergebnisse = Array.isArray(stand.probeklausuren)
      ? stand.probeklausuren.slice().sort(function (a, b) {
          return probeklausurZeit(b) - probeklausurZeit(a);
        })
      : [];
    var gruppe = feldgruppe("Probeklausuren", ergebnisse.length
      ? String(ergebnisse.length) : null);
    if (!ergebnisse.length) {
      gruppe.appendChild(leerkasten("Noch keine. Nach der Abgabe findest du die "
        + "Ergebnisse hier wieder — auch nach einem Neuladen."));
      s.appendChild(gruppe);
      return;
    }

    var liste = el("ul", "liste-schlicht");
    ergebnisse.forEach(function (e) {
      var li = el("li");
      var zeile = el("div", "reihe");
      var oben = el("div", "reihe-oben");
      oben.appendChild(el("span", "reihe-titel", "Probeklausur"));
      oben.appendChild(el("span", "reihe-meta", probeklausurProzent(e)));
      zeile.appendChild(oben);
      var datum = e && e.beendetAm ? new Date(e.beendetAm) : null;
      var datumText = datum && !isNaN(datum.getTime())
        ? datum.toLocaleDateString("de-DE") : "Datum unbekannt";
      var status = e && e.status === "abgeschlossen"
        ? "Abgeschlossen" : "Auswertung offen";
      var aufgaben = e && e.aufgaben ? e.aufgaben + " Aufgaben" : "";
      var kapitel = e && Array.isArray(e.kapitel) && e.kapitel.length
        ? e.kapitel.length + " Kapitel" : "";
      var details = [datumText, status, kapitel, aufgaben].filter(Boolean).join(" · ");
      zeile.appendChild(el("div", "reihe-quelle", details));
      li.appendChild(zeile);
      liste.appendChild(li);
    });
    gruppe.appendChild(liste);
    s.appendChild(gruppe);
  }

  function zeigeIch(s) {
    s.innerHTML = "";
    var g = gesamtstand();
    s.appendChild(kopfzeile("Ich",
      "Fortschritt, Prüfung und lokale Daten — ruhig und verständlich an einem Ort.",
      "Dein Bereich",
      "Insgesamt", Math.round(g.anteil * 100) + " %"));

    var standGruppe = feldgruppe("Dein Stand");
    var zahlen = el("div", "zahlenreihe");
    zahlen.appendChild(zahlenfeld(g.fertig, " / " + g.gesamt, "Kapitel geschafft"));
    zahlen.appendChild(zahlenfeld(
      Object.keys(stand.karten).filter(function (id) {
        return stand.karten[id].fach >= AP.FAECHER;
      }).length, " / " + inhalt.karten.length, "Karten sitzen"));
    standGruppe.appendChild(zahlen);
    s.appendChild(standGruppe);

    var lfGruppe = feldgruppe("Fortschritt je Lernfeld",
      inhalt.lernfelder.length + " Lernfelder");
    var ul = el("ul", "liste-schlicht");
    inhalt.lernfelder.forEach(function (lf) {
      var st = lernfeldstand(lf);
      var li = el("li");
      li.appendChild(reihe(lf.seite, function (a) {
        var oben = el("div", "reihe-oben");
        oben.appendChild(el("span", "reihe-nr", kuerzel(lf.id)));
        oben.appendChild(el("span", "reihe-titel", lf.titel));
        oben.appendChild(el("span", "reihe-meta", Math.round(st.anteil * 100) + " %"));
        a.appendChild(oben);
        a.appendChild(balken(st.anteil));
      }));
      ul.appendChild(li);
    });
    lfGruppe.appendChild(ul);
    s.appendChild(lfGruppe);

    zeigeProbeklausuren(s);

    /* Lesezeichen */
    var lzGruppe = feldgruppe("Lesezeichen",
      stand.lesezeichen.length ? String(stand.lesezeichen.length) : null);
    if (!stand.lesezeichen.length) {
      lzGruppe.appendChild(leerkasten("Noch keine. Im Kapitel oben rechts auf das Zeichen "
        + "tippen, dann steht es hier."));
    } else {
      var lz = el("ul", "liste-schlicht");
      stand.lesezeichen.slice().reverse().forEach(function (e) {
        var li = el("li");
        li.appendChild(reihe(e.zu, function (a) {
          var oben = el("div", "reihe-oben");
          oben.appendChild(el("span", "reihe-titel", e.titel || e.zu));
          a.appendChild(oben);
          a.appendChild(el("div", "reihe-quelle", lernfeldName(e.lernfeld)));
        }));
        lz.appendChild(li);
      });
      lzGruppe.appendChild(lz);
    }
    s.appendChild(lzGruppe);

    /* Prüfungstermin */
    var termin = feldgruppe("Prüfungstermin", countdown().kurz);
    termin.appendChild(terminfeld());
    s.appendChild(termin);

    /* Sicherung */
    var daten = feldgruppe("Deine Daten", "nur auf diesem Gerät");
    var erklaerung = el("p", "leise-text");
    erklaerung.textContent = "Dein Lernstand liegt nur in diesem Browser. Löschst du die "
      + "Websitedaten oder wechselst das Gerät, ist er weg — außer du sicherst ihn hier.";
    daten.appendChild(erklaerung);

    var meldung = el("p", "meldung");
    var knoepfe = el("div", "knopfreihe-weit");

    var raus = el("button", "kn-haupt", "Fortschritt sichern");
    raus.addEventListener("click", function () { sichere(meldung); });

    var rein = el("button", "kn-neben breit", "Sicherung einspielen");
    var datei = el("input");
    datei.type = "file";
    datei.accept = "application/json,.json";
    datei.hidden = true;
    rein.addEventListener("click", function () { datei.click(); });
    datei.addEventListener("change", function () {
      if (datei.files && datei.files[0]) spieleEin(datei.files[0], meldung, s);
    });

    var weg = el("button", "kn-neben breit", "Alles zurücksetzen");
    weg.addEventListener("click", function () { zuruecksetzen(meldung, s); });

    knoepfe.appendChild(raus);
    knoepfe.appendChild(rein);
    knoepfe.appendChild(weg);
    knoepfe.appendChild(datei);
    daten.appendChild(knoepfe);
    daten.appendChild(meldung);
    s.appendChild(daten);

    /* Rechtsseiten als eigene Zeilen statt als zwei 19 px hohe Wörter mit
       einem Mittelpunkt dazwischen: Am Handy trifft man das nicht. */
    var rechts = el("div", "rechtswege");
    [["impressum.html", "Impressum"],
     ["datenschutz.html", "Datenschutz"]].forEach(function (r) {
      var a = el("a", null, r[1]);
      a.href = r[0];
      rechts.appendChild(a);
    });
    s.appendChild(rechts);

    var gebaut = el("p", "reihe-quelle");
    gebaut.textContent = "Inhalt vom " + (inhalt.gebaut || "").slice(0, 10).split("-").reverse().join(".");
    s.appendChild(gebaut);
  }

  /* Schreibt der Browser überhaupt? Im privaten Modus mancher Browser und bei
     gesperrtem Speicher schluckt kern.js den Fehler, damit die App weiterläuft.
     Für diesen Abschnitt reicht das nicht: Wer „Termin speichern" drückt, muss
     erfahren, wenn nichts gespeichert wurde. */
  function speicherGeht() {
    try {
      localStorage.setItem("azubipass:probe", "1");
      localStorage.removeItem("azubipass:probe");
      return true;
    } catch (e) {
      return false;
    }
  }

  /* Der eigene Prüfungstermin. Kein zweiter Speicherschlüssel, keine Migration:
     Das Feld liegt im selben Konto wie alles andere und wird deshalb von der
     Sicherung automatisch mitgenommen. */
  function terminfeld() {
    var box = el("div", "stellreihe stellreihe-block");
    var links = el("div");
    links.appendChild(el("b", null, "Prüfungstermin"));
    links.appendChild(el("small", null,
      "Nur ein eigener Termin erscheint als Countdown auf „Heute“. "
      + "Er bleibt nur auf diesem Gerät gespeichert."));
    if (!stand.pruefungstermin && AP.istDatum(inhalt.pruefung)) {
      links.appendChild(el("small", null,
        "Es ist noch kein persönlicher Termin gesetzt. Der Inhalt nennt als "
        + "Orientierung den " + AP.datumsformat.format(new Date(inhalt.pruefung + "T12:00:00"))
        + "; er wird nicht automatisch als dein Countdown verwendet."));
    }

    var zeile = el("div", "terminzeile");
    var feld = el("input");
    feld.type = "date";
    feld.className = "terminfeld";
    feld.setAttribute("aria-label", "Dein Prüfungstermin");
    feld.value = AP.istDatum(stand.pruefungstermin) ? stand.pruefungstermin
                                                    : (pruefungsdatum() || "");

    var speichern = el("button", "kn-haupt", "Termin speichern");
    var zurueck = el("button", "kn-neben", "Termin entfernen");
    var echo = el("p", "meldung");
    echo.setAttribute("role", "status");

    function melden(text, fehler) {
      echo.className = "meldung" + (fehler ? " fehler" : "");
      echo.textContent = text;
    }

    speichern.addEventListener("click", function () {
      if (!AP.istDatum(feld.value)) {
        melden("Das ist kein gültiges Datum. Nichts geändert.", true);
        return;
      }
      stand.pruefungstermin = feld.value;
      sichern();
      var cd = countdown();
      melden(speicherGeht()
        ? "Termin gespeichert — auf „Heute“ steht jetzt: " + cd.text
        : "Termin gilt für diese Sitzung. Dein Browser lässt kein dauerhaftes "
          + "Speichern zu, beim nächsten Öffnen ist er wieder weg.",
        false);
    });

    zurueck.addEventListener("click", function () {
      stand.pruefungstermin = null;
      sichern();
      feld.value = "";
      melden("Persönlicher Countdown deaktiviert.", false);
    });

    zeile.appendChild(feld);
    zeile.appendChild(speichern);
    zeile.appendChild(zurueck);

    box.appendChild(links);
    box.appendChild(zeile);
    var huelle = el("div");
    huelle.appendChild(box);
    huelle.appendChild(echo);
    return huelle;
  }

  function sichere(meldung) {
    var text = JSON.stringify(stand, null, 1);
    var blob = new Blob([text], { type: "application/json" });
    var a = el("a");
    a.href = URL.createObjectURL(blob);
    a.download = "azubipass-fortschritt-" + AP.tagesschluessel() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    meldung.className = "meldung";
    meldung.textContent = "Gesichert. Leg die Datei irgendwohin, wo du sie wiederfindest — "
      + "mit ihr holst du deinen Stand auf jedes Gerät zurück.";
  }

  function spieleEin(datei, meldung, s) {
    var leser = new FileReader();
    leser.onload = function () {
      var neu;
      try { neu = JSON.parse(leser.result); } catch (e) { neu = null; }
      if (!neu || typeof neu !== "object" || !neu.fortschritt) {
        meldung.className = "meldung fehler";
        meldung.textContent = "Das sieht nicht nach einer AzubiPass-Sicherung aus. "
          + "Nichts geändert.";
        return;
      }
      var lokaleZeit = zeitstempel(stand.geaendertAm);
      var fremdeZeit = zeitstempel(neu.geaendertAm);
      var fremdeSicherungIstNeuer = fremdeZeit > lokaleZeit;
      /* Zusammenführen statt überschreiben: Wer auf zwei Geräten gelernt hat,
         soll nicht die Hälfte verlieren. Eine ältere Sicherung darf dabei
         keinen neueren Kapitelstand zurücksetzen. */
      Object.keys(neu.fortschritt || {}).forEach(function (k) {
        if (!stand.fortschritt[k]) {
          stand.fortschritt[k] = fortschrittZusammenfuehren({}, neu.fortschritt[k], true);
        } else {
          stand.fortschritt[k] = fortschrittZusammenfuehren(
            stand.fortschritt[k], neu.fortschritt[k], fremdeSicherungIstNeuer);
        }
      });
      Object.keys(neu.karten || {}).forEach(function (id) {
        var alt = stand.karten[id];
        if (!alt || (neu.karten[id].fach || 0) > (alt.fach || 0) ||
            ((neu.karten[id].fach || 0) === (alt.fach || 0) && fremdeSicherungIstNeuer)) {
          stand.karten[id] = neu.karten[id];
        }
      });
      Object.keys(neu.vokabeln || {}).forEach(function (id) {
        var alt = stand.vokabeln[id];
        if (!alt || (neu.vokabeln[id].fach || 0) > (alt.fach || 0) ||
            ((neu.vokabeln[id].fach || 0) === (alt.fach || 0) && fremdeSicherungIstNeuer)) {
          stand.vokabeln[id] = neu.vokabeln[id];
        }
      });
      stand.quiz = werteZusammenfuehren(stand.quiz, neu.quiz, fremdeSicherungIstNeuer);
      (neu.aktivitaet || []).forEach(function (t) {
        if (stand.aktivitaet.indexOf(t) === -1) stand.aktivitaet.push(t);
      });
      (neu.lesezeichen || []).forEach(function (e) {
        if (!stand.lesezeichen.some(function (x) { return x.zu === e.zu; })) {
          stand.lesezeichen.push(e);
        }
      });
      /* Klausurergebnisse gehören zum Konto und müssen deshalb beim
         Zusammenführen ebenfalls erhalten bleiben. Die laufende Klausur hat
         weiterhin ihren eigenen Schlüssel; hier liegen nur abgeschlossene
         Ergebniszusammenfassungen. */
      (Array.isArray(neu.probeklausuren) ? neu.probeklausuren : []).forEach(function (e) {
        if (!e || typeof e !== "object") return;
        var id = probeklausurId(e);
        var i = stand.probeklausuren.findIndex(function (x) {
          return probeklausurId(x) === id;
        });
        if (i < 0) {
          stand.probeklausuren.push(e);
          return;
        }
        var alt = stand.probeklausuren[i];
        var neuAbgeschlossen = e.status === "abgeschlossen";
        var altAbgeschlossen = alt && alt.status === "abgeschlossen";
        if ((neuAbgeschlossen && !altAbgeschlossen) ||
            probeklausurZeit(e) >= probeklausurZeit(alt)) {
          stand.probeklausuren[i] = e;
        }
      });
      if (stand.probeklausuren.length > 50) stand.probeklausuren = stand.probeklausuren.slice(0, 50);
      if (neu.zuletzt && (!stand.zuletzt || fremdeSicherungIstNeuer)) {
        stand.zuletzt = neu.zuletzt;
      }
      // Nur übernehmen, was der Countdown auch rechnen kann — sonst schleppt
      // eine alte Sicherung einen kaputten Termin ins frische Konto.
      if (AP.istDatum(neu.pruefungstermin) &&
          (!stand.pruefungstermin || fremdeSicherungIstNeuer)) {
        stand.pruefungstermin = neu.pruefungstermin;
      }
      sichern();
      meldung.className = "meldung";
      meldung.textContent = "Eingespielt und mit dem zusammengeführt, was schon hier war.";
      setTimeout(function () { zeigeIch(s); }, 900);
    };
    leser.readAsText(datei);
  }

  function zuruecksetzen(meldung, s) {
    if (!window.confirm("Wirklich alles zurücksetzen? Fortschritt, Karteikarten, "
        + "Lesezeichen und Notizen sind dann weg. Das lässt sich nicht rückgängig machen.")) {
      return;
    }
    var neu = AP.frisch();
    Object.keys(stand).forEach(function (k) { delete stand[k]; });
    Object.keys(neu).forEach(function (k) { stand[k] = neu[k]; });
    try { localStorage.removeItem(AP.SCHLUESSEL); } catch (e) {}
    if (AP.probeklausurZuruecksetzen) AP.probeklausurZuruecksetzen();
    sichern();
    meldung.className = "meldung";
    meldung.textContent = "Zurückgesetzt.";
    setTimeout(function () { zeigeIch(s); }, 600);
  }

  /* ================================================== Einbauen & Erneuern */

  var einbauEreignis = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    einbauEreignis = e;
    if (verteiler && location.hash.replace("#", "") === "heute") zeige("heute");
  });

  function amIPhone() {
    return /iPhone|iPad|iPod/.test(navigator.userAgent);
  }

  function eingebaut() {
    return window.matchMedia("(display-mode: standalone)").matches ||
           window.navigator.standalone === true;
  }

  function einbauhinweis() {
    var kasten = el("div", "einbau");
    if (eingebaut()) { kasten.hidden = true; return kasten; }

    if (einbauEreignis) {
      kasten.appendChild(el("p", null,
        "Leg AzubiPass auf den Startbildschirm — dann startet es ohne Browserleiste "
        + "und funktioniert auch ohne Netz."));
      var b = el("button", "start", "Installieren");
      b.addEventListener("click", function () {
        einbauEreignis.prompt();
        einbauEreignis = null;
      });
      kasten.appendChild(b);
    } else if (amIPhone()) {
      kasten.appendChild(el("p", null,
        "Tipp fürs iPhone: unten auf „Teilen“ und dann „Zum Home-Bildschirm“. "
        + "Danach läuft AzubiPass ohne Netz — und Safari räumt deinen Lernstand "
        + "nicht mehr nach sieben Tagen weg."));
    } else {
      kasten.hidden = true;
    }
    return kasten;
  }

  function erneuerung() {
    AP.sw().then(function (reg) {
      if (!reg) return;
      reg.addEventListener("updatefound", function () {
        var neu = reg.installing;
        if (!neu) return;
        neu.addEventListener("statechange", function () {
          if (neu.state === "installed" && navigator.serviceWorker.controller) {
            zeigeErneuerung(reg);
          }
        });
      });
    });

    if (!("serviceWorker" in navigator)) return;
    var laedtNeu = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (laedtNeu) return;
      laedtNeu = true;
      location.reload();
    });
  }

  /* Nicht mitten im Lesen austauschen — fragen. */
  function zeigeErneuerung(reg) {
    var k = el("div", "einbau");
    k.appendChild(el("p", null, "Es gibt eine neue Fassung der Lernzettel."));
    var b = el("button", "start", "Jetzt laden");
    b.addEventListener("click", function () {
      if (reg.waiting) reg.waiting.postMessage("uebernehmen");
    });
    k.appendChild(b);
    var ziel = document.getElementById("heute");
    ziel.insertBefore(k, ziel.firstChild);
  }

  /* ================================================== Verteiler */

  var bauer = { heute: zeigeHeute, lernen: zeigeLernen, ueben: zeigeUeben,
                suche: zeigeSuche, ich: zeigeIch };

  /* Die Adresse kann mehr sagen als den Bereich:

         #ueben/probeklausur?kapitel=buchfuehrung:k3

     Der Teil vor dem Schrägstrich ist der Schirm, dahinter steht, was dort
     geöffnet werden soll, und hinter dem Fragezeichen die Kapitelkennung.
     Alles hinter dem Schirm ist freiwillig — was nicht verstanden wird, fällt
     weg und es erscheint der gewohnte Bereich. Eine Adresse darf nie ein
     Fehlerbild erzeugen und nichts Gespeichertes anfassen. */
  function adresse(wunsch) {
    var roh = String(wunsch || "");
    var frage = roh.indexOf("?");
    var weg = (frage < 0 ? roh : roh.slice(0, frage)).split("/");
    var felder = {};
    if (frage >= 0) {
      roh.slice(frage + 1).split("&").forEach(function (paar) {
        var t = paar.split("=");
        if (t[0]) felder[t[0]] = decodeURIComponent((t[1] || "").replace(/\+/g, " "));
      });
    }
    return { bereich: weg[0] || "", unter: weg[1] || "", felder: felder };
  }

  function zeige(wunsch) {
    var teile = adresse(wunsch);
    var id = bauer[teile.bereich] ? teile.bereich : "heute";
    Object.keys(schirme).forEach(function (k) { schirme[k].hidden = k !== id; });
    document.querySelectorAll(".tab").forEach(function (t) {
      var an = t.getAttribute("href") === "app.html#" + id;
      t.classList.toggle("an", an);
      if (an) t.setAttribute("aria-current", "page");
      else t.removeAttribute("aria-current");
    });
    document.getElementById("kopfMeta").textContent = TITEL[id];
    /* Woran die CSS erkennt, welcher Schirm gerade dran ist. „Heute" trägt
       dadurch seine eigene dunkelgrüne Fläche — samt Kopf, Leiste und Fuß, die
       außerhalb des Schirms liegen und sonst hell dagegenstünden. */
    document.documentElement.dataset.bereich = id;
    /* Nur bekannte Unteradressen öffnen direkt eine Üben-Ansicht. Das nackte
       „#ueben" führt zur Übersicht; eine begonnene Klausur geht dabei nicht
       verloren, sondern liegt im Speicher und wird über den Eingang wieder
       angeboten. */
    if (id === "ueben" && teile.unter === "probeklausur") {
      uebenAnsicht = "probeklausur";
      pkVorwahl = teile.felder.kapitel || null;
    } else if (id === "ueben" &&
               ["karten", "quiz", "schwach", "vokabeln"].indexOf(teile.unter) >= 0) {
      uebenAnsicht = teile.unter;
      pkVorwahl = null;
      if (window.APK) window.APK.verlassen();
    } else {
      uebenAnsicht = "start";
      pkVorwahl = null;
      if (window.APK) window.APK.verlassen();
    }
    bauer[id](schirme[id]);
    if (teile.bereich === id) window.scrollTo(0, 0);
  }

  function start() {
    ["heute", "lernen", "ueben", "suche", "ich"].forEach(function (k) {
      schirme[k] = document.getElementById(k);
    });
    verteiler = AP.verteiler(zeige, "heute");
    erneuerung();
  }

  fetch("mittel/inhalt.json")
    .then(function (a) { return a.json(); })
    .then(function (d) { inhalt = d; start(); })
    .catch(function () {
      var h = document.getElementById("heute");
      h.appendChild(kopfzeile("Inhalt nicht gefunden",
        "mittel/inhalt.json ließ sich nicht laden. Wurde build_app.py schon "
        + "ausgeführt — und läuft die Seite über einen Server statt per Doppelklick?"));
    });
})();
