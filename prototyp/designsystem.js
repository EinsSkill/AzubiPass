(() => {
  const root = document.documentElement;
  const ansichten = [...document.querySelectorAll('[data-ansicht]')];
  const tabs = [...document.querySelectorAll('.tab[data-ziel]')];
  const zurueck = document.querySelector('.zurueck');
  let vorher = 'lernen';

  function zeige(ziel) {
    const name = document.querySelector(`[data-ansicht="${ziel}"]`) ? ziel : 'heute';
    if (name === 'kapitel') vorher = document.querySelector('.ansicht.ist-aktiv')?.dataset.ansicht || 'lernen';
    ansichten.forEach(ansicht => ansicht.classList.toggle('ist-aktiv', ansicht.dataset.ansicht === name));
    tabs.forEach(tab => {
      const aktiv = tab.dataset.ziel === name || (name === 'kapitel' && tab.dataset.ziel === 'lernen');
      tab.classList.toggle('an', aktiv);
      tab.toggleAttribute('aria-current', aktiv);
    });
    zurueck.hidden = name !== 'kapitel';
    root.dataset.bereich = name === 'kapitel' ? 'lernen' : name;
    history.replaceState(null, '', `#${name}`);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  document.querySelectorAll('[data-ziel]').forEach(element => element.addEventListener('click', event => {
    event.preventDefault();
    zeige(element.dataset.ziel);
  }));
  document.querySelectorAll('[data-kapitel]').forEach(element => element.addEventListener('click', () => zeige('kapitel')));
  zurueck.addEventListener('click', () => zeige(vorher));

  const blatt = document.querySelector('.blatt');
  const hintergrund = document.querySelector('.blatt-hintergrund');
  let ausloeser;
  const blattinhalte = {
    begriff: ['FACHBEGRIFF', 'Aktiva', '<p>Die Aktivseite zeigt die Vermögenswerte eines Unternehmens – also, <strong>wofür das verfügbare Kapital eingesetzt wurde</strong>.</p>'],
    gesetz: ['GESETZ', '§ 266 HGB', '<p>Der Paragraph legt die Gliederung der Bilanz für Kapitalgesellschaften fest: Anlage- und Umlaufvermögen auf der Aktivseite, Eigenkapital, Rückstellungen und Verbindlichkeiten auf der Passivseite.</p>'],
    inhalt: ['KAPITEL 3', 'Inhalt', '<ol><li>Ausgangslage</li><li>Inventar</li><li><strong>Bilanzaufbau · aktuelle Position</strong></li><li>Bilanzgleichung</li><li>Praxisbeispiel</li><li>Wiederholen</li></ol>']
  };
  function oeffneBlatt(art, knopf) {
    const daten = blattinhalte[art];
    if (!daten) return;
    ausloeser = knopf;
    document.querySelector('#blatt-art').textContent = daten[0];
    document.querySelector('#blatt-titel').textContent = daten[1];
    document.querySelector('#blatt-inhalt').innerHTML = daten[2];
    blatt.hidden = false;
    hintergrund.hidden = false;
    document.body.style.overflow = 'hidden';
    document.querySelector('.blatt-zu').focus();
  }
  function schliesseBlatt() {
    blatt.hidden = true;
    hintergrund.hidden = true;
    document.body.style.overflow = '';
    ausloeser?.focus();
  }
  document.querySelectorAll('[data-blatt]').forEach(knopf => knopf.addEventListener('click', () => oeffneBlatt(knopf.dataset.blatt, knopf)));
  document.querySelector('.blatt-zu').addEventListener('click', schliesseBlatt);
  hintergrund.addEventListener('click', schliesseBlatt);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !blatt.hidden) schliesseBlatt(); });

  const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const aktiva = document.querySelector('#aktiva');
  const passiva = document.querySelector('#passiva');
  function waage() {
    const a = Number(aktiva.value);
    const p = Number(passiva.value);
    const gleich = a === p;
    ['#aktiva-wert', '#aktiva-ausgabe'].forEach(id => { document.querySelector(id).textContent = euro.format(a); });
    ['#passiva-wert', '#passiva-ausgabe'].forEach(id => { document.querySelector(id).textContent = euro.format(p); });
    document.querySelector('#aktiva-balken').style.setProperty('--hoehe', `${Math.max(18, a / 1200)}%`);
    document.querySelector('#passiva-balken').style.setProperty('--hoehe', `${Math.max(18, p / 1200)}%`);
    document.querySelector('#waage-zeichen').textContent = gleich ? '=' : '≠';
    const echo = document.querySelector('#waage-echo');
    echo.classList.toggle('fehler', !gleich);
    echo.textContent = gleich ? 'Die Bilanz ist ausgeglichen.' : `Differenz: ${euro.format(Math.abs(a - p))}. Prüfe die Gegenposition.`;
  }
  aktiva.addEventListener('input', waage);
  passiva.addEventListener('input', waage);
  document.querySelector('#waage-reset').addEventListener('click', () => { aktiva.value = 80000; passiva.value = 80000; waage(); });

  document.querySelectorAll('[data-antwort]').forEach(knopf => knopf.addEventListener('click', () => {
    document.querySelectorAll('[data-antwort]').forEach(antwort => antwort.classList.remove('richtig', 'falsch'));
    const richtig = knopf.dataset.antwort === 'richtig';
    knopf.classList.add(richtig ? 'richtig' : 'falsch');
    document.querySelector('.lerncheck p').textContent = richtig ? 'Richtig. Eigenkapital gehört zur Mittelherkunft und steht auf der Passivseite.' : 'Noch nicht. Frage dich, ob Eigenkapital die Verwendung oder die Herkunft von Mitteln beschreibt.';
  }));

  const auswahl = [...document.querySelectorAll('.themenwahl input')];
  function auswahlAktualisieren() {
    const zahl = auswahl.filter(feld => feld.checked).length;
    document.querySelector('#auswahl-stand').textContent = `${zahl} von ${auswahl.length} gewählt`;
    document.querySelector('#bogen-kapitel').textContent = zahl;
    document.querySelector('#pruefung-start').disabled = zahl === 0;
    document.querySelector('#pruefung-hinweis').hidden = zahl !== 0;
  }
  auswahl.forEach(feld => feld.addEventListener('change', auswahlAktualisieren));
  document.querySelectorAll('.dauer button').forEach(knopf => knopf.addEventListener('click', () => {
    document.querySelectorAll('.dauer button').forEach(option => option.classList.toggle('aktiv', option === knopf));
    document.querySelector('#bogen-dauer').textContent = `${knopf.textContent} Min.`;
  }));
  document.querySelector('#stimmung-wechsel').addEventListener('click', () => {
    const dunkel = root.dataset.stimmung !== 'dunkel';
    root.dataset.stimmung = dunkel ? 'dunkel' : 'hell';
    document.querySelector('#stimmung-text').textContent = dunkel ? 'Dunkel' : 'Hell';
  });

  zeige(location.hash.slice(1).split('?')[0] || 'heute');
  waage();
  auswahlAktualisieren();
})();
