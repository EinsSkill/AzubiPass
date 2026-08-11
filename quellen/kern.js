/* AzubiPass · Kern
   ---------------------------------------------------------------------------
   Was App und Lernzettel gemeinsam brauchen: das Konto, in dem der Lernstand
   liegt, der Sprungverteiler, die Leiste unten, das Blatt von unten.

   Alles hängt an window.AP. Kein Baukasten, keine Abhängigkeit — die Seiten
   laden diese Datei einmal und der Zwischenspeicher behält sie.                */

window.AP = (function () {
  "use strict";

  /* ================================================== Kleinkram */

  function el(tag, klasse, text) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* Auszeichnungssyntax — dieselbe wie im Fließtext, hier für Texte, die erst
     im Browser entstehen (Karten, Suchtreffer, Grafikbeschriftungen). */
  function mk(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\{\{(?:begriff|par):[a-z0-9-]+\|(.+?)\}\}/g, "$1")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(?<!\w)\*(.+?)\*(?!\w)/g, "<em>$1</em>")
      .replace(/==(.+?)==/g, "<mark>$1</mark>");
  }

  function mkEl(tag, klasse, text) {
    var e = el(tag, klasse);
    e.innerHTML = mk(text);
    return e;
  }

  /* Zahl aus einem Eingabefeld — mit Komma.

     Am deutschen Handy tippt man „12,5". <input type=number> nimmt aber nur den
     Punkt und liefert dann einen leeren Wert: Der Rechner rechnet einfach nicht
     und niemand sieht, warum. Deshalb stehen die Rechenfelder auf type=text mit
     inputmode=decimal — Zahlentastatur, aber wir lesen selbst. */
  function zahl(feld, ersatz) {
    var roh = String(feld && feld.value != null ? feld.value : "").trim().replace(",", ".");
    var n = parseFloat(roh);
    return isNaN(n) ? (ersatz === undefined ? 0 : ersatz) : n;
  }

  /* Macht aus einem Zahlenfeld eines, das Komma versteht. */
  function kommafeld(input, schritt) {
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    if (schritt) input.dataset.schritt = schritt;
    return input;
  }

  var datumsformat = new Intl.DateTimeFormat("de-DE", {
    day: "numeric", month: "long", year: "numeric"
  });

  function tagesschluessel(d) {
    d = d || new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function plusTage(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return tagesschluessel(d);
  }

  function tageBis(schluessel) {
    if (!schluessel) return 0;
    var teile = schluessel.split("-").map(Number);
    var ziel = new Date(teile[0], teile[1] - 1, teile[2]);
    var heute = new Date();
    heute.setHours(0, 0, 0, 0);
    return Math.round((ziel - heute) / 86400000);
  }

  /* Ist das ein Tagesschlüssel, den tageBis rechnen kann?

     Nicht nur die Form prüfen: "2026-02-31" passt aufs Muster und wird vom
     Date-Objekt klaglos zum 3. März — der Countdown zeigt dann einen Tag an,
     den es nie gab. Deshalb zurückrechnen und vergleichen. */
  function istDatum(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var t = s.split("-").map(Number);
    var d = new Date(t[0], t[1] - 1, t[2]);
    return d.getFullYear() === t[0] && d.getMonth() === t[1] - 1 && d.getDate() === t[2];
  }

  /* ================================================== Konto

     Ein Eintrag für alles. Vorher lag pro Lernzettel ein eigener, und keiner
     wusste vom anderen — ein Gesamtfortschritt, eine Suche über alles oder ein
     Kartenstapel aus allen Lernfeldern waren damit nicht zu haben.

     Geschrieben wird verzögert: Beim Tippen im Selbsttest sonst bei jedem
     Zeichen.                                                                   */

  var SCHLUESSEL = "azubipass:konto";
  var FASSUNG = 1;

  var leer = {
    version: FASSUNG,
    fortschritt: {},      // "lf10-k4" → { ziele, checks, zuordnen, test, fertig }
    karten: {},           // "lf10-k4-b2-m1" → { fach, faellig, fehler }
    quiz: {},             // Übungsteil: "lf10-k4-b2-c1" → { r: richtig?, n: Versuche }
    lesezeichen: [],      // { zu, titel, lernfeld }
    aktivitaet: [],       // Tage, an denen etwas gelernt wurde
    zuletzt: null,        // { zu, lernfeld, kapitel, titel }
    pruefungstermin: null,// eigener Termin; null = der aus landing.config.json
    stimmung: "system",
    uebernommen: false
  };

  function frisch() { return JSON.parse(JSON.stringify(leer)); }

  var stand = laden();

  function laden() {
    var roh;
    try {
      roh = localStorage.getItem(SCHLUESSEL);
    } catch (e) {
      // Privater Modus oder Speicher gesperrt: Die App muss trotzdem laufen,
      // sie merkt sich dann eben nichts.
      return frisch();
    }
    if (!roh) return uebernehmen(frisch());
    try {
      var k = JSON.parse(roh);
      Object.keys(leer).forEach(function (f) {
        if (k[f] === undefined) k[f] = JSON.parse(JSON.stringify(leer[f]));
      });
      return k;
    } catch (e) {
      return frisch();
    }
  }

  /* Der alte Bestand: ein Eintrag je Lernzettel, benannt azubipass:<lernfeld>.
     Die Haken, Checks, Zuordnungen und Selbsttest-Texte lassen sich sauber
     übernehmen — sie hängen an Abschnitts- und Aufgabennummern.

     Der Kartenstand wird bewusst NICHT übernommen. Er lag unter der Position im
     Stapel, nicht unter einer Kennung; genau daran ist er ja verrutscht. Ihn zu
     übertragen hieße, den Fehler mitzunehmen. Lieber einmal von vorn. */
  function uebernehmen(neu) {
    var gefunden = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var name = localStorage.key(i);
        if (!name || name.indexOf("azubipass:") !== 0 || name === SCHLUESSEL) continue;
        var lernfeld = name.slice("azubipass:".length);
        var alt;
        try { alt = JSON.parse(localStorage.getItem(name)); } catch (e) { continue; }
        if (!alt || typeof alt !== "object") continue;

        Object.keys(alt).forEach(function (kap) {
          if (kap.charAt(0) === "#" || kap === "karten") return;
          var f = alt[kap];
          if (!f || typeof f !== "object") return;
          neu.fortschritt[lernfeld + "-" + kap] = {
            ziele: f.ziele || [],
            checks: f.checks || {},
            zuordnen: f.zuordnen || {},
            test: f.test || {},
            fertig: false
          };
          gefunden++;
        });
        if (alt["#kap"] && !neu.zuletzt) {
          neu.zuletzt = { zu: lernfeld + ".html#" + alt["#kap"], lernfeld: lernfeld };
        }
      }
    } catch (e) { /* Speicher nicht lesbar — dann eben ohne */ }
    neu.uebernommen = gefunden > 0;
    return neu;
  }

  var wartet = false;
  function sichern() {
    if (wartet) return;
    wartet = true;
    setTimeout(function () {
      wartet = false;
      try {
        localStorage.setItem(SCHLUESSEL, JSON.stringify(stand));
      } catch (e) {
        // Speicher voll oder gesperrt. Nichts kaputtmachen, nichts behaupten.
      }
    }, 400);
  }

  /* Fach eines Kapitels. Kein Textabdruck mehr auf dieser Ebene — der sitzt
     jetzt am einzelnen Baustein. Ein korrigiertes Komma hat vorher den ganzen
     Kapitelstand weggeworfen. */
  function kapitelfach(lernfeld, kapitel) {
    var s = lernfeld + "-" + kapitel;
    var f = stand.fortschritt[s];
    if (!f) {
      f = stand.fortschritt[s] = { ziele: [], checks: {}, zuordnen: {}, test: {}, fertig: false };
    }
    ["ziele", "checks", "zuordnen", "test"].forEach(function (k) {
      if (!f[k]) f[k] = (k === "ziele" ? [] : {});
    });
    return f;
  }

  /* Billiger Abdruck — jedes siebte Zeichen genügt, um eine Textänderung zu
     sehen. Wird nur noch für einzelne Aufgaben benutzt: Ändert sich die Frage,
     ist die gespeicherte Antwort wertlos und wird verworfen. Ändert sich der
     Absatz daneben, bleibt sie. */
  function abdruck(s) {
    var h = 0;
    for (var i = 0; i < s.length; i += 7) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  function heuteGelernt() {
    var t = tagesschluessel();
    if (stand.aktivitaet.indexOf(t) === -1) {
      stand.aktivitaet.push(t);
      if (stand.aktivitaet.length > 400) stand.aktivitaet = stand.aktivitaet.slice(-400);
      sichern();
    }
  }

  /* ================================================== Karten · Leitner mit Wartezeit

     Fünf Fächer, jedes mit einer Wartezeit. Der alte Kasten kannte nur Fächer:
     Man konnte eine Karte dreimal in derselben Minute „gewusst" klicken und sie
     galt als sitzend. Verteiltes Wiederholen ist aber genau die Zeitkomponente. */

  var WARTEN = [0, 1, 3, 7, 21];        // Tage bis zur nächsten Vorlage je Fach
  var FAECHER = WARTEN.length;

  /* Nachsehen und Eintragen sind zwei verschiedene Dinge.

     Vorher legte schon die Frage „ist diese Karte fällig?" einen Eintrag an —
     einmal den Übungsteil geöffnet und es standen 139 Karteileichen im Konto,
     alle mit demselben Standardwert. Das bläht die Sicherungsdatei auf und
     täuscht einen Lernstand vor, den es nicht gibt. Geschrieben wird jetzt
     erst, wenn jemand eine Karte tatsächlich bewertet. */
  function kartenblick(id) {
    return stand.karten[id] || { fach: 1, faellig: tagesschluessel(), fehler: 0 };
  }

  function kartenstand(id) {
    if (!stand.karten[id]) stand.karten[id] = kartenblick(id);
    return stand.karten[id];
  }

  function istFaellig(id) {
    return tageBis(kartenblick(id).faellig) <= 0;
  }

  function kartewerten(id, gewusst) {
    var k = kartenstand(id);
    if (gewusst) {
      k.fach = Math.min(k.fach + 1, FAECHER);
    } else {
      k.fach = 1;
      k.fehler = (k.fehler || 0) + 1;
    }
    k.faellig = plusTage(WARTEN[k.fach - 1]);
    heuteGelernt();
    sichern();
    return k;
  }

  /* ================================================== Karten-Trainer

     Steht hier und nicht im Lernzettel, weil ihn zwei Stellen brauchen: der
     Trainer am Ende eines Lernfelds und der Übungsteil der App, der über alle
     Lernfelder geht. Zwei Fassungen hießen zwei Leitner-Regeln.                */

  function trainer(buehne, anzeige, karten, beiWechsel) {
    if (!buehne) return;
    var vorarbeiten = false;

    function faellig() {
      return karten.filter(function (k) {
        return vorarbeiten || istFaellig(k.id);
      });
    }

    function ziehen() {
      var rest = faellig();
      if (!rest.length) return null;
      var tiefstes = Math.min.apply(null, rest.map(function (k) { return kartenblick(k.id).fach; }));
      var topf = rest.filter(function (k) { return kartenblick(k.id).fach === tiefstes; });
      return topf[Math.floor(Math.random() * topf.length)];
    }

    function faecherZeichnen() {
      if (!anzeige) return;
      anzeige.innerHTML = "";
      for (var f = 1; f <= FAECHER; f++) {
        var n = karten.filter(function (k) { return kartenblick(k.id).fach === f; }).length;
        var s = el("div", "tr-fach" + (f === FAECHER ? " sitzt" : ""));
        s.appendChild(el("b", null, String(n)));
        s.appendChild(el("span", null, f === FAECHER ? "sitzt" : "Fach " + f));
        anzeige.appendChild(s);
      }
    }

    /* Keine fälligen Karten heißt nicht „nichts zu tun" — es heißt „du bist
       durch". Ein leerer Bildschirm sagt das nicht, also sagt es der Text. */
    function ruhepause() {
      buehne.innerHTML = "";
      var naechster = karten.reduce(function (min, k) {
        var t = tageBis(kartenblick(k.id).faellig);
        return t < min ? t : min;
      }, 9999);

      var box = el("div", "tr-fertig");
      box.appendChild(el("h3", null, "Für heute durch."));
      box.appendChild(el("p", null, naechster >= 9999
        ? "Es sind keine Karten hinterlegt."
        : naechster <= 1
          ? "Die nächsten Karten sind morgen wieder dran. Verteiltes Wiederholen wirkt genau deshalb — jetzt noch einmal durchzugehen bringt kaum etwas."
          : "Die nächsten " + karten.filter(function (k) {
              return tageBis(kartenblick(k.id).faellig) === naechster;
            }).length + " Karten sind in " + naechster + " Tagen dran."));
      var weiter = el("button", "start", "Trotzdem weiter üben");
      weiter.addEventListener("click", function () {
        vorarbeiten = true;
        naechste();
      });
      box.appendChild(weiter);
      buehne.appendChild(box);
    }

    function naechste() {
      var k = ziehen();
      if (!k) return ruhepause();

      buehne.innerHTML = "";
      var karte = el("div", "tr-karte");

      var vorn = el("div", "tr-seite");
      var herkunft = k.lernfeldTitel
        ? k.lernfeldTitel + " · " + k.kapitel
        : k.kapitel;
      vorn.appendChild(el("div", "tr-herkunft", herkunft));
      vorn.appendChild(mkEl("p", "tr-frage", k.frage));
      var zeigen = el("button", "dreher", "Antwort zeigen");
      vorn.appendChild(zeigen);
      karte.appendChild(vorn);
      buehne.appendChild(karte);
      zeigen.focus({ preventScroll: true });

      zeigen.addEventListener("click", function () {
        var hinten = el("div", "tr-antwort");
        hinten.appendChild(el("div", "bk", "Merksatz"));
        hinten.appendChild(mkEl("p", null, k.antwort));

        var reihe = el("div", "tr-urteil");
        var nochmal = el("button", "tr-nochmal", "Nochmal");
        var gewusst = el("button", "tr-gewusst", "Wusste ich");
        nochmal.addEventListener("click", function () { werten(k, false); });
        gewusst.addEventListener("click", function () { werten(k, true); });
        reihe.appendChild(nochmal);
        reihe.appendChild(gewusst);
        hinten.appendChild(reihe);

        zeigen.remove();
        karte.appendChild(hinten);
        requestAnimationFrame(function () { hinten.classList.add("da"); });
        gewusst.focus({ preventScroll: true });
      });
    }

    function werten(k, gewusst) {
      kartewerten(k.id, gewusst);
      faecherZeichnen();
      if (beiWechsel) beiWechsel();
      naechste();
    }

    faecherZeichnen();
    naechste();
  }

  /* ================================================== Sprungverteiler

     Ein Kapitel bekommt eine Adresse. Vorher änderte ein Kapitelwechsel nichts
     an der Adresse — die Zurück-Taste des Handys verließ deshalb die Seite,
     statt ein Kapitel zurückzugehen, und ein Kapitel ließ sich nicht verlinken.

     Absichtlich über die Raute und nicht über die History-API: So funktioniert
     dieselbe Seite auch, wenn jemand sie als Datei öffnet.                     */

  function verteiler(zeigen, anfang) {
    function jetzt() {
      return decodeURIComponent(location.hash.replace(/^#/, "")) || anfang;
    }
    window.addEventListener("hashchange", function () { zeigen(jetzt()); });
    zeigen(jetzt());
    return { jetzt: jetzt, geheZu: function (id) { location.hash = "#" + id; } };
  }

  /* ================================================== Leiste unten */

  function leiste() {
    var bar = document.querySelector(".tableiste");
    if (!bar) return;

    // Aktiven Reiter aus dem Bereich der Seite bestimmen
    var bereich = document.body.dataset.bereich;
    if (bereich) {
      var treffer = bar.querySelector('.tab[href$="#' + bereich + '"]');
      if (treffer) { treffer.classList.add("an"); treffer.setAttribute("aria-current", "page"); }
    }

    // Beim Lesen weichen: 56 px dauerhaft vom Lesefenster sind am Handy viel.
    var letzte = window.scrollY, ruht = false;
    window.addEventListener("scroll", function () {
      if (ruht) return;
      ruht = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        if (Math.abs(y - letzte) > 6) {
          bar.classList.toggle("weg", y > letzte && y > 140);
          letzte = y;
        }
        ruht = false;
      });
    }, { passive: true });
  }

  /* ================================================== Zwischenspeicher

     Registriert wird hier und nicht in der App: Wer einen Lernzettel direkt
     geschickt bekommt und nie die Startseite öffnet, soll ihn trotzdem danach
     ohne Netz lesen können.                                                    */

  function sw() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") {
      return Promise.resolve(null);
    }
    return navigator.serviceWorker.register("sw.js").catch(function () { return null; });
  }

  /* ================================================== Lesezeichen */

  function gemerkt(zu) {
    return stand.lesezeichen.some(function (e) { return e.zu === zu; });
  }

  function merken(eintrag) {
    var i = stand.lesezeichen.map(function (e) { return e.zu; }).indexOf(eintrag.zu);
    if (i >= 0) stand.lesezeichen.splice(i, 1);
    else stand.lesezeichen.push(eintrag);
    sichern();
    return i < 0;
  }

  /* ================================================== Stimmung */

  function stimmungSetzen(wert) {
    stand.stimmung = wert;
    sichern();
    stimmungAnwenden();
  }

  function stimmungAnwenden() {
    var w = stand.stimmung || "system";
    if (w === "system") delete document.documentElement.dataset.stimmung;
    else document.documentElement.dataset.stimmung = w;
  }

  stimmungAnwenden();
  document.addEventListener("DOMContentLoaded", function () { leiste(); sw(); });

  return {
    el: el, mk: mk, mkEl: mkEl, zahl: zahl, kommafeld: kommafeld,
    tagesschluessel: tagesschluessel, plusTage: plusTage, tageBis: tageBis,
    istDatum: istDatum, datumsformat: datumsformat,
    stand: stand, sichern: sichern, kapitelfach: kapitelfach, abdruck: abdruck,
    heuteGelernt: heuteGelernt, frisch: frisch, SCHLUESSEL: SCHLUESSEL,
    kartenstand: kartenstand, istFaellig: istFaellig, kartewerten: kartewerten,
    WARTEN: WARTEN, FAECHER: FAECHER, trainer: trainer,
    verteiler: verteiler, sw: sw,
    gemerkt: gemerkt, merken: merken,
    stimmungSetzen: stimmungSetzen
  };
})();
