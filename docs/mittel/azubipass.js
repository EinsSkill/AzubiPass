(function () {
  "use strict";

  var AP = window.AP;
  var el = AP.el, mk = AP.mk, mkEl = AP.mkEl;
  var stand = AP.stand, sichern = AP.sichern;

  var eur = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });
  var geld = function (n) { return eur.format(Math.round(n * 100) / 100) + " €"; };

  var LERNFELD = document.body.dataset.lernfeld || "seite";

  /* ================================================== Navigation */

  var kapitel = Array.prototype.slice.call(document.querySelectorAll(".kapitel"));
  var echteKapitel = document.querySelectorAll(".kapitel .kapitel-nr").length;
  var kopf = document.getElementById("kopf");
  var kopfMeta = document.getElementById("kopfMeta");
  var balken = document.getElementById("balken");
  var aktuell = null;

  function zeigeKapitel(wunsch) {
    /* Die Adresse darf auch auf einen Abschnitt zeigen — die Suche verlinkt
       genau dorthin. Dann wird das umgebende Kapitel gezeigt und danach zur
       Stelle gesprungen. */
    var ziel = document.getElementById(wunsch);
    var sec = ziel && ziel.closest(".kapitel");
    var id = sec ? sec.id : "start";
    var stelle = sec && ziel !== sec ? ziel : null;

    kapitel.forEach(function (k) { k.hidden = k.id !== id; });
    aktuell = document.getElementById(id);
    window.scrollTo(0, 0);
    schliesseBlase();
    if (!aktuell) return;

    var nr = aktuell.querySelector(".kapitel-nr");
    kopfMeta.textContent = nr
      ? nr.childNodes[0].textContent.trim() + " von " + echteKapitel
      : (aktuell.id === "trainer" ? "Karteikarten" : "Übersicht");

    /* Wo war ich? Genau das beantwortet der Startbildschirm der App. */
    if (nr) {
      var titel = aktuell.querySelector(".kapitel-auftakt h2");
      stand.zuletzt = {
        zu: LERNFELD + ".html#" + id,
        lernfeld: LERNFELD,
        kapitel: id,
        titel: titel ? titel.textContent : "",
        nummer: nr.childNodes[0].textContent.trim()
      };
      sichern();
    }

    lesezeichenStellen(id, nr);
    starteKapitel(aktuell);
    aktualisieren();

    if (stelle) {
      /* Nach dem Aufbau springen — vorher steht das Element noch nicht dort,
         wo es hingehört. */
      requestAnimationFrame(function () {
        stelle.scrollIntoView({ block: "start", behavior: "auto" });
        window.scrollBy(0, -80);              // unter den festen Kopf schieben
      });
    }
  }

  /* Lesezeichen nur im Kapitel — auf dem Deckblatt gibt es nichts zu merken. */
  var merkKnopf = document.getElementById("merken");
  var merkEintrag = null;

  function lesezeichenStellen(id, nr) {
    if (!merkKnopf) return;
    merkKnopf.hidden = !nr;
    if (!nr) return;
    var titel = aktuell.querySelector(".kapitel-auftakt h2");
    merkEintrag = {
      zu: LERNFELD + ".html#" + id,
      lernfeld: LERNFELD,
      titel: (nr.childNodes[0].textContent.trim() + " · " +
              (titel ? titel.textContent : "")).trim()
    };
    merkKnopf.setAttribute("aria-pressed", AP.gemerkt(merkEintrag.zu) ? "true" : "false");
  }

  if (merkKnopf) {
    merkKnopf.addEventListener("click", function () {
      if (!merkEintrag) return;
      merkKnopf.setAttribute("aria-pressed", AP.merken(merkEintrag) ? "true" : "false");
    });
  }

  /* Erst ganz am Ende der Datei eingehängt: AP.verteiler ruft zeigeKapitel
     sofort auf, und das rührt an Dinge — die Blase, den Kopf —, die weiter
     unten entstehen. */
  var verteiler = { geheZu: function (id) { location.hash = "#" + id; } };

  document.addEventListener("click", function (e) {
    var ziel = e.target.closest("[data-zu]");
    if (ziel) { e.preventDefault(); verteiler.geheZu(ziel.dataset.zu); return; }
    schliesseBlase();
  });

  /* Eine Ebene zurück statt history.back(): Im eingebauten App-Fenster gibt es
     keine Browserleiste, und „zurück" soll dort nicht davon abhängen, über
     welchen Umweg jemand hergekommen ist. Aus einem Kapitel geht es aufs
     Deckblatt, vom Deckblatt in die Lernfeldliste. */
  var zurueck = document.getElementById("zurueck");
  if (zurueck) {
    zurueck.addEventListener("click", function () {
      if (aktuell && aktuell.id !== "start") verteiler.geheZu("start");
      else location.href = "app.html#lernen";
    });
  }

  /* ================================================== Kopf & Fortschritt */

  function aktualisieren() {
    var hero = aktuell && aktuell.classList.contains("hero");
    kopf.classList.toggle("auf-papier", !hero || window.scrollY > window.innerHeight - 56);
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    balken.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
  }

  var tickt = false;
  window.addEventListener("scroll", function () {
    if (tickt) return;
    tickt = true;
    requestAnimationFrame(function () {
      aktualisieren();
      if (offenerBegriff && !amHandy()) stelleBlase(offenerBegriff);
      tickt = false;
    });
  }, { passive: true });

  /* ================================================== Blase

     Am Handy fährt sie als Blatt von unten ein und wird von der CSS gestellt;
     auf breiten Schirmen schwebt sie neben dem Wort.                           */

  function amHandy() { return window.innerWidth <= 700; }

  var blase = el("div");
  blase.id = "blase";
  blase.setAttribute("role", "dialog");
  blase.setAttribute("aria-label", "Erklärung");
  var schleier = el("div", "blase-schleier");
  document.body.appendChild(schleier);
  document.body.appendChild(blase);
  var offenerBegriff = null;

  function schliesseBlase() {
    blase.classList.remove("offen");
    schleier.classList.remove("offen");
    if (offenerBegriff) { offenerBegriff.classList.remove("offen"); offenerBegriff = null; }
  }

  function stelleBlase(b) {
    if (amHandy()) { blase.style.left = blase.style.top = ""; return; }
    var r = b.getBoundingClientRect(), m = blase.getBoundingClientRect();
    var links = Math.min(Math.max(14, r.left), Math.max(14, window.innerWidth - m.width - 14));
    var oben = r.bottom + 10;
    if (oben + m.height > window.innerHeight - 14 && r.top - m.height - 10 > 14) {
      oben = r.top - m.height - 10;
    }
    blase.style.left = links + "px";
    blase.style.top = oben + "px";
  }

  function oeffneBlase(b) {
    var zitat = b.dataset.art === "Gesetzestext" ? " zitat" : "";
    blase.innerHTML = '<button class="b-zu" aria-label="Schließen">&times;</button>'
      + '<div class="b-art"></div><div class="b-titel"></div>'
      + '<p class="b-text' + zitat + '"></p>';
    blase.querySelector(".b-art").textContent = b.dataset.art;
    blase.querySelector(".b-titel").textContent = b.dataset.titel;
    blase.querySelector(".b-text").textContent = b.dataset.text;
    blase.classList.add("offen");
    schleier.classList.toggle("offen", amHandy());
    b.classList.add("offen");
    offenerBegriff = b;
    stelleBlase(b);
    blase.querySelector(".b-zu").addEventListener("click", schliesseBlase);
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest(".begriff, .par");
    if (!b || !b.dataset.text) return;
    e.stopPropagation();
    if (offenerBegriff === b) { schliesseBlase(); return; }
    schliesseBlase();
    oeffneBlase(b);
  }, true);

  blase.addEventListener("click", function (e) { e.stopPropagation(); });
  schleier.addEventListener("click", schliesseBlase);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") schliesseBlase(); });

  /* Nur bei echter Breitenänderung schließen.

     Vorher hing das an resize schlechthin — und am Handy löst schon das Ein-
     und Ausblenden der Adressleiste beim Scrollen ein resize aus. Man tippte
     einen Begriff an, scrollte zwei Zentimeter, und die Erklärung war weg. */
  var letzteBreite = window.innerWidth;
  window.addEventListener("resize", function () {
    if (window.innerWidth === letzteBreite) return;
    letzteBreite = window.innerWidth;
    schliesseBlase();
  });

  /* ================================================== Kapitel starten */

  var gestartet = new WeakSet();

  function starteKapitel(sec) {
    if (sec.classList.contains("hero")) {
      sec.querySelectorAll(".buch li").forEach(function (li, i) {
        li.classList.remove("gezogen");
        setTimeout(function () { li.classList.add("gezogen"); }, 200 + i * 100);
      });
      return;
    }
    if (gestartet.has(sec)) return;
    gestartet.add(sec);

    if (sec.id === "trainer") { starteTrainer(sec); return; }

    var f = AP.kapitelfach(LERNFELD, sec.id);
    einblenden(sec);
    lernziele(sec, f);
    abschnittsstand(sec);
    tabellen(sec);
    karteikarten(sec);
    checks(sec, f);
    zuordnen(sec, f);
    selbsttest(sec, f);
    sec.querySelectorAll("[data-grafik]").forEach(baueGrafik);
    kapitelstandPruefen(sec, f);
  }

  /* Wann gilt ein Kapitel als geschafft? Alle Lernziele erreicht und der
     Selbsttest bearbeitet. Beides steht ohnehin schon im Konto — es wurde nur
     nie zusammengerechnet. */
  function kapitelstandPruefen(sec, f) {
    var ziele = sec.querySelectorAll(".ziele-liste li").length;
    var fragen = sec.querySelectorAll(".frage").length;
    var fertig = (!ziele || f.ziele.length >= ziele) &&
                 (!fragen || Object.keys(f.test).length >= fragen);
    if (fertig !== f.fertig) { f.fertig = fertig; sichern(); }
  }

  function einblenden(sec) {
    var seher = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("da"); seher.unobserve(e.target); }
      });
    }, { threshold: .15, rootMargin: "0px 0px -8% 0px" });
    sec.querySelectorAll(".rein").forEach(function (x) { seher.observe(x); });
  }

  /* Wo im Kapitel man gerade steht.

     Ein eigener Beobachter, obwohl lernziele() dieselben Überschriften ansieht:
     Der dort hört nach dem ersten Treffer auf, weil ein erreichtes Lernziel
     erreicht bleibt. Die Position dagegen muss beim Zurückscrollen mitgehen.

     Abschnitte davor bleiben als „gelesen" markiert. Das ist keine Wertung,
     sondern die Antwort auf „wie viel habe ich noch vor mir" — dieselbe Frage,
     die der Fortschrittsbalken oben grob beantwortet. */
  function abschnittsstand(sec) {
    var rand = sec.querySelector(".lr-inhalt");
    if (!rand) return;
    var eintraege = [].slice.call(rand.querySelectorAll(".lr-liste li"));
    var stand = rand.querySelector(".lr-stand b");
    if (!eintraege.length) return;

    function setze(nr) {
      eintraege.forEach(function (li, i) {
        li.classList.toggle("aktuell", i === nr);
        li.classList.toggle("gelesen", i < nr);
        if (i === nr) li.firstChild.setAttribute("aria-current", "true");
        else li.firstChild.removeAttribute("aria-current");
      });
      if (stand) stand.textContent = nr + 1;
    }
    setze(0);

    /* Verglichen wird die ganze Kennung gegen das Ziel des Verweises, nicht das
       letzte Stück nach dem Bindestrich: Ein Abschnitt heißt „warum-konten",
       und dann wäre das letzte Stück „konten" und träfe nie.

       Dasselbe Band wie bei den Lernzielen — es liegt um die Bildschirmmitte,
       und genau dort liest man. */
    var seher = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var ziel = "#" + e.target.id;
        for (var i = 0; i < eintraege.length; i++) {
          var a = eintraege[i].firstChild;
          if (a && a.getAttribute("href") === ziel) { setze(i); return; }
        }
      });
    }, { threshold: 0, rootMargin: "-40% 0px -45% 0px" });
    sec.querySelectorAll(".inhalt h3[id]").forEach(function (h) { seher.observe(h); });

    /* Am Handy klappt die Liste aus dem Knopf auf; am Schreibtisch steht sie
       ohnehin und der Knopf ist weg. Escape schließt sie wieder, und der Fokus
       kehrt dorthin zurück, wo er hergekommen ist. */
    var knopf = rand.querySelector(".lr-knopf");
    if (!knopf) return;

    function zu() {
      rand.classList.remove("offen");
      knopf.setAttribute("aria-expanded", "false");
    }
    knopf.addEventListener("click", function () {
      var offen = rand.classList.toggle("offen");
      knopf.setAttribute("aria-expanded", offen ? "true" : "false");
    });
    rand.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !rand.classList.contains("offen")) return;
      zu();
      knopf.focus();
    });
    rand.querySelectorAll(".lr-liste a").forEach(function (a) {
      a.addEventListener("click", zu);
    });
  }

  function lernziele(sec, f) {
    var anzeige = sec.querySelector(".ziele-zahl b");

    f.ziele.forEach(function (kurz) {
      var li = sec.querySelector('.ziele-liste li[data-fuer="' + kurz + '"]');
      if (li) li.classList.add("erledigt");
    });
    var n = sec.querySelectorAll(".ziele-liste li.erledigt").length;
    anzeige.textContent = n;

    var seher = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var kurz = e.target.id.split("-").pop();
        var li = sec.querySelector('.ziele-liste li[data-fuer="' + kurz + '"]');
        if (li && !li.classList.contains("erledigt")) {
          li.classList.add("erledigt");
          anzeige.textContent = ++n;
          f.ziele.push(kurz);
          AP.heuteGelernt();
          sichern();
          kapitelstandPruefen(sec, f);
        }
        seher.unobserve(e.target);
      });
    }, { threshold: 0, rootMargin: "-40% 0px -45% 0px" });
    sec.querySelectorAll(".inhalt h3[id]").forEach(function (h) { seher.observe(h); });
  }

  function tabellen(sec) {
    sec.querySelectorAll("tr.klappbar").forEach(function (tr) {
      tr.addEventListener("click", function () {
        var d = tr.nextElementSibling;
        if (!d || !d.classList.contains("detail")) return;
        tr.classList.toggle("auf");
        d.classList.toggle("auf");
      });
    });
  }

  function karteikarten(sec) {
    sec.querySelectorAll(".dreher").forEach(function (b) {
      b.addEventListener("click", function () {
        document.getElementById(b.dataset.karte).classList.toggle("gedreht");
      });
    });
  }

  /* Gespeicherter Stand einer einzelnen Aufgabe.

     Der Abdruck sitzt jetzt an der Aufgabe, nicht mehr am ganzen Kapitel.
     Vorher warf ein korrigiertes Komma irgendwo im Text den kompletten Stand
     des Kapitels weg — Haken, Antworten, alles. Jetzt kostet eine geänderte
     Frage genau diese eine Antwort. */
  function aufgabenstand(f, art, kasten, text) {
    var id = kasten.id;
    if (!id) return {};                       // ohne Kennung nichts merken
    var a = AP.abdruck(text);
    var e = f[art][id];
    if (!e || e.a !== a) e = f[art][id] = { a: a };
    return e;
  }

  function checks(sec, f) {
    sec.querySelectorAll(".check").forEach(function (box) {
      var echo = box.querySelector(".check-echo");
      var opts = box.querySelectorAll(".opt");
      var frage = box.querySelector(".check-frage");
      var gemerkt = aufgabenstand(f, "checks", box, frage ? frage.textContent : box.id);

      function waehle(opt) {
        opts.forEach(function (o) { o.disabled = true; });
        var richtig = !!opt.dataset.richtig;
        opt.classList.add(richtig ? "richtig" : "falsch");
        if (!richtig) {
          box.querySelector(".opt[data-richtig='1']").classList.add("richtig");
        }
        echo.textContent = opt.dataset.echo;
        echo.classList.add("da");
      }

      opts.forEach(function (opt, k) {
        opt.addEventListener("click", function () {
          waehle(opt);
          gemerkt.w = k;
          gemerkt.r = !!opt.dataset.richtig;
          AP.heuteGelernt();
          sichern();
        });
      });

      if (gemerkt.w != null && opts[gemerkt.w]) waehle(opts[gemerkt.w]);
    });
  }

  function zuordnen(sec, f) {
    sec.querySelectorAll(".zuordnen").forEach(function (box) {
      var anzeige = box.querySelector(".zu-zahl b");
      var lead = box.querySelector(".zu-lead");
      var gemerkt = aufgabenstand(f, "zuordnen", box, lead ? lead.textContent : box.id);
      if (!gemerkt.w) gemerkt.w = {};
      var n = 0;

      box.querySelectorAll(".zu-reihe").forEach(function (reihe, j) {
        var loesung = reihe.dataset.loesung;
        var knoepfe = reihe.querySelectorAll(".zu-btn");

        function waehle(btn) {
          knoepfe.forEach(function (b) { b.disabled = true; });
          if (btn.dataset.w === loesung) {
            btn.classList.add("richtig");
            anzeige.textContent = ++n;
          } else {
            btn.classList.add("falsch");
            reihe.querySelector('.zu-btn[data-w="' + loesung + '"]').classList.add("richtig");
          }
        }

        knoepfe.forEach(function (btn, k) {
          btn.addEventListener("click", function () {
            waehle(btn);
            gemerkt.w[j] = k;
            gemerkt.f = (gemerkt.f || 0) + (btn.dataset.w === loesung ? 0 : 1);
            AP.heuteGelernt();
            sichern();
          });
        });

        if (gemerkt.w[j] != null && knoepfe[gemerkt.w[j]]) waehle(knoepfe[gemerkt.w[j]]);
      });
    });
  }

  function selbsttest(sec, f) {
    var anzeige = sec.querySelector(".test-zahl b");
    var n = 0;

    sec.querySelectorAll(".frage").forEach(function (frage) {
      var feld = frage.querySelector("textarea");
      var haupt = frage.querySelector(".kn-haupt");
      var neben = frage.querySelector(".kn-neben");
      var loesung = frage.querySelector(".loesung");
      var text = frage.querySelector(".frage-text");
      var gemerkt = aufgabenstand(f, "test", frage, text ? text.textContent : frage.id);
      var gezaehlt = false;

      function merken() { AP.heuteGelernt(); sichern(); kapitelstandPruefen(sec, f); }

      function zaehlen() { if (!gezaehlt) { gezaehlt = true; anzeige.textContent = ++n; } }

      function aufloesen() { loesung.classList.add("offen"); zaehlen(); }

      function alsLuecke() {
        feld.disabled = true;
        haupt.disabled = true;
        loesung.classList.add("luecke", "offen");
        loesung.querySelector(".lk").textContent = "Musterlösung · als Lücke gemerkt";
        zaehlen();
      }

      feld.addEventListener("input", function () {
        haupt.disabled = feld.value.trim().length < 3;
        gemerkt.t = feld.value;
        sichern();
      });
      haupt.addEventListener("click", function () {
        aufloesen();
        gemerkt.z = "haupt";
        merken();
      });
      neben.addEventListener("click", function () {
        alsLuecke();
        gemerkt.z = "luecke";
        merken();
      });

      if (gemerkt.t) {
        feld.value = gemerkt.t;
        haupt.disabled = feld.value.trim().length < 3;
      }
      if (gemerkt.z === "haupt") aufloesen();
      else if (gemerkt.z === "luecke") alsLuecke();
    });
  }

  /* ================================================== Karteikarten-Trainer

     Leitner in klein: drei Fächer. Gewusst → eine Stufe weiter. Nicht gewusst →
     zurück auf eins. Gezogen wird immer aus dem niedrigsten Fach, das noch
     etwas enthält — so kommt das Wacklige oft und das Sichere selten.

     Die Karten stammen aus den Merksätzen; gepflegt wird nichts doppelt.       */

  function starteTrainer(sec) {
    var quelle = sec.querySelector("#karten-daten");
    if (!quelle) return;
    window.AP.trainer(sec.querySelector(".tr-buehne"), sec.querySelector(".tr-faecher"),
                      JSON.parse(quelle.textContent));
  }

  /* ================================================== Grafiken */

  /* Jede Fachgrafik bekommt denselben Rückweg in ihren Ausgangszustand.

     Möglich ist das, weil alle denselben Vertrag haben: Die Daten stehen als
     JSON daneben, gebaut wird ausschließlich in .buehne. Zurücksetzen heißt
     deshalb: Bühne leeren, denselben Bauer noch einmal laufen lassen. Keine
     einzelne Grafik muss davon wissen, und keine musste dafür angefasst werden.

     Der Knopf entsteht nur einmal — sonst stünde er nach jedem Zurücksetzen ein
     weiteres Mal da. */
  function zuruecksetzknopf(wrap) {
    if (wrap.querySelector(".sig-zurueck")) return;
    var b = mkEl("button", "sig-zurueck", "Zurücksetzen");
    b.type = "button";
    var titel = wrap.querySelector("h4");
    b.setAttribute("aria-label",
      "Grafik zurücksetzen" + (titel ? ": " + titel.textContent : ""));
    b.addEventListener("click", function () {
      baueGrafik(wrap);
      b.focus();
    });
    wrap.insertBefore(b, wrap.querySelector(".buehne"));
  }

  function baueGrafik(wrap) {
    var daten = JSON.parse(wrap.querySelector("script[type='application/json']").textContent);
    var buehne = wrap.querySelector(".buehne");
    buehne.innerHTML = "";
    zuruecksetzknopf(wrap);
    var bauer = {
      "stufen": gStufen,
      "veraenderung": gVeraenderung,
      "t-konto": gTKonto,
      "kette": gKette,
      "kalkulationsleiter": gLeiter,
      "vergleich": gVergleich,
      "organigramm": gOrganigramm,
      "kreislauf": gKreislauf,
      "staffel": gStaffel,
      "brief": gBrief,
      "lagerkurve": gLagerkurve,
      "matrix": gMatrix,
      "liquiditaet": gLiquiditaet,
      "breakeven": gBreakeven,
      "durchlauf": gDurchlauf,
      "balkenplan": gBalkenplan
    }[daten.variante];
    if (bauer) bauer(buehne, daten);
    else buehne.appendChild(mkEl("p", "echo", "Bauteil „" + daten.variante + "“ ist noch nicht gebaut."));
  }

  function wahlLeiste(buehne, texte, beim) {
    var leiste = el("div", "wahl");
    texte.forEach(function (t, i) {
      var b = el("button", null, t);
      b.addEventListener("click", function () {
        leiste.querySelectorAll("button").forEach(function (x) { x.classList.remove("an"); });
        b.classList.add("an");
        beim(i);
      });
      leiste.appendChild(b);
    });
    buehne.appendChild(leiste);
    return leiste;
  }

  /* ---------- 1 · Stufen (Inventur → Inventar → Bilanz) ---------- */

  function gStufen(buehne, d) {
    var tabs = el("div", "stufen");
    var koerper = el("div");
    d.stufen.forEach(function (s, i) {
      var b = el("button", "stufe-btn" + (i === 0 ? " an" : ""));
      b.appendChild(el("b", null, "Stufe " + (i + 1)));
      b.appendChild(document.createTextNode(s.name));
      b.addEventListener("click", function () {
        tabs.querySelectorAll("button").forEach(function (x) { x.classList.remove("an"); });
        b.classList.add("an");
        zeichne(i);
      });
      tabs.appendChild(b);
    });
    buehne.appendChild(tabs);
    buehne.appendChild(koerper);

    function zeichne(i) {
      var s = d.stufen[i];
      koerper.innerHTML = "";
      koerper.appendChild(mkEl("p", "szene-text", s.text));

      if (s.darstellung === "zaehlen") {
        var g = el("div", "zaehl");
        s.posten.forEach(function (p, k) {
          var box = el("div", "posten");
          box.style.animationDelay = (k * .09) + "s";
          var tick = el("span", "tick");
          tick.style.animationDelay = (k * .09 + .3) + "s";
          box.appendChild(tick);
          box.appendChild(document.createTextNode(p.name));
          box.appendChild(el("span", "wert", eur.format(p.wert)));
          g.appendChild(box);
        });
        koerper.appendChild(g);

      } else if (s.darstellung === "verzeichnis") {
        var l = el("div", "liste"), z = 0;
        function zeile(name, wert, klasse) {
          var r = el("div", "zeile" + (klasse ? " " + klasse : ""));
          r.style.animationDelay = (z++ * .07) + "s";
          r.appendChild(el("span", null, name));
          r.appendChild(el("span", null, wert === null ? "" : geld(wert)));
          l.appendChild(r);
        }
        s.gruppen.forEach(function (g) {
          zeile(g.titel, null, "gruppe");
          g.posten.forEach(function (p) { zeile(p.name, p.wert); });
          zeile(g.summe.name, g.summe.wert, "summe");
        });
        zeile(s.ergebnis.name, s.ergebnis.wert, "summe");
        koerper.appendChild(l);

      } else if (s.darstellung === "bilanz-rechner") {
        rechnerBilanz(koerper, s);
      }
    }
    zeichne(0);
  }

  function rechnerBilanz(koerper, s) {
    var regler = el("div", "regler");
    var felder = {};
    s.eingaben.forEach(function (e) {
      var f = el("div", "feld");
      f.appendChild(el("label", null, e.label));
      var i = document.createElement("input");
      AP.kommafeld(i); i.step = "5000"; i.min = "0"; i.value = e.start;
      f.appendChild(i);
      felder[e.id] = { input: i, seite: e.seite };
      regler.appendChild(f);
    });
    koerper.appendChild(regler);

    var bil = el("div", "bilanz");
    var aktiva = el("div"), passiva = el("div");
    aktiva.appendChild(el("div", "saeule-kopf", "Aktiva · Mittelverwendung"));
    passiva.appendChild(el("div", "saeule-kopf", "Passiva · Mittelherkunft"));
    var sA = el("div", "saeule"), sP = el("div", "saeule");
    aktiva.appendChild(sA); passiva.appendChild(sP);
    bil.appendChild(aktiva); bil.appendChild(passiva);
    koerper.appendChild(bil);

    var waage = el("div", "waage");
    var wl = el("span"), wm = el("span", null, "="), wr = el("span");
    waage.appendChild(wl); waage.appendChild(wm); waage.appendChild(wr);
    koerper.appendChild(waage);

    var warn = el("p", "echo");
    warn.style.display = "none";
    koerper.appendChild(warn);

    function balkenBauen(saeule, teile) {
      saeule.innerHTML = "";
      var summe = teile.reduce(function (a, t) { return a + Math.max(t.wert, 0); }, 0);
      teile.forEach(function (t, i) {
        var b = el("div", "block f" + (i + 1));
        b.appendChild(el("span", null, t.name));
        b.appendChild(el("span", "b-wert", geld(t.wert)));
        saeule.appendChild(b);
        requestAnimationFrame(function () {
          b.style.height = (gesamt > 0 ? Math.max(t.wert, 0) / gesamt * 200 : 0) + "px";
        });
      });
      return summe;
    }

    var gesamt = 0;
    function rechne() {
      var v = {};
      Object.keys(felder).forEach(function (k) {
        var n = AP.zahl(felder[k].input, NaN);
        v[k] = isNaN(n) || n < 0 ? 0 : n;
      });
      var akt = s.eingaben.filter(function (e) { return e.seite === "aktiva"; });
      var pas = s.eingaben.filter(function (e) { return e.seite === "passiva"; });
      var vermoegen = akt.reduce(function (a, e) { return a + v[e.id]; }, 0);
      var schulden = pas.reduce(function (a, e) { return a + v[e.id]; }, 0);
      var ek = vermoegen - schulden;
      gesamt = Math.max(vermoegen, schulden);

      var linkeSeite = akt.map(function (e) { return { name: e.label, wert: v[e.id] }; });
      if (ek < 0) linkeSeite.push({ name: "Nicht durch EK gedeckter Fehlbetrag", wert: -ek });
      balkenBauen(sA, linkeSeite);
      balkenBauen(sP, [{ name: "Eigenkapital", wert: Math.max(ek, 0) },
                       { name: "Fremdkapital", wert: schulden }]);

      wl.textContent = "Aktiva " + geld(gesamt);
      wr.textContent = geld(gesamt) + " Passiva";
      if (ek < 0) { warn.innerHTML = mk(s.hinweis_negativ); warn.style.display = ""; }
      else warn.style.display = "none";
    }

    Object.keys(felder).forEach(function (k) {
      felder[k].input.addEventListener("input", rechne);
    });
    rechne();
  }

  /* ---------- 2 · Bilanzveränderungen ---------- */

  /* Aktiva in Grüntönen, Passiva in Goldtönen — die Seite ist an der Farbe erkennbar */
  var TON = {
    aktiva:  ["#2A5A44", "#356B52", "#417C60", "#4D8D6E"],
    passiva: ["#CFA829", "#B8931F", "#A18019", "#8A6D14"]
  };

  function saeuleZeichnen(saeule, rest, posten, gesamt, seite, bewegt) {
    saeule.innerHTML = "";
    rest.innerHTML = "";
    posten.forEach(function (p, i) {
      var px = gesamt > 0 ? Math.max(p.wert, 0) / gesamt * 250 : 0;
      var b = el("div", "blk" + (bewegt.indexOf(p.id) >= 0 ? " bewegt" : ""));
      b.style.background = TON[seite][i % TON[seite].length];
      b.style.color = seite === "passiva" ? "#0E2517" : "var(--creme)";
      /* Beschriftung nur, wenn sie hineinpasst — sonst unter die Säule */
      if (px >= 38) {
        b.appendChild(el("span", "blk-name", p.name));
        b.appendChild(el("span", "blk-wert", geld(p.wert)));
      } else if (px >= 21) {
        b.appendChild(el("span", "blk-eng", p.name + " · " + geld(p.wert)));
      } else {
        var z = el("div", "rest-zeile");
        z.appendChild(el("i", null, ""));
        z.querySelector("i").style.background = TON[seite][i % TON[seite].length];
        z.appendChild(el("span", null, p.name + " · " + geld(p.wert)));
        rest.appendChild(z);
      }
      saeule.appendChild(b);
      requestAnimationFrame(function () { b.style.height = px + "px"; });
    });
  }

  function gVeraenderung(buehne, d) {
    var bil = el("div", "bilanz");
    var aktiva = el("div"), passiva = el("div");
    aktiva.appendChild(el("div", "saeule-kopf", "Aktiva"));
    passiva.appendChild(el("div", "saeule-kopf", "Passiva"));
    var sA = el("div", "saeule"), sP = el("div", "saeule");
    var rA = el("div", "saeule-rest"), rP = el("div", "saeule-rest");
    aktiva.appendChild(sA); aktiva.appendChild(rA);
    passiva.appendChild(sP); passiva.appendChild(rP);
    bil.appendChild(aktiva); bil.appendChild(passiva);

    var waage = el("div", "waage");
    var wl = el("span"), wr = el("span");
    waage.appendChild(wl); waage.appendChild(el("span", null, "=")); waage.appendChild(wr);

    var art = el("p", "art-marke");
    var echo = el("p", "echo");

    var stand = JSON.parse(JSON.stringify(d.ausgang));
    var bewegt = [];

    var leiste = wahlLeiste(buehne,
      d.vorfaelle.map(function (v) { return v.text; }).concat(["Ausgangsbilanz"]),
      function (i) {
        stand = JSON.parse(JSON.stringify(d.ausgang));
        if (i < d.vorfaelle.length) {
          var v = d.vorfaelle[i];
          bewegt = v.bewegungen.map(function (x) { return x.posten; });
          v.bewegungen.forEach(function (x) {
            ["aktiva", "passiva"].forEach(function (seite) {
              stand[seite].forEach(function (p) { if (p.id === x.posten) p.wert += x.delta; });
            });
          });
          art.textContent = v.art;
          echo.innerHTML = mk(v.echo);
        } else {
          bewegt = [];
          art.textContent = "Ausgangsbilanz";
          echo.textContent = "";
        }
        zeichne();
      });
    leiste.lastElementChild.classList.add("zurueck");

    buehne.appendChild(bil);
    buehne.appendChild(waage);
    buehne.appendChild(art);
    buehne.appendChild(echo);

    function zeichne() {
      var sa = stand.aktiva.reduce(function (a, p) { return a + p.wert; }, 0);
      var sp = stand.passiva.reduce(function (a, p) { return a + p.wert; }, 0);
      var g = Math.max(sa, sp);
      saeuleZeichnen(sA, rA, stand.aktiva, g, "aktiva", bewegt);
      saeuleZeichnen(sP, rP, stand.passiva, g, "passiva", bewegt);
      wl.textContent = "Aktiva " + geld(sa);
      wr.textContent = geld(sp) + " Passiva";
    }

    art.textContent = "Ausgangsbilanz";
    zeichne();
  }

  /* ---------- 3 · T-Konten ---------- */

  function gTKonto(buehne, d) {
    var satz = el("p", "satz");
    var gitter = el("div", "konten");
    var echo = el("p", "echo");

    var kontenEl = {};
    d.konten.forEach(function (k) {
      var box = el("div", "tk");
      box.appendChild(el("div", "tk-name", k.name));
      var koerper = el("div", "tk-koerper");
      var links = el("div", "tk-seite"), rechts = el("div", "tk-seite");
      links.appendChild(el("div", "tk-kopf", "Soll"));
      rechts.appendChild(el("div", "tk-kopf", "Haben"));
      koerper.appendChild(links); koerper.appendChild(rechts);
      box.appendChild(koerper);
      gitter.appendChild(box);
      kontenEl[k.id] = { box: box, soll: links, haben: rechts, art: k.art, ab: k.ab };
    });

    function grundstellung() {
      d.konten.forEach(function (k) {
        var e = kontenEl[k.id];
        e.box.classList.remove("beteiligt");
        e.soll.innerHTML = '<div class="tk-kopf">Soll</div>';
        e.haben.innerHTML = '<div class="tk-kopf">Haben</div>';
        if (k.ab) {
          var seite = (k.art === "aktiv" || k.art === "aufwand") ? e.soll : e.haben;
          seite.appendChild(el("div", "tk-pos", "AB " + eur.format(k.ab)));
        }
      });
    }

    wahlLeiste(buehne, d.vorfaelle.map(function (v) { return v.text; }), function (i) {
      var v = d.vorfaelle[i];
      grundstellung();
      satz.textContent = v.satz;
      echo.innerHTML = mk(v.echo);
      [["soll", v.soll], ["haben", v.haben]].forEach(function (paar) {
        paar[1].forEach(function (b) {
          var e = kontenEl[b.konto];
          if (!e) return;
          e.box.classList.add("beteiligt");
          e[paar[0]].appendChild(el("div", "tk-pos neu", eur.format(b.betrag)));
        });
      });
    });

    buehne.appendChild(satz);
    buehne.appendChild(gitter);
    buehne.appendChild(echo);
    grundstellung();
    satz.textContent = "Wähle oben einen Geschäftsvorfall.";
  }

  /* ---------- 4 · Abschlusskette ---------- */

  function gKette(buehne, d) {
    var kette = el("div", "kette");
    var frei = 1;
    d.schritte.forEach(function (s, i) {
      var g = el("div", "kglied" + (i === 0 ? " frei" : ""));
      g.appendChild(el("div", "knr", String(s.nr)));
      var rechts = el("div");
      rechts.appendChild(el("div", "ktitel", s.titel));
      rechts.appendChild(el("div", "ksatz", s.satz));
      rechts.appendChild(mkEl("div", "ktext", s.text));
      g.appendChild(rechts);
      g.addEventListener("click", function () {
        if (!g.classList.contains("frei")) return;
        g.classList.toggle("offen");
        if (i + 1 === frei && frei < d.schritte.length) {
          kette.children[frei].classList.add("frei");
          frei++;
        }
      });
      kette.appendChild(g);
    });
    buehne.appendChild(kette);
  }

  /* ---------- 5 · Kalkulationsleiter ---------- */

  function gLeiter(buehne, d) {
    var leiter = el("div", "leiter");
    var startInput, saetze = {};
    var einheit = d.einheit || "\u20AC";
    function zeigeWert(w) {
      return einheit === "\u20AC" ? geld(w)
        : eur.format(Math.round(w * 100) / 100) + " " + einheit;
    }

    var spalten = el("div", "lz lz-spalten");
    spalten.appendChild(el("div", null, ""));
    spalten.appendChild(el("div", null, d.spaltenkopf || "Satz"));
    spalten.appendChild(el("div", null, "Ergebnis"));
    leiter.appendChild(spalten);

    var zStart = el("div", "lz lzkopf");
    zStart.appendChild(el("div", "lz-name", d.start.name));
    zStart.appendChild(el("div", "lz-eingabe"));
    var wStart = el("div", "lz-wert");
    startInput = document.createElement("input");
    AP.kommafeld(startInput); startInput.value = d.start.wert;
    wStart.appendChild(startInput);
    zStart.appendChild(wStart);
    leiter.appendChild(zStart);

    d.stufen.forEach(function (s, i) {
      var letzte = i === d.stufen.length - 1;
      var z = el("div", "lz" + (s.marke ? " marke" : "") + (letzte ? " ende" : ""));
      z.appendChild(el("div", "lz-name", s.ergebnis));
      var mitte = el("div", "lz-eingabe");
      var absolut = s.art === "zuschlag-absolut";
      var ip = document.createElement("input");
      AP.kommafeld(ip);
      ip.step = absolut ? "1" : "0.1";
      ip.value = absolut ? s.betrag : s.satz;
      ip.setAttribute("aria-label", s.name);
      mitte.appendChild(ip);
      mitte.appendChild(el("span", "lz-einheit", absolut ? einheit : "%"));
      saetze[s.id] = ip;
      z.appendChild(mitte);
      z.appendChild(el("div", "lz-wert", "—"));
      z.dataset.stufe = s.id;
      leiter.appendChild(z);
    });
    buehne.appendChild(leiter);

    function rechne() {
      var wert = AP.zahl(startInput, 0);
      var basiswerte = { __start: wert };
      var abzuege = {};
      d.stufen.forEach(function (s) {
        var p = AP.zahl(saetze[s.id], 0);
        var vorher = wert;
        if (s.art === "abzug") { abzuege[s.id] = wert * p / 100; wert -= abzuege[s.id]; }
        else if (s.art === "abzug-vom-start") { abzuege[s.id] = basiswerte.__start * p / 100; wert -= abzuege[s.id]; }
        else if (s.art === "abzug-von") { abzuege[s.id] = (abzuege[s.basis] || 0) * p / 100; wert -= abzuege[s.id]; }
        else if (s.art === "zuschlag-absolut") { wert += p; }
        else if (s.art === "aufschlag") { wert += wert * p / 100; }
        else if (s.art === "im-hundert") { wert = p < 100 ? wert / (1 - p / 100) : vorher; }
        leiter.querySelector('[data-stufe="' + s.id + '"] .lz-wert').textContent = zeigeWert(wert);
      });
    }

    startInput.addEventListener("input", rechne);
    Object.keys(saetze).forEach(function (k) {
      saetze[k].addEventListener("input", rechne);
    });
    rechne();
  }

  /* ---------- 10 · Geschäftsbrief ---------- */

  function gBrief(buehne, d) {
    var NSB = "http://www.w3.org/2000/svg";
    var B = 210, H = 297;                       // Seitenmaße in Millimetern
    var svg = document.createElementNS(NSB, "svg");
    svg.setAttribute("viewBox", "-22 -6 " + (B + 30) + " " + (H + 12));
    svg.setAttribute("class", "brief-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Aufbau eines Geschäftsbriefs nach DIN 5008");

    var blatt = document.createElementNS(NSB, "rect");
    blatt.setAttribute("x", 0); blatt.setAttribute("y", 0);
    blatt.setAttribute("width", B); blatt.setAttribute("height", H);
    blatt.setAttribute("class", "brief-blatt");
    svg.appendChild(blatt);

    var notiz = el("div", "brief-notiz");
    var felder = {};

    d.zonen.forEach(function (z) {
      var g = document.createElementNS(NSB, "g");
      g.setAttribute("class", "brief-zone" + (z.art ? " " + z.art : ""));
      g.setAttribute("tabindex", "0");
      var r = document.createElementNS(NSB, "rect");
      r.setAttribute("x", z.x); r.setAttribute("y", z.y);
      r.setAttribute("width", z.b); r.setAttribute("height", z.h);
      g.appendChild(r);
      var t = document.createElementNS(NSB, "text");
      t.setAttribute("x", z.x + 3);
      t.setAttribute("y", z.y + Math.min(z.h / 2 + 2.2, 7));
      t.textContent = z.name;
      g.appendChild(t);
      svg.appendChild(g);
      felder[z.id] = g;

      function waehlen() {
        Object.keys(felder).forEach(function (k) { felder[k].classList.remove("an"); });
        g.classList.add("an");
        notiz.innerHTML = "<b>" + z.name + "</b> " + mk(z.notiz || "");
      }
      g.addEventListener("click", waehlen);
      g.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); waehlen(); }
      });
    });

    /* Maßlinien am linken Rand */
    (d.masse || []).forEach(function (m) {
      var l = document.createElementNS(NSB, "path");
      l.setAttribute("d", "M-16 " + m.bei + "H-3");
      l.setAttribute("class", "brief-mass");
      svg.appendChild(l);
      var t = document.createElementNS(NSB, "text");
      t.setAttribute("x", -17); t.setAttribute("y", m.bei + 2.4);
      t.setAttribute("text-anchor", "end");
      t.setAttribute("class", "brief-masstext");
      t.textContent = m.text;
      svg.appendChild(t);
    });

    buehne.appendChild(svg);
    notiz.innerHTML = mk("Klick auf einen Bereich des Briefs.");
    buehne.appendChild(notiz);
  }

  /* ---------- 11 · Lagerkurve ----------
     Der Sägezahn. Bestand fällt gleichmäßig, springt bei Lieferung hoch.
     Der Meldebestand ist keine willkürliche Zahl, sondern genau der Punkt,
     an dem der Vorrat noch für die Lieferzeit reicht — das sieht man erst,
     wenn man die Lieferzeit verschiebt und die Linie mitwandert.            */

  function gLagerkurve(buehne, d) {
    var NSL = "http://www.w3.org/2000/svg";
    var e = d.eingaben;
    var regler = el("div", "staffel-regler");
    var felder = {};

    ["verbrauch", "lieferzeit", "mindest", "menge"].forEach(function (schl) {
      if (!e[schl]) return;
      var f = el("div", "feld");
      f.appendChild(el("label", null, e[schl].label));
      var i = document.createElement("input");
      AP.kommafeld(i);
      i.min = e[schl].min; i.max = e[schl].max; i.step = e[schl].schritt || 1;
      i.value = e[schl].start;
      f.appendChild(i);
      regler.appendChild(f);
      felder[schl] = i;
    });
    buehne.appendChild(regler);

    var huelle = el("div", "lager-buehne weit");
    buehne.appendChild(huelle);
    var ergebnis = el("div", "lager-ergebnis");
    buehne.appendChild(ergebnis);

    var B = 620, H = 260, LI = 58, RE = 14, OB = 18, UN = 34;

    function zahl(i, fallback) {
      var v = AP.zahl(i, NaN);
      return isNaN(v) || v < 0 ? fallback : v;
    }

    function zeichne() {
      var verbrauch = Math.max(1, zahl(felder.verbrauch, 50));
      var lieferzeit = Math.max(0, zahl(felder.lieferzeit, 5));
      var mindest = zahl(felder.mindest, 100);
      var menge = Math.max(1, zahl(felder.menge, 1000));

      var meldebestand = verbrauch * lieferzeit + mindest;
      var hoechst = mindest + menge;
      var tageProZyklus = menge / verbrauch;
      var tageGesamt = tageProZyklus * 2.6;

      huelle.innerHTML = "";
      var svg = document.createElementNS(NSL, "svg");
      svg.setAttribute("viewBox", "0 0 " + B + " " + H);
      svg.setAttribute("class", "lager-svg");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label",
        "Lagerbestand über die Zeit. Meldebestand " + Math.round(meldebestand) + " Stück.");

      var obenWert = Math.max(hoechst, meldebestand) * 1.12;
      function x(tag) { return LI + (tag / tageGesamt) * (B - LI - RE); }
      function y(wert) { return OB + (1 - wert / obenWert) * (H - OB - UN); }

      function linie(wert, klasse, text) {
        var l = document.createElementNS(NSL, "line");
        l.setAttribute("x1", LI); l.setAttribute("x2", B - RE);
        l.setAttribute("y1", y(wert)); l.setAttribute("y2", y(wert));
        l.setAttribute("class", klasse);
        svg.appendChild(l);
        var t = document.createElementNS(NSL, "text");
        t.setAttribute("x", LI - 6); t.setAttribute("y", y(wert) + 3.5);
        t.setAttribute("text-anchor", "end");
        t.setAttribute("class", klasse + "-schrift");
        t.textContent = text;
        svg.appendChild(t);
      }

      // Achsen
      var achse = document.createElementNS(NSL, "path");
      achse.setAttribute("d", "M" + LI + " " + OB + "V" + y(0) + "H" + (B - RE));
      achse.setAttribute("class", "lager-achse");
      svg.appendChild(achse);

      linie(mindest, "lager-mindest", "Mindest");
      linie(meldebestand, "lager-melde", "Melde");
      linie(hoechst, "lager-hoechst", "Höchst");

      // Sägezahn
      var punkte = [], tag = 0, bestand = hoechst;
      punkte.push([0, hoechst]);
      while (tag < tageGesamt) {
        var bisMindest = (bestand - mindest) / verbrauch;
        if (tag + bisMindest >= tageGesamt) {
          punkte.push([tageGesamt, bestand - (tageGesamt - tag) * verbrauch]);
          break;
        }
        tag += bisMindest;
        punkte.push([tag, mindest]);
        bestand = hoechst;
        punkte.push([tag, hoechst]);
      }
      var zug = document.createElementNS(NSL, "path");
      zug.setAttribute("d", punkte.map(function (p, i) {
        return (i ? "L" : "M") + x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1);
      }).join(""));
      zug.setAttribute("class", "lager-zug");
      svg.appendChild(zug);

      // Lieferzeit-Fenster im ersten Zyklus
      var tMelde = (hoechst - meldebestand) / verbrauch;
      if (tMelde >= 0 && tMelde <= tageGesamt) {
        var band = document.createElementNS(NSL, "rect");
        band.setAttribute("x", x(tMelde));
        band.setAttribute("y", OB);
        band.setAttribute("width", Math.max(0, x(tMelde + lieferzeit) - x(tMelde)));
        band.setAttribute("height", y(0) - OB);
        band.setAttribute("class", "lager-band");
        svg.insertBefore(band, svg.firstChild);

        var marke = document.createElementNS(NSL, "circle");
        marke.setAttribute("cx", x(tMelde)); marke.setAttribute("cy", y(meldebestand));
        marke.setAttribute("r", 4.5);
        marke.setAttribute("class", "lager-punkt");
        svg.appendChild(marke);

        var bt = document.createElementNS(NSL, "text");
        bt.setAttribute("x", x(tMelde) + 7);
        bt.setAttribute("y", OB + 13);
        bt.setAttribute("class", "lager-bandschrift");
        bt.textContent = "Lieferzeit " + lieferzeit + " Tage";
        svg.appendChild(bt);
      }

      var zeit = document.createElementNS(NSL, "text");
      zeit.setAttribute("x", B - RE); zeit.setAttribute("y", H - 10);
      zeit.setAttribute("text-anchor", "end");
      zeit.setAttribute("class", "lager-achsschrift");
      zeit.textContent = "Zeit in Tagen";
      svg.appendChild(zeit);

      huelle.appendChild(svg);

      ergebnis.innerHTML = "";
      var rechnung = el("div", "lager-rechnung");
      rechnung.innerHTML = "Meldebestand = " + verbrauch + " × " + lieferzeit +
        " + " + Math.round(mindest) + " = <b>" + Math.round(meldebestand) + " Stück</b>";
      ergebnis.appendChild(rechnung);

      if (meldebestand >= hoechst) {
        ergebnis.appendChild(mkEl("p", "lager-warnung",
          "Der Meldebestand liegt über dem Höchstbestand: Die Lieferzeit ist länger, " +
          "als die Bestellmenge reicht. Du müsstest nachbestellen, bevor die vorige " +
          "Lieferung da ist. **Bestellmenge erhöhen oder Lieferzeit verkürzen.**"));
      }
    }

    Object.keys(felder).forEach(function (k) {
      felder[k].addEventListener("input", zeichne);
    });
    zeichne();
  }

  /* ---------- 12 · Entscheidungsmatrix ----------
     Zwei Achsen, vier Felder, Aufgaben einsortieren. Gebaut für Eisenhower,
     aber nicht darauf festgelegt — die Achsen und Felder kommen aus den Daten.

     Bewusst per Klick statt Ziehen: Das funktioniert am Handy zuverlässig
     und lässt sich mit der Tastatur bedienen.                                */

  function gMatrix(buehne, d) {
    var offen = d.aufgaben.map(function (a, i) { return i; });
    var gewaehlt = null;
    var richtig = 0;

    var kopf = el("div", "mx-kopf");
    var zaehler = el("span", "mx-zahl");
    zaehler.innerHTML = "<b>0</b>/" + d.aufgaben.length + " richtig";
    kopf.appendChild(el("span", null, "Aufgabe wählen, dann Feld anklicken"));
    kopf.appendChild(zaehler);
    buehne.appendChild(kopf);

    var stapel = el("div", "mx-stapel");
    buehne.appendChild(stapel);

    var raster = el("div", "mx-raster");
    var yAchse = el("div", "mx-achse-y", d.achsen.y);
    var xAchse = el("div", "mx-achse-x", d.achsen.x);
    raster.appendChild(yAchse);

    var netz = el("div", "mx-netz");
    var felder = {};
    d.felder.forEach(function (f) {
      var k = el("button", "mx-feld");
      k.setAttribute("type", "button");
      k.style.gridColumn = (f.x ? 2 : 1);
      k.style.gridRow = (f.y ? 1 : 2);
      k.appendChild(el("span", "mx-feld-name", f.name));
      var korb = el("div", "mx-korb");
      k.appendChild(korb);
      k.addEventListener("click", function () { ablegen(f, korb); });
      netz.appendChild(k);
      felder[f.id] = { knopf: k, korb: korb, daten: f };
    });
    raster.appendChild(netz);
    raster.appendChild(xAchse);
    buehne.appendChild(raster);

    var echo = el("p", "mx-echo");
    buehne.appendChild(echo);

    function zeichneStapel() {
      stapel.innerHTML = "";
      if (!offen.length) {
        stapel.appendChild(el("div", "mx-fertig",
          "Alle Aufgaben einsortiert — " + richtig + " von " + d.aufgaben.length + " richtig."));
        return;
      }
      offen.forEach(function (i) {
        var a = d.aufgaben[i];
        var chip = el("button", "mx-chip" + (gewaehlt === i ? " an" : ""), a.text);
        chip.setAttribute("type", "button");
        chip.addEventListener("click", function () {
          gewaehlt = (gewaehlt === i ? null : i);
          zeichneStapel();
        });
        stapel.appendChild(chip);
      });
    }

    function ablegen(f, korb) {
      if (gewaehlt === null) {
        echo.textContent = "Wähle zuerst eine Aufgabe oben aus.";
        echo.className = "mx-echo da";
        return;
      }
      var i = gewaehlt;
      var a = d.aufgaben[i];
      var passt = a.feld === f.id;
      if (passt) richtig++;

      var karte = el("div", "mx-abgelegt" + (passt ? " gut" : " schlecht"), a.text);
      var ziel = passt ? korb : felder[a.feld].korb;
      if (!passt) karte.title = "gehört hierher";
      ziel.appendChild(karte);

      echo.innerHTML = "";
      echo.appendChild(mkEl("span", null,
        (passt ? "**Richtig.** " : "**Gehört ins Feld „" + felder[a.feld].daten.name + "\".** ") + a.echo));
      echo.className = "mx-echo da " + (passt ? "gut" : "schlecht");

      offen = offen.filter(function (x) { return x !== i; });
      gewaehlt = null;
      zaehler.querySelector("b").textContent = richtig;
      zeichneStapel();
    }

    zeichneStapel();
  }

  /* ---------- 13 · Liquiditätsverlauf ----------
     Monatsbalken plus Bestandslinie. Der Lerneffekt steckt im Regler für das
     Zahlungsziel: Der Gewinn bleibt gleich, der Bestand kippt trotzdem ins
     Minus. Genau daran scheitern Betriebe — nicht an fehlendem Ertrag.       */

  function gLiquiditaet(buehne, d) {
    var NSQ = "http://www.w3.org/2000/svg";
    var regler = el("div", "staffel-regler");
    var felder = {};

    [["start", d.eingaben.start], ["ziel", d.eingaben.ziel]].forEach(function (paar) {
      if (!paar[1]) return;
      var f = el("div", "feld");
      f.appendChild(el("label", null, paar[1].label));
      var i = document.createElement("input");
      AP.kommafeld(i);
      i.min = paar[1].min; i.max = paar[1].max; i.step = paar[1].schritt || 1;
      i.value = paar[1].start;
      f.appendChild(i);
      regler.appendChild(f);
      felder[paar[0]] = i;
    });
    buehne.appendChild(regler);

    var huelle = el("div", "liq-buehne weit");
    buehne.appendChild(huelle);
    var ergebnis = el("div", "liq-ergebnis");
    buehne.appendChild(ergebnis);

    var B = 620, H = 250, LI = 62, RE = 12, OB = 16, UN = 40;

    function zeichne() {
      var start = AP.zahl(felder.start, 0);
      var verzug = felder.ziel ? (parseInt(felder.ziel.value, 10) || 0) : 0;
      // Ein voller Monat Verzug schiebt eine Einzahlung nach hinten
      var schub = Math.round(verzug / 30);

      var bestand = start, verlauf = [], tiefster = start, tiefMonat = -1;
      d.monate.forEach(function (m, i) {
        var quelle = i - schub;
        var ein = quelle >= 0 ? d.monate[quelle].ein : 0;
        bestand += ein - m.aus;
        verlauf.push({ name: m.name, ein: ein, aus: m.aus, bestand: bestand });
        if (bestand < tiefster) { tiefster = bestand; tiefMonat = i; }
      });

      var werte = verlauf.map(function (v) { return v.bestand; }).concat([0, start]);
      var max = Math.max.apply(null, werte), min = Math.min.apply(null, werte);
      var spanne = (max - min) || 1;
      var oben = max + spanne * 0.15, unten = min - spanne * 0.15;

      function x(i) { return LI + (i + 0.5) * ((B - LI - RE) / verlauf.length); }
      function y(w) { return OB + (1 - (w - unten) / (oben - unten)) * (H - OB - UN); }

      huelle.innerHTML = "";
      var svg = document.createElementNS(NSQ, "svg");
      svg.setAttribute("viewBox", "0 0 " + B + " " + H);
      svg.setAttribute("class", "liq-svg");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", "Liquiditätsverlauf über " + verlauf.length +
        " Monate, tiefster Stand " + Math.round(tiefster) + " Euro.");

      // Nulllinie
      var null0 = document.createElementNS(NSQ, "line");
      null0.setAttribute("x1", LI); null0.setAttribute("x2", B - RE);
      null0.setAttribute("y1", y(0)); null0.setAttribute("y2", y(0));
      null0.setAttribute("class", "liq-null");
      svg.appendChild(null0);
      var nt = document.createElementNS(NSQ, "text");
      nt.setAttribute("x", LI - 6); nt.setAttribute("y", y(0) + 3.5);
      nt.setAttribute("text-anchor", "end");
      nt.setAttribute("class", "liq-nullschrift");
      nt.textContent = "0 €";
      svg.appendChild(nt);

      var breite = (B - LI - RE) / verlauf.length * 0.44;
      verlauf.forEach(function (v, i) {
        var hoch = document.createElementNS(NSQ, "rect");
        var oben2 = Math.min(y(v.bestand), y(0));
        hoch.setAttribute("x", x(i) - breite / 2);
        hoch.setAttribute("y", oben2);
        hoch.setAttribute("width", breite);
        hoch.setAttribute("height", Math.abs(y(v.bestand) - y(0)));
        hoch.setAttribute("class", "liq-balken" + (v.bestand < 0 ? " minus" : ""));
        svg.appendChild(hoch);

        var mt = document.createElementNS(NSQ, "text");
        mt.setAttribute("x", x(i)); mt.setAttribute("y", H - 22);
        mt.setAttribute("text-anchor", "middle");
        mt.setAttribute("class", "liq-monat");
        mt.textContent = v.name;
        svg.appendChild(mt);

        var wt = document.createElementNS(NSQ, "text");
        wt.setAttribute("x", x(i));
        wt.setAttribute("y", v.bestand < 0 ? y(0) - 5 : oben2 - 5);
        wt.setAttribute("text-anchor", "middle");
        wt.setAttribute("class", "liq-wert" + (v.bestand < 0 ? " minus" : ""));
        wt.textContent = Math.round(v.bestand / 100) / 10 + "k";
        svg.appendChild(wt);
      });

      huelle.appendChild(svg);

      ergebnis.innerHTML = "";
      var summeEin = verlauf.reduce(function (s, v) { return s + v.ein; }, 0);
      var summeAus = verlauf.reduce(function (s, v) { return s + v.aus; }, 0);
      var gesamtEin = d.monate.reduce(function (s, m) { return s + m.ein; }, 0);
      var spaeter = gesamtEin - summeEin;

      var zeile = el("div", "liq-rechnung");
      zeile.innerHTML = "Einzahlungen im Zeitraum " + geld(summeEin) +
        " · Auszahlungen " + geld(summeAus) +
        " · tiefster Stand <b>" + geld(tiefster) + "</b>";
      ergebnis.appendChild(zeile);

      if (spaeter > 0) {
        // Wichtig fürs Verständnis: Das Geld ist nicht weg, es liegt hinter dem Fenster
        ergebnis.appendChild(mkEl("p", "liq-hinweis",
          "Durch die Verschiebung fallen " + geld(spaeter) + " hinter den geplanten " +
          "Zeitraum. Verloren ist davon nichts — der Betrieb sieht das Geld nur " +
          "später, und genau deshalb muss der Plan weit genug reichen."));
      }

      if (tiefster < 0) {
        ergebnis.appendChild(mkEl("p", "liq-warnung",
          "Im Monat **" + verlauf[tiefMonat].name + "** fehlen " + geld(-tiefster) +
          ". Der Betrieb ist nicht unrentabel — er ist **illiquid**. Nötig ist eine " +
          "Kreditlinie in dieser Höhe, ein kürzeres Zahlungsziel oder eine gestreckte Auszahlung."));
      } else {
        ergebnis.appendChild(mkEl("p", "liq-gut",
          "Der Bestand bleibt durchgehend positiv. Zahlungsfähigkeit ist gesichert."));
      }
    }

    Object.keys(felder).forEach(function (k) {
      felder[k].addEventListener("input", zeichne);
    });
    zeichne();
  }

  /* ---------- 14 · Break-Even ----------
     Erlös- und Kostengerade, dazu der Schnittpunkt. Der Lerneffekt: Nur die
     Fixkosten verschieben die Menge stark — am Preis zu drehen wirkt anders
     als an den variablen Kosten, obwohl beides "einen Euro" ausmacht.        */

  function gBreakeven(buehne, d) {
    var NSB2 = "http://www.w3.org/2000/svg";
    var regler = el("div", "staffel-regler");
    var felder = {};

    ["fix", "var", "preis"].forEach(function (schl) {
      if (!d.eingaben[schl]) return;
      var f = el("div", "feld");
      f.appendChild(el("label", null, d.eingaben[schl].label));
      var i = document.createElement("input");
      AP.kommafeld(i);
      i.min = d.eingaben[schl].min; i.max = d.eingaben[schl].max;
      i.step = d.eingaben[schl].schritt || 1;
      i.value = d.eingaben[schl].start;
      f.appendChild(i);
      regler.appendChild(f);
      felder[schl] = i;
    });
    buehne.appendChild(regler);

    var huelle = el("div", "be-buehne weit");
    buehne.appendChild(huelle);
    var ergebnis = el("div", "be-ergebnis");
    buehne.appendChild(ergebnis);

    var B = 620, H = 260, LI = 66, RE = 14, OB = 18, UN = 34;

    function zeichne() {
      var fix = Math.max(0, AP.zahl(felder.fix, 0));
      var vari = Math.max(0, AP.zahl(felder["var"], 0));
      var preis = Math.max(0, AP.zahl(felder.preis, 0));

      var db = preis - vari;                       // Deckungsbeitrag je Stück
      var menge = db > 0 ? fix / db : null;
      var maxMenge = menge ? Math.ceil(menge * 1.8 / 50) * 50 : 1000;
      var maxWert = Math.max(preis * maxMenge, fix + vari * maxMenge) * 1.05 || 1;

      function x(m) { return LI + (m / maxMenge) * (B - LI - RE); }
      function y(w) { return OB + (1 - w / maxWert) * (H - OB - UN); }

      huelle.innerHTML = "";
      var svg = document.createElementNS(NSB2, "svg");
      svg.setAttribute("viewBox", "0 0 " + B + " " + H);
      svg.setAttribute("class", "be-svg");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", menge
        ? "Break-Even bei " + Math.ceil(menge) + " Stück."
        : "Kein Break-Even: Der Preis deckt die variablen Kosten nicht.");

      var achse = document.createElementNS(NSB2, "path");
      achse.setAttribute("d", "M" + LI + " " + OB + "V" + y(0) + "H" + (B - RE));
      achse.setAttribute("class", "be-achse");
      svg.appendChild(achse);

      function gerade(x1, y1, x2, y2, klasse) {
        var l = document.createElementNS(NSB2, "line");
        l.setAttribute("x1", x1); l.setAttribute("y1", y1);
        l.setAttribute("x2", x2); l.setAttribute("y2", y2);
        l.setAttribute("class", klasse);
        svg.appendChild(l);
      }
      function schrift(px, py, text, klasse, anker) {
        var t = document.createElementNS(NSB2, "text");
        t.setAttribute("x", px); t.setAttribute("y", py);
        if (anker) t.setAttribute("text-anchor", anker);
        t.setAttribute("class", klasse);
        t.textContent = text;
        svg.appendChild(t);
      }

      // Gewinnfläche rechts vom Schnittpunkt
      if (menge && menge < maxMenge) {
        var flaeche = document.createElementNS(NSB2, "polygon");
        flaeche.setAttribute("points", [
          x(menge) + "," + y(preis * menge),
          x(maxMenge) + "," + y(preis * maxMenge),
          x(maxMenge) + "," + y(fix + vari * maxMenge)
        ].join(" "));
        flaeche.setAttribute("class", "be-gewinn");
        svg.appendChild(flaeche);
      }

      gerade(x(0), y(fix), x(maxMenge), y(fix), "be-fix");
      schrift(LI - 6, y(fix) + 3.5, "Fixkosten", "be-fixschrift", "end");

      gerade(x(0), y(fix), x(maxMenge), y(fix + vari * maxMenge), "be-kosten");
      schrift(x(maxMenge) - 4, y(fix + vari * maxMenge) - 6, "Gesamtkosten", "be-kostenschrift", "end");

      gerade(x(0), y(0), x(maxMenge), y(preis * maxMenge), "be-erloes");
      schrift(x(maxMenge) - 4, y(preis * maxMenge) + 14, "Erlöse", "be-erloesschrift", "end");

      if (menge && menge <= maxMenge) {
        var punkt = document.createElementNS(NSB2, "circle");
        punkt.setAttribute("cx", x(menge)); punkt.setAttribute("cy", y(preis * menge));
        punkt.setAttribute("r", 5);
        punkt.setAttribute("class", "be-punkt");
        svg.appendChild(punkt);
        gerade(x(menge), y(preis * menge), x(menge), y(0), "be-lot");
        schrift(x(menge), H - 12, Math.ceil(menge) + " Stück", "be-punktschrift", "middle");
      }

      huelle.appendChild(svg);

      ergebnis.innerHTML = "";
      if (db <= 0) {
        ergebnis.appendChild(mkEl("p", "be-warnung",
          "Der Preis deckt nicht einmal die variablen Kosten. Der Deckungsbeitrag ist " +
          geld(db) + " je Stück — **jedes verkaufte Stück vergrößert den Verlust.** " +
          "Hier hilft keine Menge, nur ein höherer Preis oder niedrigere variable Kosten."));
        return;
      }
      var zeile = el("div", "be-rechnung");
      zeile.innerHTML = "Deckungsbeitrag " + geld(db) + " je Stück · Break-Even = " +
        geld(fix) + " ÷ " + geld(db) + " = <b>" + Math.ceil(menge) + " Stück</b>";
      ergebnis.appendChild(zeile);
      ergebnis.appendChild(mkEl("p", "be-hinweis",
        "Ab dem " + (Math.ceil(menge) + 1) + ". Stück verdient jedes weitere " +
        geld(db) + " — die Fixkosten sind dann bereits gedeckt."));
    }

    Object.keys(felder).forEach(function (k) {
      felder[k].addEventListener("input", zeichne);
    });
    zeichne();
  }

  /* ---------- 15 · Durchlaufzeit ----------
     Ein Balken, in Abschnitte zerlegt. Die Erkenntnis, die jeden überrascht:
     Der Anteil echter Bearbeitung ist winzig. Wer den Prozess beschleunigen
     will, muss an die Liegezeiten — nicht an die Leute.                      */

  function gDurchlauf(buehne, d) {
    var kopf = el("div", "dl-kopf");
    kopf.appendChild(el("span", null, "Werte anpassen und den Flussgrad beobachten"));
    buehne.appendChild(kopf);

    var regler = el("div", "dl-regler");
    var felder = [];
    d.abschnitte.forEach(function (a, i) {
      var f = el("div", "feld");
      f.appendChild(el("label", null, a.name + " (" + d.einheit + ")"));
      var inp = document.createElement("input");
      AP.kommafeld(inp); inp.min = "0";
      inp.value = a.wert;
      f.appendChild(inp);
      regler.appendChild(f);
      felder.push(inp);
    });
    buehne.appendChild(regler);

    var balken = el("div", "dl-balken");
    balken.setAttribute("role", "img");
    buehne.appendChild(balken);
    var legende = el("div", "dl-legende");
    buehne.appendChild(legende);
    var ergebnis = el("div", "dl-ergebnis");
    buehne.appendChild(ergebnis);

    function zeichne() {
      var werte = felder.map(function (i) { return Math.max(0, AP.zahl(i, 0)); });
      var gesamt = werte.reduce(function (s, w) { return s + w; }, 0);
      if (!gesamt) gesamt = 1;

      balken.innerHTML = "";
      legende.innerHTML = "";
      d.abschnitte.forEach(function (a, i) {
        var anteil = werte[i] / gesamt * 100;
        var teil = el("div", "dl-teil " + a.art);
        teil.style.width = anteil + "%";
        if (anteil >= 8) teil.appendChild(el("span", null, Math.round(anteil) + " %"));
        teil.title = a.name + ": " + werte[i] + " " + d.einheit;
        balken.appendChild(teil);

        var l = el("div", "dl-eintrag");
        l.appendChild(el("span", "dl-punkt " + a.art));
        l.appendChild(el("span", "dl-name", a.name));
        l.appendChild(el("span", "dl-wert", werte[i] + " " + d.einheit));
        legende.appendChild(l);
      });
      balken.setAttribute("aria-label",
        "Durchlaufzeit " + gesamt + " " + d.einheit + ", davon " +
        werte[0] + " " + d.einheit + " Bearbeitung.");

      var wert = werte.reduce(function (s, w, i) {
        return s + (d.abschnitte[i].art === "wert" ? w : 0);
      }, 0);
      var flussgrad = wert / gesamt * 100;

      ergebnis.innerHTML = "";
      var zeile = el("div", "dl-rechnung");
      zeile.innerHTML = "Durchlaufzeit " + Math.round(gesamt * 10) / 10 + " " + d.einheit +
        " · davon wertschöpfend " + Math.round(wert * 10) / 10 + " " + d.einheit +
        " · Flussgrad <b>" + Math.round(flussgrad * 10) / 10 + " %</b>";
      ergebnis.appendChild(zeile);

      ergebnis.appendChild(mkEl("p", "dl-hinweis", flussgrad < 25
        ? "Über **" + Math.round(100 - flussgrad) + " %** der Durchlaufzeit wird nicht gearbeitet, " +
          "sondern gewartet, transportiert oder geprüft. Wer schneller werden will, kürzt hier — " +
          "nicht bei der Bearbeitung."
        : "Ein Flussgrad in dieser Höhe ist für Büroprozesse ungewöhnlich hoch. Prüfe, ob wirklich " +
          "alle Liege- und Transportzeiten erfasst sind — sie werden regelmäßig unterschätzt."));
    }

    felder.forEach(function (i) { i.addEventListener("input", zeichne); });
    zeichne();
  }

  /* ---------- 16 · Balkenplan ----------
     Vorgänge auf einer Zeitachse, mit Abhängigkeiten. Wer einen Vorgang
     verschiebt, sieht sofort, ob das Ende mitwandert — daran versteht man
     den kritischen Pfad besser als an jeder Definition.                     */

  function gBalkenplan(buehne, d) {
    var gewaehlt = null;
    var verzug = {};

    var kopf = el("div", "bp-kopf");
    kopf.appendChild(el("span", null, "Vorgang anklicken und verzögern"));
    var ende = el("span", "bp-ende");
    kopf.appendChild(ende);
    buehne.appendChild(kopf);

    var gitter = el("div", "bp-gitter");
    buehne.appendChild(gitter);

    var steuer = el("div", "bp-steuer");
    buehne.appendChild(steuer);
    var notiz = el("p", "bp-notiz");
    buehne.appendChild(notiz);

    /* Früheste Lage: ein Vorgang startet, wenn alle Vorgänger fertig sind. */
    function rechne() {
      var lage = {};
      var offen = d.vorgaenge.slice();
      var schutz = 0;
      while (offen.length && schutz++ < 200) {
        offen = offen.filter(function (v) {
          var bereit = (v.nach || []).every(function (id) { return lage[id]; });
          if (!bereit) return true;
          var start = (v.nach || []).reduce(function (s, id) {
            return Math.max(s, lage[id].ende);
          }, 0);
          var dauer = v.dauer + (verzug[v.id] || 0);
          lage[v.id] = { start: start, ende: start + dauer, dauer: dauer };
          return false;
        });
      }
      return lage;
    }

    function zeichne() {
      var lage = rechne();
      var gesamt = Math.max.apply(null, d.vorgaenge.map(function (v) {
        return lage[v.id] ? lage[v.id].ende : 0;
      })) || 1;

      // Kritisch ist, was ohne Puffer am Ende hängt — rückwärts markiert
      var kritisch = {};
      (function markiere(bis) {
        d.vorgaenge.forEach(function (v) {
          var l = lage[v.id];
          if (l && Math.abs(l.ende - bis) < 0.001 && !kritisch[v.id]) {
            kritisch[v.id] = true;
            markiere(l.start);
          }
        });
      })(gesamt);

      gitter.innerHTML = "";
      d.vorgaenge.forEach(function (v) {
        var l = lage[v.id];
        if (!l) return;
        var reihe = el("div", "bp-reihe" + (gewaehlt === v.id ? " an" : ""));

        var name = el("button", "bp-name", v.name);
        name.setAttribute("type", "button");
        name.addEventListener("click", function () {
          gewaehlt = (gewaehlt === v.id ? null : v.id);
          zeichne();
        });
        reihe.appendChild(name);

        var spur = el("div", "bp-spur");
        var anteil = l.dauer / gesamt * 100;
        var balken = el("div", "bp-balken" + (kritisch[v.id] ? " kritisch" : "") +
          ((verzug[v.id] || 0) ? " verzoegert" : ""));
        balken.style.marginLeft = (l.start / gesamt * 100) + "%";
        balken.style.width = anteil + "%";
        var text = l.dauer + " " + (l.dauer === 1 && d.einheit_eins ? d.einheit_eins : d.einheit);
        balken.title = v.name + ": " + text;
        // Schmale Balken schneiden ihre Beschriftung ab — dann steht sie daneben
        if (anteil >= 14) balken.appendChild(el("span", null, text));
        spur.appendChild(balken);
        if (anteil < 14) spur.appendChild(el("span", "bp-aussen", text));
        reihe.appendChild(spur);

        gitter.appendChild(reihe);
      });

      ende.textContent = "Projektende: " + gesamt + " " + d.einheit;
      ende.className = "bp-ende" + (gesamt > d.plan ? " spaet" : "");

      steuer.innerHTML = "";
      if (gewaehlt) {
        var v = d.vorgaenge.filter(function (x) { return x.id === gewaehlt; })[0];
        var f = el("div", "feld");
        f.appendChild(el("label", null, v.name + " verzögert sich um (" + d.einheit + ")"));
        var inp = document.createElement("input");
        inp.type = "number"; inp.min = "0"; inp.max = "30"; inp.step = "1";
        inp.value = verzug[gewaehlt] || 0;
        inp.addEventListener("input", function () {
          verzug[gewaehlt] = Math.max(0, parseInt(inp.value, 10) || 0);
          zeichne();
          inp.focus();
        });
        f.appendChild(inp);
        steuer.appendChild(f);

        notiz.innerHTML = "";
        notiz.appendChild(mkEl("span", null, kritisch[gewaehlt]
          ? "**" + v.name + " liegt auf dem kritischen Pfad.** Jeder Tag Verzug " +
            "verschiebt das Projektende um denselben Tag."
          : "**" + v.name + " hat Puffer.** Eine Verzögerung wirkt sich erst aus, " +
            "wenn der Puffer aufgebraucht ist — probier es mit größeren Werten."));
      } else {
        notiz.textContent = "Goldene Balken liegen auf dem kritischen Pfad, blasse haben Puffer.";
      }

      gitter.setAttribute("aria-label", "Balkenplan mit " + d.vorgaenge.length +
        " Vorgängen, Projektende nach " + gesamt + " " + d.einheit + ".");
    }

    gitter.setAttribute("role", "img");
    zeichne();
  }

  /* ---------- 9 · Staffel ---------- */

  var MONATSNAMEN = ["Januar","Februar","März","April","Mai","Juni",
                     "Juli","August","September","Oktober","November","Dezember"];

  function alsDatum(d) { return d.getDate() + ". " + MONATSNAMEN[d.getMonth()] + " " + d.getFullYear(); }
  function monatsEnde(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

  /* Errechnet den Beendigungstermin aus Zugang und anzuwendender Stufe */
  function terminAus(zugang, stufe) {
    var d = new Date(zugang.getTime());
    if (stufe.monate) {
      d.setMonth(d.getMonth() + stufe.monate);
      return monatsEnde(d);                       // Frist läuft nur zum Monatsende
    }
    d.setDate(d.getDate() + (stufe.wochen || 4) * 7);
    var fuenfzehnter = new Date(d.getFullYear(), d.getMonth(), 15);
    if (d <= fuenfzehnter) return fuenfzehnter;   // 15. oder Monatsende, je nachdem was zuerst passt
    return monatsEnde(d);
  }

  function gStaffel(buehne, d) {
    var regler = el("div", "staffel-regler");

    var fJahre = el("div", "feld");
    fJahre.appendChild(el("label", null, d.eingaben.jahre.label));
    var iJahre = document.createElement("input");
    iJahre.type = "number"; iJahre.min = "0"; iJahre.max = "50"; iJahre.step = "1";
    iJahre.value = d.eingaben.jahre.start;
    fJahre.appendChild(iJahre);
    regler.appendChild(fJahre);

    var iDatum = null;
    if (d.eingaben.datum) {
      var fDatum = el("div", "feld");
      fDatum.appendChild(el("label", null, d.eingaben.datum.label));
      iDatum = document.createElement("input");
      iDatum.type = "date"; iDatum.value = d.eingaben.datum.start;
      fDatum.appendChild(iDatum);
      regler.appendChild(fDatum);
    }
    buehne.appendChild(regler);

    var leiste = el("div", "staffel");
    var reihen = d.stufen.map(function (s) {
      var r = el("div", "staffel-stufe");
      r.appendChild(el("span", "st-ab", s.ab === 0 ? "unter " + d.stufen[1].ab + " Jahren"
                                                    : "ab " + s.ab + " Jahren"));
      var balken = el("div", "st-balken");
      balken.style.width = (18 + (s.monate || 0) * 11.5) + "%";
      r.appendChild(balken);
      r.appendChild(el("span", "st-frist", s.frist));
      r.appendChild(el("span", "st-termin", s.termin));
      leiste.appendChild(r);
      return r;
    });
    buehne.appendChild(leiste);

    var ergebnis = el("div", "staffel-ergebnis");
    buehne.appendChild(ergebnis);

    function rechne() {
      var jahre = parseInt(iJahre.value, 10);
      if (isNaN(jahre) || jahre < 0) jahre = 0;
      var treffer = 0;
      d.stufen.forEach(function (s, i) { if (jahre >= s.ab) treffer = i; });
      reihen.forEach(function (r, i) { r.classList.toggle("an", i === treffer); });

      var s = d.stufen[treffer];
      var text = "<b>" + s.frist + "</b> " + s.termin;
      if (iDatum && iDatum.value) {
        var zugang = new Date(iDatum.value + "T12:00:00");
        if (!isNaN(zugang.getTime())) {
          text += " — Zugang am " + alsDatum(zugang)
            + ", das Arbeitsverhältnis endet am <b>" + alsDatum(terminAus(zugang, s)) + "</b>.";
        }
      }
      ergebnis.innerHTML = text;
    }
    iJahre.addEventListener("input", rechne);
    if (iDatum) iDatum.addEventListener("input", rechne);
    rechne();
  }

  /* ---------- 6 · Vergleich ---------- */

  function gVergleich(buehne, d) {
    var gitter = el("div", "vgl");
    d.seiten.forEach(function (s) {
      var sp = el("div", "vgl-seite " + (s.ton || "gold"));
      sp.appendChild(el("div", "vgl-kopf", s.name));
      s.punkte.forEach(function (p) {
        var box = el("div", "vgl-punkt");
        box.appendChild(mkEl("div", "vgl-text", p.text));
        box.appendChild(mkEl("div", "vgl-detail", p.detail || ""));
        box.addEventListener("click", function () { box.classList.toggle("auf"); });
        sp.appendChild(box);
      });
      gitter.appendChild(sp);
    });
    buehne.appendChild(gitter);
  }

  /* ---------- 7 · Organigramm ---------- */

  var ORG = { bw: 132, bh: 44, luecke: 16, ebene: 112, rand: 10, radius: 7 };

  function gOrganigramm(buehne, d) {
    var ebenen = [], stabDaten = null;
    d.ebenen.forEach(function (eb, i) {
      if (eb.stab && eb.stab.length) stabDaten = { s: eb.stab[0], ebene: i };
      ebenen.push((eb.stellen || []).map(function (s) {
        var k = {}; Object.keys(s).forEach(function (x) { k[x] = s[x]; });
        k.ebene = i; k.kinder = []; return k;
      }));
    });
    var alle = [];
    ebenen.forEach(function (r) { alle = alle.concat(r); });
    var nach = {};
    alle.forEach(function (k) { nach[k.id] = k; });

    /* Eltern ableiten, wenn nicht angegeben */
    alle.forEach(function (k) {
      if (k.ebene === 0) { k.eltern = null; return; }
      if (!k.eltern) {
        var oben = ebenen[k.ebene - 1];
        k.eltern = oben.length === 1 ? oben[0].id : null;
      }
    });
    alle.forEach(function (k) {
      if (k.eltern && nach[k.eltern]) nach[k.eltern].kinder.push(k);
    });

    /* Baum legen: Blätter nebeneinander, Eltern über die Mitte ihrer Kinder */
    var blatt = 0;
    function legen(k) {
      if (!k.kinder.length) { k.x = blatt * (ORG.bw + ORG.luecke); blatt++; }
      else {
        k.kinder.forEach(legen);
        k.x = (k.kinder[0].x + k.kinder[k.kinder.length - 1].x) / 2;
      }
      k.y = k.ebene * ORG.ebene;
    }
    var wurzel = ebenen[0][0];
    legen(wurzel);

    var breite = blatt * (ORG.bw + ORG.luecke) - ORG.luecke;
    var hoehe = (ebenen.length - 1) * ORG.ebene + ORG.bh;

    /* Stabsstelle rechts an der Linie unter der Wurzel */
    var stab = null;
    if (stabDaten) {
      stab = stabDaten.s;
      stab.x = Math.max(wurzel.x + ORG.bw * 1.55, breite - ORG.bw);
      stab.y = wurzel.y + ORG.bh + (ORG.ebene - ORG.bh) / 4 - ORG.bh / 2;
      breite = Math.max(breite, stab.x + ORG.bw);
    }

    var NS2 = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS2, "svg");
    svg.setAttribute("viewBox",
      (-ORG.rand) + " " + (-ORG.rand) + " " + (breite + ORG.rand * 2) + " " + (hoehe + ORG.rand * 2));
    svg.setAttribute("class", "orgsvg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Organigramm " + (d.titel || ""));

    /* --- Verbinder: ein Pfad je Kind, mit gerundeten Knicken --- */
    function elbogen(kind) {
      var el = nach[kind.eltern];
      var x1 = kind.x + ORG.bw / 2, y1 = kind.y;
      var x2 = el.x + ORG.bw / 2, y2 = el.y + ORG.bh;
      var bus = el.y + ORG.bh + (ORG.ebene - ORG.bh) / 2;
      if (Math.abs(x1 - x2) < 1) return "M" + x1 + " " + y1 + "V" + y2;
      var r = Math.min(ORG.radius, Math.abs(x1 - x2) / 2);
      var ri = x1 < x2 ? 1 : -1;
      return "M" + x1 + " " + y1
        + "V" + (bus + r)
        + "Q" + x1 + " " + bus + " " + (x1 + ri * r) + " " + bus
        + "H" + (x2 - ri * r)
        + "Q" + x2 + " " + bus + " " + x2 + " " + (bus - r)
        + "V" + y2;
    }

    var pfade = {};
    alle.forEach(function (k) {
      if (!k.eltern || !nach[k.eltern]) return;
      var p = document.createElementNS(NS2, "path");
      p.setAttribute("d", elbogen(k));
      p.setAttribute("class", "orgline");
      svg.appendChild(p);
      pfade[k.id] = p;
    });

    /* Stabslinie: zweigt seitlich vom Stamm ab */
    if (stab) {
      var stammX = wurzel.x + ORG.bw / 2;
      var stabY = stab.y + ORG.bh / 2;
      var sp = document.createElementNS(NS2, "path");
      sp.setAttribute("d", "M" + stammX + " " + stabY + "H" + stab.x);
      sp.setAttribute("class", "orgline stab");
      svg.appendChild(sp);
      var punkt = document.createElementNS(NS2, "circle");
      punkt.setAttribute("cx", stammX); punkt.setAttribute("cy", stabY);
      punkt.setAttribute("r", 2.8); punkt.setAttribute("class", "orgpunkt");
      svg.appendChild(punkt);
    }

    /* --- Kästen --- */
    var knoten = {};
    function kasten(k, art) {
      var g = document.createElementNS(NS2, "g");
      g.setAttribute("class", "orgn " + (art || ""));
      g.setAttribute("tabindex", "0");
      g.setAttribute("transform", "translate(" + k.x + "," + k.y + ")");
      var r = document.createElementNS(NS2, "rect");
      r.setAttribute("width", ORG.bw); r.setAttribute("height", ORG.bh);
      r.setAttribute("rx", 2);
      g.appendChild(r);
      var worte = k.name.split(" ");
      var zeilen = k.name.length > 17 && worte.length > 1
        ? [worte.slice(0, Math.ceil(worte.length / 2)).join(" "),
           worte.slice(Math.ceil(worte.length / 2)).join(" ")]
        : [k.name];
      zeilen.forEach(function (z, i) {
        var t = document.createElementNS(NS2, "text");
        t.setAttribute("x", ORG.bw / 2);
        t.setAttribute("y", ORG.bh / 2 + 4 + (i - (zeilen.length - 1) / 2) * 13);
        t.setAttribute("text-anchor", "middle");
        t.textContent = z;
        g.appendChild(t);
      });
      svg.appendChild(g);
      knoten[k.id] = g;
      return g;
    }

    alle.forEach(function (k) { kasten(k, k.art); });
    if (stab) kasten(stab, "stab");

    var notiz = el("div", "org-notiz");
    notiz.innerHTML = mk("Klick auf eine Stelle — der Dienstweg nach oben leuchtet mit.");

    function waehlen(k) {
      Object.keys(knoten).forEach(function (id) { knoten[id].classList.remove("an", "weg"); });
      Object.keys(pfade).forEach(function (id) { pfade[id].classList.remove("an"); });
      var kette = [], lauf = k;
      while (lauf) { kette.push(lauf.id); lauf = lauf.eltern ? nach[lauf.eltern] : null; }
      kette.forEach(function (id, i) {
        knoten[id].classList.add("an");
        if (i < kette.length - 1 && pfade[id]) pfade[id].classList.add("an");
      });
      notiz.innerHTML = mk(k.notiz || "");
    }

    alle.forEach(function (k) {
      knoten[k.id].addEventListener("click", function () { waehlen(k); });
      knoten[k.id].addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); waehlen(k); }
      });
    });
    if (stab) {
      knoten[stab.id].addEventListener("click", function () {
        Object.keys(knoten).forEach(function (id) { knoten[id].classList.remove("an"); });
        Object.keys(pfade).forEach(function (id) { pfade[id].classList.remove("an"); });
        knoten[stab.id].classList.add("an");
        notiz.innerHTML = mk(stab.notiz || "");
      });
    }

    buehne.appendChild(svg);
    buehne.appendChild(notiz);

    /* Auftritt: erst die Linien zeichnen, dann die Ebenen setzen */
    if (ruhigAn()) return;
    Object.keys(pfade).forEach(function (id) {
      var p = pfade[id], l = p.getTotalLength();
      p.style.strokeDasharray = l; p.style.strokeDashoffset = l;
      p.style.transition = "stroke-dashoffset .7s ease " + (nach[id].ebene * 0.22 + 0.15) + "s";
      requestAnimationFrame(function () { p.style.strokeDashoffset = 0; });
    });
    alle.concat(stab ? [stab] : []).forEach(function (k) {
      var g = knoten[k.id];
      g.style.opacity = 0; g.style.transform =
        "translate(" + k.x + "px," + (k.y + 8) + "px)";
      g.style.transition = "opacity .5s ease " + ((k.ebene || 0) * 0.22) + "s, transform .5s ease " + ((k.ebene || 0) * 0.22) + "s";
      requestAnimationFrame(function () {
        g.style.opacity = 1;
        g.style.transform = "translate(" + k.x + "px," + k.y + "px)";
      });
    });
  }

  function ruhigAn() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ---------- 8 · Wirtschaftskreislauf ---------- */

  var KREIS_POS = {
    links:   { x: 150, y: 250 },
    rechts:  { x: 550, y: 250 },
    oben:    { x: 350, y: 66 },
    unten:   { x: 350, y: 434 },
    aussen:  { x: 800, y: 250 }
  };
  var KREIS_H = 42, KREIS_LUFT = 7, NSK = "http://www.w3.org/2000/svg";

  /* Austrittspunkt am Kastenrand in Richtung eines Zielpunkts */
  function amRand(p, halbB, zx, zy) {
    var dx = zx - p.x, dy = zy - p.y;
    var sx = Math.abs(dx) < 1e-6 ? Infinity : halbB / Math.abs(dx);
    var sy = Math.abs(dy) < 1e-6 ? Infinity : (KREIS_H / 2) / Math.abs(dy);
    var s = Math.min(sx, sy);
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: p.x + dx * s + dx / len * KREIS_LUFT,
             y: p.y + dy * s + dy / len * KREIS_LUFT };
  }

  function gKreislauf(buehne, d) {
    var text = el("p", "szene-text");
    var huelle = el("div");
    var legende = el("div", "kreis-legende");
    legende.innerHTML = '<span><i class="g"></i>Güterstrom</span><span><i class="m"></i>Geldstrom</span>';

    wahlLeiste(buehne, d.stufen.map(function (s) { return s.name; }), zeichne);
    buehne.appendChild(text);
    buehne.appendChild(huelle);
    buehne.appendChild(legende);

    var pos = {}, halb = {};
    d.pole.forEach(function (p) {
      pos[p.id] = KREIS_POS[p.pos] || KREIS_POS.aussen;
      halb[p.id] = Math.max(58, p.name.length * 3.9);
    });

    function zeichne(i) {
      var s = d.stufen[i];
      text.innerHTML = mk(s.text);

      var svg = document.createElementNS(NSK, "svg");
      svg.setAttribute("class", "kreis-svg");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", "Wirtschaftskreislauf: " + s.name);
      var defs = document.createElementNS(NSK, "defs");
      defs.innerHTML =
        '<marker id="kp-guter" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#C9A227"/></marker>'
        + '<marker id="kp-geld" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#7FC4A0"/></marker>';
      svg.appendChild(defs);

      var lagen = document.createElementNS(NSK, "g");   // Pfeile
      var schrift = document.createElementNS(NSK, "g"); // Beschriftungen
      var kaesten = document.createElementNS(NSK, "g"); // Pole
      svg.appendChild(lagen); svg.appendChild(kaesten); svg.appendChild(schrift);
      huelle.innerHTML = ""; huelle.appendChild(svg);

      /* Ströme nach Paaren gruppieren, damit parallele Wege sich fächern */
      var gruppen = {};
      s.stroeme.forEach(function (st) {
        var k = [st.von, st.nach].sort().join("~");
        (gruppen[k] = gruppen[k] || []).push(st);
      });

      var teile = [];
      Object.keys(gruppen).forEach(function (k) {
        gruppen[k].forEach(function (st, idx, arr) {
          var a = pos[st.von], b = pos[st.nach];
          if (!a || !b) return;
          var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          var dx = b.x - a.x, dy = b.y - a.y;
          var len = Math.sqrt(dx * dx + dy * dy) || 1;
          var nx = -dy / len, ny = dx / len;
          var weit = (idx - (arr.length - 1) / 2) * (arr.length > 2 ? 54 : 46);
          var cx = mx + nx * weit, cy = my + ny * weit;

          var p1 = amRand(a, halb[st.von], cx, cy);
          var p2 = amRand(b, halb[st.nach], cx, cy);

          var pfad = document.createElementNS(NSK, "path");
          pfad.setAttribute("d", "M" + p1.x + " " + p1.y + " Q" + cx + " " + cy + " " + p2.x + " " + p2.y);
          pfad.setAttribute("class", "kreis-pfeil " + st.art);
          pfad.setAttribute("marker-end", "url(#kp-" + st.art + ")");
          lagen.appendChild(pfad);

          /* Beschriftung entlang der Kurve versetzen, nicht alle in die Mitte */
          var t = 0.5 + (idx - (arr.length - 1) / 2) * 0.15;
          var lx = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * cx + t * t * p2.x;
          var ly = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * cy + t * t * p2.y;

          var g = document.createElementNS(NSK, "g");
          g.setAttribute("class", "kreis-schild " + st.art);
          var grund = document.createElementNS(NSK, "rect");
          var txt = document.createElementNS(NSK, "text");
          txt.setAttribute("x", lx); txt.setAttribute("y", ly + 3.5);
          txt.setAttribute("text-anchor", "middle");
          txt.textContent = st.label;
          g.appendChild(grund); g.appendChild(txt);
          schrift.appendChild(g);
          teile.push({ pfad: pfad, schild: g, grund: grund, txt: txt, art: st.art });
        });
      });

      /* Pole zeichnen */
      d.pole.forEach(function (pol) {
        if (s.pole.indexOf(pol.id) < 0) return;
        var p = pos[pol.id], hb = halb[pol.id];
        var g = document.createElementNS(NSK, "g");
        g.setAttribute("class", "kreis-pol");
        var r = document.createElementNS(NSK, "rect");
        r.setAttribute("x", p.x - hb); r.setAttribute("y", p.y - KREIS_H / 2);
        r.setAttribute("width", hb * 2); r.setAttribute("height", KREIS_H);
        r.setAttribute("rx", 2);
        g.appendChild(r);
        var t2 = document.createElementNS(NSK, "text");
        t2.setAttribute("x", p.x); t2.setAttribute("y", p.y + 4.5);
        t2.setAttribute("text-anchor", "middle");
        t2.textContent = pol.name;
        g.appendChild(t2);
        kaesten.appendChild(g);
      });

      /* Schilder hinterlegen, damit kein Text auf einer Linie liegt */
      teile.forEach(function (x) {
        var bb = x.txt.getBBox();
        x.kasten = { x: bb.x - 5, y: bb.y - 2.5, w: bb.width + 10, h: bb.height + 5 };
        x.vx = 0; x.vy = 0;
        x.grund.setAttribute("x", x.kasten.x);
        x.grund.setAttribute("y", x.kasten.y);
        x.grund.setAttribute("width", x.kasten.w);
        x.grund.setAttribute("height", x.kasten.h);
        x.grund.setAttribute("rx", 2);
      });

      /* Schilder auseinanderschieben, bis sich keine mehr überlagern */
      var polkaesten = d.pole.filter(function (pl) { return s.pole.indexOf(pl.id) >= 0; })
        .map(function (pl) {
          return { x: pos[pl.id].x - halb[pl.id], y: pos[pl.id].y - KREIS_H / 2,
                   w: halb[pl.id] * 2, h: KREIS_H };
        });
      function jetzt(x) {
        return { x: x.kasten.x + x.vx, y: x.kasten.y + x.vy, w: x.kasten.w, h: x.kasten.h };
      }
      function stossen(a, b, luft) {
        var ax = a.x + a.w / 2, ay = a.y + a.h / 2;
        var bx = b.x + b.w / 2, by = b.y + b.h / 2;
        var ux = (a.w + b.w) / 2 + luft - Math.abs(ax - bx);
        var uy = (a.h + b.h) / 2 + luft - Math.abs(ay - by);
        if (ux <= 0 || uy <= 0) return null;
        return uy < ux
          ? { x: 0, y: (ay < by ? -1 : 1) * (uy / 2 + 0.5) }
          : { x: (ax < bx ? -1 : 1) * (ux / 2 + 0.5), y: 0 };
      }
      for (var runde = 0; runde < 14; runde++) {
        var bewegt = false;
        for (var m = 0; m < teile.length; m++) {
          for (var n2 = m + 1; n2 < teile.length; n2++) {
            var v = stossen(jetzt(teile[m]), jetzt(teile[n2]), 5);
            if (!v) continue;
            teile[m].vx += v.x; teile[m].vy += v.y;
            teile[n2].vx -= v.x; teile[n2].vy -= v.y;
            bewegt = true;
          }
          for (var q = 0; q < polkaesten.length; q++) {
            var w2 = stossen(jetzt(teile[m]), polkaesten[q], 6);
            if (!w2) continue;
            teile[m].vx += w2.x * 2; teile[m].vy += w2.y * 2;
            bewegt = true;
          }
        }
        if (!bewegt) break;
      }
      teile.forEach(function (x) {
        if (x.vx || x.vy) {
          x.schild.setAttribute("transform",
            "translate(" + x.vx.toFixed(1) + "," + x.vy.toFixed(1) + ")");
        }
      });

      /* Zeichenfläche auf den Inhalt zuschneiden — kein toter Raum */
      var bb = svg.getBBox();
      var rand = 14;
      svg.setAttribute("viewBox",
        Math.round(bb.x - rand) + " " + Math.round(bb.y - rand) + " "
        + Math.round(bb.width + rand * 2) + " " + Math.round(bb.height + rand * 2));

      if (ruhigAn()) return;

      /* Auftritt der Reihe nach: erst die Pole, dann Güter, dann Geld */
      Array.prototype.forEach.call(kaesten.children, function (g, k) {
        g.style.opacity = 0;
        g.style.transition = "opacity .45s ease " + (k * 0.07) + "s";
        requestAnimationFrame(function () { g.style.opacity = 1; });
      });
      var vor = d.pole.length * 0.07 + 0.25;
      ["guter", "geld"].forEach(function (art) {
        teile.filter(function (x) { return x.art === art; }).forEach(function (x, k) {
          var l = x.pfad.getTotalLength();
          var vz = vor + k * 0.11;
          x.pfad.style.strokeDasharray = l;
          x.pfad.style.strokeDashoffset = l;
          x.pfad.style.transition = "stroke-dashoffset .8s ease " + vz + "s";
          x.schild.style.opacity = 0;
          x.schild.style.transition = "opacity .4s ease " + (vz + 0.55) + "s";
          requestAnimationFrame(function () {
            x.pfad.style.strokeDashoffset = 0;
            x.schild.style.opacity = 1;
          });
        });
        vor += teile.filter(function (x) { return x.art === art; }).length * 0.11 + 0.2;
      });
    }

    zeichne(0);
  }

  /* ================================================== Start

     Ganz zuletzt: Jetzt steht alles bereit, was zeigeKapitel anfasst. Welches
     Kapitel erscheint, entscheidet die Adresse — dadurch führt ein geteilter
     Link genau dorthin, und die Zurück-Taste tut, was sie soll.               */

  verteiler = AP.verteiler(zeigeKapitel, "start");
})();
