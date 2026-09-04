// SimpleDial — content script (v3.0.0)
//
// Unico compito: raccogliere i possibili numeri sotto al cursore o nella
// selezione e passarli al service worker, che aggiorna le voci di menu.
//
// I dati vengono inviati in ANTICIPO (mouseover, selectionchange, mousedown
// con tasto destro), non sull'evento contextmenu: quello arriva troppo tardi
// perche' il service worker si svegli e aggiorni il menu prima che Chrome lo
// disegni. L'invio su contextmenu resta come ulteriore tentativo, innocuo.
//
// La composizione NON avviene qui: se ne occupa il service worker navigando
// la scheda verso tel:, cosi' l'iniziatore risulta l'estensione e non il sito
// e il permesso per l'applicazione esterna viene memorizzato una volta sola.
//
// Nota: i click sui link tel: non vengono intercettati. Funzionano gia' da
// soli tramite l'handler registrato nel browser o nel sistema operativo.

let lastHref = null;   // numero ricavato da href="tel:..."
let lastText = null;   // testo visibile del link
let lastSig  = null;   // ultima terna inviata, per non ripetere messaggi

function cleanHref(link) {
  if (!link) return null;
  const href = link.getAttribute('href') || '';
  let raw = href.replace(/^(?:tel|callto):/i, '');
  try { raw = decodeURIComponent(raw); } catch (_e) { /* href malformato */ }
  // Parametri RFC 3966 (;ext= ;phone-context= ;isub=): non fanno parte del
  // numero. Senza questo taglio le cifre del parametro verrebbero saldate in
  // fondo ("tel:555;ext=99" -> "55599"). Il decode e' gia' avvenuto, quindi
  // prende anche un ";" scritto come %3B.
  raw = raw.split(';')[0];
  return raw.replace(/[-.\s()]/g, '').replace(/[^0-9*#+]/g, '');
}

function currentSelection() {
  const s = window.getSelection && window.getSelection();
  return (s && s.toString().trim()) || '';
}

function send(href, text, selection, force) {
  const sig = (href || '') + '\u0000' + (text || '') + '\u0000' + (selection || '');
  if (!force && sig === lastSig) return;
  lastSig = sig;
  // Invio diretto, senza attese asincrone: il tratto fra il mousedown col
  // tasto destro e il disegno del menu da parte di Chrome e' il piu' stretto
  // che abbiamo, e ogni hop in piu' aumenta la probabilita' che il menu
  // venga disegnato prima che le voci siano aggiornate. Fino alla 2.5.4 qui
  // si attendeva la lettura delle esclusioni da storage: quella funzione non
  // esiste piu' (vedi CHANGELOG 2.5.5) e con lei se n'e' andata l'attesa.
  dispatch(href, text, selection);
}

function dispatch(href, text, selection) {
  // Nessuna risposta attesa: il service worker aggiorna solo le voci di menu.
  // La sendMessage puo' fallire in modo sincrono (contesto invalidato da un
  // aggiornamento/ricarica) o rifiutare la promise (worker in riavvio,
  // nessun ricevitore): in ogni caso il prossimo evento rimanda i dati.
  try {
    chrome.runtime.sendMessage({ type: 'MENU_PREPARE', href, text, selection })
      .catch(() => {});
  } catch (_e) {
    /* contesto dell'estensione invalidato */
  }
}

function collect(target, force) {
  const el = target && target.nodeType === 1 ? target
           : (target && target.parentElement) || null;
  // callto: e' diffuso quanto tel: sulle pagine aziendali; entrambi
  // contengono un numero, quindi entrambi vengono riconosciuti.
  const link = el && el.closest
    ? el.closest('a[href^="tel:" i], a[href^="callto:" i]') : null;
  lastHref = cleanHref(link);
  lastText = link ? (link.textContent || '').trim() : null;
  send(lastHref, lastText, currentSelection(), force);
}

document.addEventListener('mouseover', e => collect(e.target, false), true);
document.addEventListener('focus',     e => collect(e.target, false), true);

// La selezione cambia molto prima del click destro: e' il momento giusto per
// aggiornare la voce dedicata.
document.addEventListener('selectionchange', () => {
  send(lastHref, lastText, currentSelection(), false);
});

// mousedown col tasto destro precede contextmenu: ultimo istante utile.
document.addEventListener('mousedown', e => {
  if (e.button === 2) collect(e.target, true);
}, true);

document.addEventListener('contextmenu', e => collect(e.target, true), true);
