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
    return inhalt.karten.filter(function (k) { return AP.istFaellig(k.id); });
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

    // Ungültiger Verweis, gar kein Verweis, oder hinten angekommen:
    // das erste offene Kapitel überhaupt.
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
      art: art, zu: k.zu, titel: k.titel,
      wo: k.lernfeld.toUpperCase() + " · Kapitel " + k.nummer,
      knopf: KNOPFTEXT[art]
    };
  }

  /* ================================================== Prüfungstermin

     Der Termin aus landing.config.json gilt, bis jemand unter „Ich" einen
     eigenen einträgt. Ein unbrauchbarer Wert — von Hand in der Sicherungsdatei
     verstellt, aus einer alten Fassung übrig — fällt still auf den Standard
     zurück, statt den Countdown zu zerlegen. */
  function pruefungsdatum() {
    if (AP.istDatum(stand.pruefungstermin)) return stand.pruefungstermin;
    if (AP.istDatum(inhalt.pruefung)) return inhalt.pruefung;
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
  function countdown() {
    var datum = pruefungsdatum();
    if (!datum) return { text: "Prüfungstermin festlegen", handeln: true };
    var tage = AP.tageBis(datum);
    if (tage < 0) return { text: "Prüfungstermin aktualisieren", handeln: true };
    return {
      text: pruefungsname() + " · " + (tage === 0 ? "heute" : tage === 1 ? "morgen"
                                                 : "noch " + tage + " Tage"),
      handeln: false
    };
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

  function kopfzeile(titel, unter) {
    var k = el("div", "schirm-kopf");
    k.appendChild(el("h1", null, titel));
    if (unter) k.appendChild(el("p", null, unter));
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

    if (faellig.length) {
      var a = el("a", "hm-pflicht");
      a.href = "app.html#ueben";
      a.appendChild(el("span", "hm-lbl",
        faellig.length === 1 ? "1 Karte wartet" : faellig.length + " Karten warten"));
      a.appendChild(el("span", "hm-wert", "Jetzt üben"));
      z.appendChild(a);
    } else {
      /* Kein toter Knopf. „Nichts fällig" ist eine Nachricht, keine Aufgabe —
         also sieht sie auch nicht aus wie eine. */
      var ruht = el("div", "hm-pflicht hm-ruht");
      ruht.appendChild(el("span", "hm-lbl", "Heute keine Karteikarten fällig"));
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
      inhalt.lernfelder.length + " Lernfelder, " + g.gesamt + " Kapitel · "
      + g.fertig + " geschafft"));

    /* Bewusst in der gewohnten Reihenfolge und nicht nach Fortschritt sortiert:
       Eine Liste, die ihre Reihenfolge ändert, muss man jedes Mal neu lesen.
       Wo es weitergeht, steht auf dem Startbildschirm. */
    var liste = el("ul", "liste-schlicht");
    inhalt.lernfelder.forEach(function (lf) {
      var st = lernfeldstand(lf);
      var li = el("li");
      li.appendChild(reihe(lf.seite, function (a) {
        var oben = el("div", "reihe-oben");
        oben.appendChild(el("span", "reihe-nr", lf.id.toUpperCase()));
        oben.appendChild(el("span", "reihe-titel", lf.titel));
        oben.appendChild(el("span", "reihe-meta", st.fertig + "/" + st.gesamt));
        a.appendChild(oben);
        a.appendChild(balken(st.anteil));
      }));
      liste.appendChild(li);
    });
    s.appendChild(liste);
  }

  /* ================================================== Üben */

  var uebenAnsicht = "start";

  function zeigeUeben(s) {
    s.innerHTML = "";
    if (uebenAnsicht === "karten") return uebenKarten(s);
    if (uebenAnsicht === "quiz") return uebenQuiz(s);
    if (uebenAnsicht === "schwach") return uebenSchwach(s);

    var faellig = faelligeKarten();
    var schwach = schwachstellen();
    s.appendChild(kopfzeile("Üben",
      inhalt.karten.length + " Karteikarten und " + inhalt.quiz.length
      + " Übungsfragen aus allen Lernfeldern."));

    var liste = el("ul", "liste-schlicht");
    [["karten", "Fällige Karteikarten", faellig.length
        ? faellig.length + " warten" : "für heute durch"],
     ["quiz", "Übungsfragen", inhalt.quiz.length + " Fragen"],
     ["schwach", "Deine Schwachstellen", schwach.length
        ? schwach.length + " offen" : "nichts offen"]
    ].forEach(function (e) {
      var li = el("li");
      var a = el("a", "reihe");
      a.href = "#ueben";
      var oben = el("div", "reihe-oben");
      oben.appendChild(el("span", "reihe-titel", e[1]));
      oben.appendChild(el("span", "reihe-meta", e[2]));
      a.appendChild(oben);
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        uebenAnsicht = e[0];
        zeigeUeben(s);
      });
      li.appendChild(a);
      liste.appendChild(li);
    });
    s.appendChild(liste);
  }

  function zurueckZuUeben(s) {
    var b = el("button", "kn-neben", "‹ Übersicht");
    b.addEventListener("click", function () { uebenAnsicht = "start"; zeigeUeben(s); });
    return b;
  }

  /* Der Trainer kommt aus dem Kern und rechnet mit dunklem Grund unter sich —
     im Lernzettel ist das der .trainer-Bereich. Hier stellt ihn die Insel. */
  function uebenKarten(s) {
    s.appendChild(zurueckZuUeben(s));
    s.appendChild(kopfzeile("Karteikarten", null));
    var insel = el("div", "tr-insel");
    var faecher = el("div", "tr-faecher");
    faecher.setAttribute("aria-label", "Verteilung auf die Fächer");
    var buehne = el("div", "tr-buehne");
    insel.appendChild(faecher);
    insel.appendChild(buehne);
    s.appendChild(insel);
    AP.trainer(buehne, faecher, inhalt.karten);
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

    var reihenfolge = inhalt.quiz.slice().sort(function () { return Math.random() - 0.5; });
    var pos = 0;

    function naechste() {
      buehne.innerHTML = "";
      if (pos >= reihenfolge.length) {
        buehne.appendChild(leerkasten("Alle Fragen einmal durch.", "Noch einmal mischen",
          function () { pos = 0; reihenfolge.sort(function () { return Math.random() - 0.5; }); naechste(); }));
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
      q.optionen.forEach(function (o) {
        var b = el("button", "opt");
        b.innerHTML = AP.mk(o.text);
        b.addEventListener("click", function () {
          opts.querySelectorAll(".opt").forEach(function (x) { x.disabled = true; });
          b.classList.add(o.richtig ? "richtig" : "falsch");
          if (!o.richtig) {
            q.optionen.forEach(function (x, i) {
              if (x.richtig) opts.children[i].classList.add("richtig");
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
        function () { uebenAnsicht = "quiz"; zeigeUeben(s); }));
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
        e.appendChild(el("mark", null, t[1]));
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

  function zeigeIch(s) {
    s.innerHTML = "";
    var g = gesamtstand();
    s.appendChild(kopfzeile("Ich", "Fortschritt, Sicherung und Einstellungen."));

    var zahlen = el("div", "zahlenreihe");
    zahlen.appendChild(zahlenfeld(g.fertig, " / " + g.gesamt, "Kapitel geschafft"));
    zahlen.appendChild(zahlenfeld(
      Object.keys(stand.karten).filter(function (id) {
        return stand.karten[id].fach >= AP.FAECHER;
      }).length, " / " + inhalt.karten.length, "Karten sitzen"));
    s.appendChild(zahlen);

    s.appendChild(el("div", "abschnittstitel", "Fortschritt je Lernfeld"));
    var ul = el("ul", "liste-schlicht");
    inhalt.lernfelder.forEach(function (lf) {
      var st = lernfeldstand(lf);
      var li = el("li");
      li.appendChild(reihe(lf.seite, function (a) {
        var oben = el("div", "reihe-oben");
        oben.appendChild(el("span", "reihe-nr", lf.id.toUpperCase()));
        oben.appendChild(el("span", "reihe-titel", lf.titel));
        oben.appendChild(el("span", "reihe-meta", Math.round(st.anteil * 100) + " %"));
        a.appendChild(oben);
        a.appendChild(balken(st.anteil));
      }));
      ul.appendChild(li);
    });
    s.appendChild(ul);

    /* Lesezeichen */
    s.appendChild(el("div", "abschnittstitel", "Lesezeichen"));
    if (!stand.lesezeichen.length) {
      s.appendChild(leerkasten("Noch keine. Im Kapitel oben rechts auf das Zeichen "
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
      s.appendChild(lz);
    }

    /* Einstellungen */
    s.appendChild(el("div", "abschnittstitel", "Einstellungen"));
    var stimmung = el("div", "stellreihe");
    var links = el("div");
    links.appendChild(el("b", null, "Farben"));
    links.appendChild(el("small", null,
      "„System“ folgt der Einstellung deines Handys."));
    stimmung.appendChild(links);
    var schalter = el("div", "schalterfeld");
    [["system", "System"], ["hell", "Hell"], ["dunkel", "Dunkel"]].forEach(function (w) {
      var b = el("button", (stand.stimmung || "system") === w[0] ? "an" : "", w[1]);
      b.addEventListener("click", function () {
        AP.stimmungSetzen(w[0]);
        zeigeIch(s);
      });
      schalter.appendChild(b);
    });
    stimmung.appendChild(schalter);
    s.appendChild(stimmung);

    s.appendChild(terminfeld());

    /* Sicherung */
    s.appendChild(el("div", "abschnittstitel", "Deine Daten"));
    var erklaerung = el("p");
    erklaerung.style.cssText = "color:var(--text-sek);font-size:15.5px;margin:0 0 4px";
    erklaerung.textContent = "Dein Lernstand liegt nur in diesem Browser. Löschst du die "
      + "Websitedaten oder wechselst das Gerät, ist er weg — außer du sicherst ihn hier.";
    s.appendChild(erklaerung);

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
    s.appendChild(knoepfe);
    s.appendChild(meldung);

    var rechts = el("p");
    rechts.style.cssText = "margin:30px 0 0;font-size:13.5px";
    rechts.innerHTML = '<a href="impressum.html">Impressum</a> · '
      + '<a href="datenschutz.html">Datenschutz</a>';
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
      "Dein Prüfungstermin bestimmt den Countdown auf „Heute“. "
      + "Er bleibt nur auf diesem Gerät gespeichert."));

    var zeile = el("div", "terminzeile");
    var feld = el("input");
    feld.type = "date";
    feld.className = "terminfeld";
    feld.setAttribute("aria-label", "Dein Prüfungstermin");
    feld.value = AP.istDatum(stand.pruefungstermin) ? stand.pruefungstermin
                                                    : (pruefungsdatum() || "");

    var speichern = el("button", "kn-haupt", "Termin speichern");
    var zurueck = el("button", "kn-neben", "Standardtermin verwenden");
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
      feld.value = pruefungsdatum() || "";
      melden("Standardtermin wieder aktiv: " + countdown().text, false);
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
      /* Zusammenführen statt überschreiben: Wer auf zwei Geräten gelernt hat,
         soll nicht die Hälfte verlieren. Bei Karten gewinnt das höhere Fach. */
      Object.keys(neu.fortschritt || {}).forEach(function (k) {
        stand.fortschritt[k] = neu.fortschritt[k];
      });
      Object.keys(neu.karten || {}).forEach(function (id) {
        var alt = stand.karten[id];
        if (!alt || (neu.karten[id].fach || 0) > alt.fach) stand.karten[id] = neu.karten[id];
      });
      Object.keys(neu.quiz || {}).forEach(function (id) { stand.quiz[id] = neu.quiz[id]; });
      (neu.aktivitaet || []).forEach(function (t) {
        if (stand.aktivitaet.indexOf(t) === -1) stand.aktivitaet.push(t);
      });
      (neu.lesezeichen || []).forEach(function (e) {
        if (!stand.lesezeichen.some(function (x) { return x.zu === e.zu; })) {
          stand.lesezeichen.push(e);
        }
      });
      if (neu.zuletzt) stand.zuletzt = neu.zuletzt;
      // Nur übernehmen, was der Countdown auch rechnen kann — sonst schleppt
      // eine alte Sicherung einen kaputten Termin ins frische Konto.
      if (AP.istDatum(neu.pruefungstermin)) stand.pruefungstermin = neu.pruefungstermin;
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

  function zeige(wunsch) {
    var id = bauer[wunsch] ? wunsch : "heute";
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
    if (id !== "ueben") uebenAnsicht = "start";
    bauer[id](schirme[id]);
    if (wunsch === id) window.scrollTo(0, 0);
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
