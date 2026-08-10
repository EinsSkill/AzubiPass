(function () {
  "use strict";

  var ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var schmal = function () { return window.innerWidth < 1000; };
  var eur = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

  /* ============================================ Kopfzeile */
  var kopf = document.getElementById("kopf");
  function beimScrollen() {
    kopf.classList.toggle("fest", window.scrollY > window.innerHeight - 90);
  }
  window.addEventListener("scroll", beimScrollen, { passive: true });
  beimScrollen();

  /* ============================================ Auftritt beim Scrollen */
  var seher = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("da"); seher.unobserve(e.target); }
    });
  }, { threshold: .12, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".rein").forEach(function (x) { seher.observe(x); });

  /* ============================================ Zahlen zählen hoch */
  var zaehlSeher = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target, ziel = parseInt(el.dataset.zaehl, 10), start = performance.now();
      function schritt(t) {
        var p = Math.min((t - start) / 900, 1);
        el.textContent = Math.round(ziel * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(schritt);
      }
      requestAnimationFrame(schritt);
      zaehlSeher.unobserve(el);
    });
  }, { threshold: 1 });
  document.querySelectorAll("[data-zaehl]").forEach(function (x) { zaehlSeher.observe(x); });

  /* ============================================ Wirtschaftskreislauf */

  var POS = {
    haushalte:   { x: 150, y: 250 },
    unternehmen: { x: 550, y: 250 },
    staat:       { x: 350, y: 66 },
    banken:      { x: 350, y: 434 }
  };
  var KH = 42, LUFT = 7;

  var NAMEN = {
    haushalte: "Private Haushalte", unternehmen: "Unternehmen",
    staat: "Staat", banken: "Banken"
  };

  var STUFEN = [
    { name: "Einfacher Kreislauf", pole: ["haushalte", "unternehmen"], stroeme: [
      { v: "haushalte", n: "unternehmen", a: "guter", l: "Arbeitsleistung" },
      { v: "unternehmen", n: "haushalte", a: "geld", l: "Einkommen" },
      { v: "unternehmen", n: "haushalte", a: "guter", l: "Güter" },
      { v: "haushalte", n: "unternehmen", a: "geld", l: "Konsumausgaben" }]},
    { name: "Mit Staat", pole: ["haushalte", "unternehmen", "staat"], stroeme: [
      { v: "haushalte", n: "unternehmen", a: "guter", l: "Arbeitsleistung" },
      { v: "unternehmen", n: "haushalte", a: "geld", l: "Einkommen" },
      { v: "unternehmen", n: "haushalte", a: "guter", l: "Güter" },
      { v: "haushalte", n: "unternehmen", a: "geld", l: "Konsumausgaben" },
      { v: "haushalte", n: "staat", a: "geld", l: "Steuern" },
      { v: "unternehmen", n: "staat", a: "geld", l: "Steuern" },
      { v: "staat", n: "haushalte", a: "guter", l: "Leistungen" }]},
    { name: "Erweiterter Kreislauf", pole: ["haushalte", "unternehmen", "staat", "banken"], stroeme: [
      { v: "haushalte", n: "unternehmen", a: "guter", l: "Arbeitsleistung" },
      { v: "unternehmen", n: "haushalte", a: "geld", l: "Einkommen" },
      { v: "unternehmen", n: "haushalte", a: "guter", l: "Güter" },
      { v: "haushalte", n: "unternehmen", a: "geld", l: "Konsumausgaben" },
      { v: "haushalte", n: "staat", a: "geld", l: "Steuern" },
      { v: "unternehmen", n: "staat", a: "geld", l: "Steuern" },
      { v: "staat", n: "haushalte", a: "guter", l: "Leistungen" },
      { v: "haushalte", n: "banken", a: "geld", l: "Ersparnisse" },
      { v: "banken", n: "unternehmen", a: "geld", l: "Kredite" }]}
  ];

  var huelle = document.getElementById("kreislauf");
  var stufeName = document.getElementById("stufeName");
  var NS = "http://www.w3.org/2000/svg";

  function svgEl(t, attr) {
    var e = document.createElementNS(NS, t);
    Object.keys(attr || {}).forEach(function (k) { e.setAttribute(k, attr[k]); });
    return e;
  }
  function halbBreite(id) { return Math.max(58, NAMEN[id].length * 3.9); }
  function amRand(p, hb, zx, zy) {
    var dx = zx - p.x, dy = zy - p.y;
    var sx = Math.abs(dx) < 1e-6 ? Infinity : hb / Math.abs(dx);
    var sy = Math.abs(dy) < 1e-6 ? Infinity : (KH / 2) / Math.abs(dy);
    var s = Math.min(sx, sy), len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: p.x + dx * s + dx / len * LUFT, y: p.y + dy * s + dy / len * LUFT };
  }
  function stossen(a, b, luft) {
    var ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
    var ux = (a.w + b.w) / 2 + luft - Math.abs(ax - bx);
    var uy = (a.h + b.h) / 2 + luft - Math.abs(ay - by);
    if (ux <= 0 || uy <= 0) return null;
    return uy < ux ? { x: 0, y: (ay < by ? -1 : 1) * (uy / 2 + 0.5) }
                   : { x: (ax < bx ? -1 : 1) * (ux / 2 + 0.5), y: 0 };
  }

  function zeichneStufe(i) {
    var s = STUFEN[i];
    stufeName.textContent = s.name;

    var svg = svgEl("svg", { role: "img", "aria-label": "Wirtschaftskreislauf: " + s.name });
    var defs = svgEl("defs");
    defs.innerHTML =
      '<marker id="mk-guter" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#C9A227"/></marker>'
      + '<marker id="mk-geld" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#7FC4A0"/></marker>';
    svg.appendChild(defs);
    var lagen = svgEl("g"), kaesten = svgEl("g"), schrift = svgEl("g");
    svg.appendChild(lagen); svg.appendChild(kaesten); svg.appendChild(schrift);
    huelle.innerHTML = ""; huelle.appendChild(svg);

    var gruppen = {};
    s.stroeme.forEach(function (st) {
      var k = [st.v, st.n].sort().join("~");
      (gruppen[k] = gruppen[k] || []).push(st);
    });

    var teile = [];
    Object.keys(gruppen).forEach(function (k) {
      gruppen[k].forEach(function (st, idx, arr) {
        var a = POS[st.v], b2 = POS[st.n];
        var mx = (a.x + b2.x) / 2, my = (a.y + b2.y) / 2;
        var dx = b2.x - a.x, dy = b2.y - a.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var nx = -dy / len, ny = dx / len;
        var weit = (idx - (arr.length - 1) / 2) * (arr.length > 2 ? 54 : 46);
        var cx = mx + nx * weit, cy = my + ny * weit;
        var p1 = amRand(a, halbBreite(st.v), cx, cy);
        var p2 = amRand(b2, halbBreite(st.n), cx, cy);

        var pfad = svgEl("path", {
          d: "M" + p1.x + " " + p1.y + " Q" + cx + " " + cy + " " + p2.x + " " + p2.y,
          class: "kpfeil " + st.a, "marker-end": "url(#mk-" + st.a + ")"
        });
        lagen.appendChild(pfad);

        var t = 0.5 + (idx - (arr.length - 1) / 2) * 0.15;
        var lx = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * cx + t * t * p2.x;
        var ly = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * cy + t * t * p2.y;
        var g = svgEl("g", { class: "kschild " + st.a });
        var grund = svgEl("rect", {}), txt = svgEl("text",
          { x: lx, y: ly + 3.5, "text-anchor": "middle" });
        txt.textContent = st.l;
        g.appendChild(grund); g.appendChild(txt);
        schrift.appendChild(g);
        teile.push({ pfad: pfad, schild: g, grund: grund, txt: txt, art: st.a, vx: 0, vy: 0 });
      });
    });

    s.pole.forEach(function (id) {
      var p = POS[id], hb = halbBreite(id);
      var g = svgEl("g", { class: "kp" });
      g.appendChild(svgEl("rect", { x: p.x - hb, y: p.y - KH / 2, width: hb * 2, height: KH, rx: 2 }));
      var t2 = svgEl("text", { x: p.x, y: p.y + 4.5, "text-anchor": "middle" });
      t2.textContent = NAMEN[id];
      g.appendChild(t2);
      kaesten.appendChild(g);
    });

    teile.forEach(function (x) {
      var bb = x.txt.getBBox();
      x.kasten = { x: bb.x - 5, y: bb.y - 2.5, w: bb.width + 10, h: bb.height + 5 };
      x.grund.setAttribute("x", x.kasten.x); x.grund.setAttribute("y", x.kasten.y);
      x.grund.setAttribute("width", x.kasten.w); x.grund.setAttribute("height", x.kasten.h);
      x.grund.setAttribute("rx", 2);
    });

    var polkaesten = s.pole.map(function (id) {
      var hb = halbBreite(id);
      return { x: POS[id].x - hb, y: POS[id].y - KH / 2, w: hb * 2, h: KH };
    });
    function jetzt(x) { return { x: x.kasten.x + x.vx, y: x.kasten.y + x.vy, w: x.kasten.w, h: x.kasten.h }; }
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
      if (x.vx || x.vy) x.schild.setAttribute("transform",
        "translate(" + x.vx.toFixed(1) + "," + x.vy.toFixed(1) + ")");
    });

    var bb = svg.getBBox(), rand = 14;
    svg.setAttribute("viewBox", Math.round(bb.x - rand) + " " + Math.round(bb.y - rand)
      + " " + Math.round(bb.width + rand * 2) + " " + Math.round(bb.height + rand * 2));

    if (ruhig) { teile.forEach(function (x) { x.schild.style.opacity = 1; }); return; }

    Array.prototype.forEach.call(kaesten.children, function (g, k) {
      g.style.opacity = 0;
      g.style.transition = "opacity .45s ease " + (k * 0.07) + "s";
      requestAnimationFrame(function () { g.style.opacity = 1; });
    });
    var vor = s.pole.length * 0.07 + 0.25;
    ["guter", "geld"].forEach(function (art) {
      var menge = teile.filter(function (x) { return x.art === art; });
      menge.forEach(function (x, k) {
        var l = x.pfad.getTotalLength(), vz = vor + k * 0.11;
        x.pfad.style.strokeDasharray = l;
        x.pfad.style.strokeDashoffset = l;
        x.pfad.style.transition = "stroke-dashoffset .8s ease " + vz + "s";
        x.schild.style.opacity = 0;
        x.schild.style.transition = "opacity .4s ease " + (vz + 0.55) + "s";
        requestAnimationFrame(function () {
          x.pfad.style.strokeDashoffset = 0; x.schild.style.opacity = 1;
        });
      });
      vor += menge.length * 0.11 + 0.2;
    });
  }

  var stufe = 0, laeuft = null;
  function lauf() {
    zeichneStufe(stufe);
    var dauer = 3800 + STUFEN[stufe].stroeme.length * 150;
    stufe = (stufe + 1) % (schmal() ? 1 : STUFEN.length);
    laeuft = setTimeout(lauf, dauer);
  }
  lauf();
  document.addEventListener("visibilitychange", function () {
    clearTimeout(laeuft);
    if (!document.hidden) laeuft = setTimeout(lauf, 400);
  });

  /* ============================================ Selbsttest */
  var feld = document.getElementById("stAntwort");
  var zeigen = document.getElementById("stZeigen");
  var weiss = document.getElementById("stWeiss");
  var loesung = document.getElementById("stLoesung");

  var hinweis = document.createElement("div");
  hinweis.className = "kauf-hinweis";
  hinweis.innerHTML = '<span>Das war eine Frage von 34 in Lernfeld 6. '
    + 'Lernfeld 1 ist komplett gratis.</span>'
    + '<a class="kn-gold klein" href="#katalog">Lernfelder ansehen</a>';
  loesung.parentNode.appendChild(hinweis);

  feld.addEventListener("input", function () {
    zeigen.disabled = feld.value.trim().length < 3;
  });
  function aufloesen(luecke) {
    loesung.classList.add("offen");
    loesung.classList.toggle("luecke", !!luecke);
    if (luecke) loesung.querySelector(".lk").textContent = "Musterlösung · als Lücke gemerkt";
    setTimeout(function () { hinweis.classList.add("offen"); }, 700);
  }
  zeigen.addEventListener("click", function () { aufloesen(false); });
  weiss.addEventListener("click", function () {
    feld.disabled = true; zeigen.disabled = true; aufloesen(true);
  });

  /* ============================================ Mitrechnende Bilanz */
  var rVerm = document.getElementById("rVerm");
  var rSchuld = document.getElementById("rSchuld");
  var sAktiva = document.getElementById("sAktiva");
  var sPassiva = document.getElementById("sPassiva");
  var waage = document.getElementById("waage");
  var warnUeber = document.getElementById("warnUeber");

  function balken(ziel, teile, gesamt) {
    ziel.innerHTML = "";
    teile.forEach(function (t, i) {
      var b = document.createElement("div");
      b.className = "blk b" + (i + 1 + (ziel === sPassiva ? 2 : 0));
      b.innerHTML = "<div>" + t.name + "</div><span>" + eur.format(t.wert) + " €</span>";
      ziel.appendChild(b);
      requestAnimationFrame(function () {
        b.style.height = (gesamt > 0 ? Math.max(t.wert, 0) / gesamt * 170 : 0) + "px";
      });
    });
  }

  function rechne() {
    var verm = +rVerm.value, schuld = +rSchuld.value;
    var ek = verm - schuld;
    var gesamt = Math.max(verm, schuld);
    balken(sAktiva, [
      { name: "Anlagevermögen", wert: Math.round(verm * .66) },
      { name: "Umlaufvermögen", wert: verm - Math.round(verm * .66) }
    ], gesamt);
    balken(sPassiva, [
      { name: "Eigenkapital", wert: ek },
      { name: "Fremdkapital", wert: schuld }
    ], gesamt);
    waage.innerHTML = "<span>Aktiva " + eur.format(gesamt) + " €</span><span>=</span>"
      + "<span>" + eur.format(gesamt) + " € Passiva</span>";
    warnUeber.classList.toggle("da", ek < 0);
  }
  rVerm.addEventListener("input", rechne);
  rSchuld.addEventListener("input", rechne);
  rechne();

  /* ============================================ Melde-Knopf */
  var meldeKnopf = document.getElementById("meldeKnopf");
  var meldeEcho = document.getElementById("meldeEcho");
  meldeKnopf.addEventListener("click", function () {
    meldeEcho.classList.add("da");
    meldeKnopf.textContent = "Gemeldet";
    meldeKnopf.disabled = true;
  });

  /* ============================================ Countdown */
  var cd = document.getElementById("cdTage");
  var termin = new Date((window.AZUBIPASS || {}).pruefung || "2026-11-24");
  var tage = Math.max(0, Math.ceil((termin - new Date()) / 86400000));
  var start = performance.now();
  function zaehle(t) {
    var p = Math.min((t - start) / 1100, 1);
    cd.textContent = Math.round(tage * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(zaehle);
  }
  requestAnimationFrame(zaehle);

  /* ============================================ Katalogfilter */
  var stand = { jahr: "alle", teil: "alle" };
  var eintraege = Array.prototype.slice.call(document.querySelectorAll("#lfListe .lf"));
  var leer = document.getElementById("leerHinweis");

  document.querySelectorAll(".filter-gruppe").forEach(function (gruppe) {
    var feldName = gruppe.dataset.feld;
    gruppe.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        gruppe.querySelectorAll("button").forEach(function (x) { x.classList.remove("an"); });
        b.classList.add("an");
        stand[feldName] = b.dataset.wert;
        filtern();
      });
    });
  });

  function filtern() {
    var sichtbar = 0;
    eintraege.forEach(function (li) {
      var passt = (stand.jahr === "alle" || li.dataset.jahr === stand.jahr)
        && (stand.teil === "alle" || li.dataset.teil === stand.teil);
      li.classList.toggle("weg", !passt);
      if (passt) sichtbar++;
    });
    leer.classList.toggle("da", sichtbar === 0);
  }

})();
