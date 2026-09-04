// SimpleDial — background service worker (v3.0.0)
//
// Le voci di menu vengono CREATE UNA SOLA VOLTA e poi solo aggiornate
// (titolo + visibilita'). Non si distrugge/ricostruisce il menu al momento
// del click destro: quella sequenza e' asincrona e Chrome disegna il menu
// prima che le create() siano completate, per cui il menu appariva vuoto.
//
// Modalita' QR (opzione useQr): invece di consegnare tel: all'handler, ogni
// composizione apre una finestra con un codice QR contenente tel:NUMERO, da
// inquadrare col cellulare. Il QR e' generato in locale (qrcode-generator.js);
// nessuna chiamata di rete. Vedi openQrWindow().

const MENU_HREF = 'dial_href';
const MENU_TEXT = 'dial_text';
const MENU_SEL  = 'dial_selection';
const IDS = [MENU_HREF, MENU_TEXT, MENU_SEL];

// Voce fissa nel menu del tasto destro sull'icona dell'estensione.
// Tenuta fuori da IDS: non partecipa al ciclo di aggiornamento dei numeri.
const MENU_HANDLERS = 'open_handlers';
const HANDLERS_URL  = 'chrome://settings/handlers';

// Schemi consegnati all'handler registrato nel browser o nel sistema.
// Nessuno di questi produce traffico di rete dall'estensione: l'URL viene
// passato al sistema operativo, che decide chi lo apre.
const SCHEMES = ['tel', 'callto', 'sip', 'skype'];
const DEFAULT_SCHEME = 'tel';

// Il popup e' disattivo di default: il manifest non dichiara default_popup,
// e action.setPopup() lo attiva solo se l'utente lo chiede. Con popup
// impostato Chrome NON emette action.onClicked, quindi i due comportamenti
// (popup / composizione diretta) si escludono a vicenda: e' esattamente
// l'effetto voluto. setPopup non sopravvive al riavvio del browser,
// percio' va riapplicato a ogni boot del service worker.
const POPUP_PAGE = 'popup.html';
const QR_PAGE    = 'qr.html';

function applyPopupSetting() {
  return chrome.storage.local.get(['usePopup', 'useQr'])
    .then(cfg => {
      // Con la modalita' QR attiva l'icona apre SEMPRE il pannello: un QR
      // senza numero non ha senso e serve un campo dove digitarlo. In questa
      // modalita' il pannello sovrascrive usePopup.
      const wantPopup = cfg.useQr === true || cfg.usePopup === true;
      return chrome.action.setPopup({ popup: wantPopup ? POPUP_PAGE : '' });
    })
    .catch(() => {});
}

const CONTEXTS = {
  [MENU_HREF]: ['link'],
  [MENU_TEXT]: ['link'],
  [MENU_SEL]:  ['selection']
};

// visible:false nasconde una voce ma NON la de-registra: Chrome la conta
// comunque quando decide se raggruppare le voci dell'estensione sotto un
// sottomenu "SimpleDial ▸". Con un solo numero valido, dial_href resta
// visibile e dial_text (stesso contesto 'link') resta registrato: due voci,
// quindi sottomenu, anche se una e' invisibile.
//
// Le voci non assegnate a un numero vengono percio' "parcheggiate" su un
// pattern di URL che non esiste: Chrome filtra per documentUrlPatterns nello
// stesso stadio in cui filtra per contesto, quindi la voce parcheggiata non
// entra nella costruzione del menu su nessuna pagina e non conta per il
// raggruppamento. Una sola voce -> resta al primo livello.
//
// Lo stato e' sempre esplicito (parcheggiata gia' dalla create()), cosi' non
// convivono due regimi. URL_LIVE ripete file:/// oltre a <all_urls> perche'
// <all_urls> copre lo schema file solo con l'accesso ai file abilitato.
const URL_LIVE   = ['<all_urls>', 'file:///*'];
const URL_PARKED = ['https://simpledial-none.invalid/*'];

// ─── Validazione numeri ───────────────────────────────────────────────────────
const DEFAULT_PHONE_RULES = [
  /^\+\d{1,4}\d{4,11}$/,
  /^00\d{1,4}\d{4,11}$/,
  /^0(?!0)\d{5,10}$/,
  /^[1-9]\d{2,14}$/
];
const DEFAULT_PHONE_REGEX = DEFAULT_PHONE_RULES.map(r => r.source).join('|');

// Il service worker viene terminato e riavviato: una variabile riempita da un
// get() asincrono al boot puo' essere ancora vuota quando arriva il primo
// messaggio. Si espone quindi una Promise, che chi valida attende.
let regexPromise = null;
function getRegex() {
  if (!regexPromise) {
    regexPromise = chrome.storage.local.get(['phoneRegex'])
      .then(cfg => cfg.phoneRegex || DEFAULT_PHONE_REGEX)
      .catch(() => DEFAULT_PHONE_REGEX);
  }
  return regexPromise;
}
let schemePromise = null;
function getScheme() {
  if (!schemePromise) {
    schemePromise = chrome.storage.local.get(['scheme'])
      .then(cfg => SCHEMES.includes(cfg.scheme) ? cfg.scheme : DEFAULT_SCHEME)
      .catch(() => DEFAULT_SCHEME);
  }
  return schemePromise;
}
let useQrPromise = null;
function getUseQr() {
  if (!useQrPromise) {
    useQrPromise = chrome.storage.local.get(['useQr'])
      .then(cfg => cfg.useQr === true)
      .catch(() => false);
  }
  return useQrPromise;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.phoneRegex !== undefined)
    regexPromise = Promise.resolve(changes.phoneRegex.newValue || DEFAULT_PHONE_REGEX);
  if (changes.scheme !== undefined)
    schemePromise = Promise.resolve(
      SCHEMES.includes(changes.scheme.newValue) ? changes.scheme.newValue : DEFAULT_SCHEME);
  if (changes.useQr !== undefined) {
    useQrPromise = Promise.resolve(changes.useQr.newValue === true);
    applyPopupSetting();   // QR attivo forza il pannello sull'icona
  }
  if (changes.usePopup !== undefined) applyPopupSetting();
});

function cleanNumber(raw) {
  return (raw || '').replace(/[-.\s()]/g, '').replace(/[^0-9*#+]/g, '');
}

function isValidPhoneNumber(raw, pattern) {
  const clean = (raw || '').replace(/[-.\s()]/g, '');
  if (!clean) return false;
  try {
    return new RegExp(pattern).test(clean);
  } catch (_e) {
    return DEFAULT_PHONE_RULES.some(re => re.test(clean));
  }
}

// ─── Menu contestuale ─────────────────────────────────────────────────────────
// Le voci registrate sopravvivono al riavvio del service worker ma non alla
// chiusura del browser: lo stesso ciclo di vita di storage.session, che viene
// percio' usato come flag "menu gia' creati".
function createMenus() {
  return new Promise(resolve => {
    chrome.contextMenus.removeAll(() => {
      void chrome.runtime.lastError;
      IDS.forEach(id => {
        chrome.contextMenus.create({
          id,
          title: chrome.i18n.getMessage('menuCall'),
          contexts: CONTEXTS[id],
          visible: false,
          documentUrlPatterns: URL_PARKED
        }, () => void chrome.runtime.lastError);
      });
      chrome.contextMenus.create({
        id: MENU_HANDLERS,
        title: chrome.i18n.getMessage('menuHandlers'),
        contexts: ['action'],
        visible: true
      }, () => void chrome.runtime.lastError);
      resolve();
    });
  });
}

let ensurePromise = null;
function ensureMenus() {
  if (!ensurePromise) {
    ensurePromise = chrome.storage.session.get('menusReady').then(async r => {
      if (r && r.menusReady) return;
      await createMenus();
      await chrome.storage.session.set({ menusReady: true });
    }).catch(() => {});
  }
  return ensurePromise;
}

async function resetMenus() {
  ensurePromise = null;
  await chrome.storage.session.set({ menusReady: false, numbers: {} });
  await ensureMenus();
}

chrome.runtime.onInstalled.addListener(() => { resetMenus(); applyPopupSetting(); });
chrome.runtime.onStartup.addListener(() => { resetMenus(); applyPopupSetting(); });
// setPopup non e' persistente: si riapplica anche al semplice risveglio
// del service worker, non solo all'avvio del browser.
applyPopupSetting();
// Boot del service worker: se il flag e' gia' presente non fa nulla di costoso.
ensureMenus();

// ─── Preparazione voci ────────────────────────────────────────────────────────
async function handlePrepare(msg) {
  await ensureMenus();
  const pattern = await getRegex();

  const candidates = [
    { id: MENU_HREF, raw: msg.href      || '' },
    { id: MENU_TEXT, raw: msg.text      || '' },
    { id: MENU_SEL,  raw: msg.selection || '' }
  ];

  // Valida e deduplica: se lo stesso numero arriva da piu' sorgenti
  // (href e testo del link, tipicamente) compare una voce sola.
  const seen = new Set();
  const numbers = {};
  for (const c of candidates) {
    if (!isValidPhoneNumber(c.raw, pattern)) continue;
    const n = cleanNumber(c.raw);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    numbers[c.id] = n;
  }

  // Persistito, non tenuto in memoria: il service worker puo' essere
  // terminato fra la costruzione del menu e il click dell'utente.
  await chrome.storage.session.set({ numbers });

  for (const id of IDS) {
    const n = numbers[id];
    chrome.contextMenus.update(id, {
      visible: !!n,
      // Parcheggiata se senza numero: fuori dal conteggio per il sottomenu.
      documentUrlPatterns: n ? URL_LIVE : URL_PARKED,
      title: n ? chrome.i18n.getMessage('menuCallNumber', [n])
               : chrome.i18n.getMessage('menuCall')
    }, () => void chrome.runtime.lastError);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  // Richiesta di composizione. Arriva dal pannello popup (sender.tab assente)
  // o dalla finestra QR (sender.tab presente: e' una finestra vera). In
  // entrambi i casi e' una pagina di QUESTA estensione: sender.id lo
  // garantisce — nessuna pagina web puo' falsificarlo e externally_connectable
  // non e' dichiarato — e si verifica anche l'origine. I content script hanno
  // sender.url del sito, che non parte dal nostro origin.
  if (msg.type === 'dial') {
    if (sender.id !== chrome.runtime.id) return;
    if (!sender.url || !sender.url.startsWith(chrome.runtime.getURL(''))) return;
    // direct:true (pulsante "chiama da questo computer" nella finestra QR)
    // salta il ramo QR ed esegue la composizione normale verso tel:.
    dialActiveTab(typeof msg.number === 'string' ? cleanNumber(msg.number) : '',
      msg.direct === true);
    // Si risponde subito: il chiamante attende questa conferma prima di
    // chiudersi, cosi' il messaggio non va perso se il service worker
    // era dormiente al momento del click.
    sendResponse({ ok: true });
    return;
  }

  if (msg.type !== 'MENU_PREPARE') return;
  handlePrepare(msg);
});

// ─── Composizione ─────────────────────────────────────────────────────────────
// La scheda corrente viene navigata verso tel:NUMERO.
//
// Il browser riconosce l'indirizzo come protocollo esterno, lo consegna
// all'handler registrato e ANNULLA la navigazione: la pagina resta al suo
// posto. La navigazione parte da qui, quindi il browser la attribuisce
// all'estensione e non al sito: l'autorizzazione ad aprire l'applicazione
// esterna viene chiesta una volta sola invece che sito per sito.
// skype: vuole il suffisso ?call, altrimenti apre la scheda contatto
// invece di comporre. Senza numero (clic sull'icona) si passa il solo
// schema, che si limita a richiamare l'applicazione.
// "tel:222" e' ambiguo: Chrome puo' leggerlo come host "tel" con porta "222"
// e completarlo in http://tel:222/. Succede quando la parte dopo i due punti
// e' fatta di sole cifre e sta in un numero di porta (<= 65535), cioe' proprio
// con gli interni brevi.
//
// Riguarda TUTTI i percorsi che passano da chrome.tabs.update: voce di menu,
// popup e icona. Non riguarda il click diretto su un link tel: della pagina,
// che il browser risolve con il parser URL e non con la correzione di
// indirizzo usata dalle API tabs. Verificato disattivando la disambiguazione:
// senza, fallisce anche il tasto destro su <a href="tel:215">.
//
// Si inserisce allora un trattino dopo la prima cifra: "222" -> "2-22".
// RFC 3966 chiama questi caratteri visual-separator e prescrive che chi
// compone li ignori, quindi il numero effettivo non cambia. Il trattino
// rende inoltre la stringa non piu' valida come porta, e Chrome smette di
// riscrivere l'indirizzo.
//
// Il percent-encoding sarebbe stato piu' pulito ma non e' praticabile: non
// tutti gli handler decodificano, e chi si limita a togliere i caratteri non
// numerici trasforma %3222 in 3222.
function disambiguate(number) {
  if (!/^\d+$/.test(number)) return number;
  if (Number(number) > 65535) return number;
  if (number.length < 2) return number + '-';
  return number[0] + '-' + number.slice(1);
}

function buildUrl(scheme, number) {
  if (!number) return scheme + ':';
  const n = disambiguate(number);
  return scheme === 'skype' ? 'skype:' + n + '?call' : scheme + ':' + n;
}

// tabs.create NON va usata con uno schema esterno: la scheda nuova parte
// vuota e Chrome interpreta la stringa come input della barra indirizzi,
// leggendo "tel" come host e il numero come porta -> http://tel:NUMERO/.
// Si apre quindi una scheda vuota e la si naviga con update, che invece
// riconosce il protocollo e lo consegna all'handler.
function openInNewTab(url) {
  chrome.tabs.create({ url: 'about:blank' }, tab => {
    if (chrome.runtime.lastError || !tab) {
      // Vicolo cieco: la composizione non parte e l'utente non vedrebbe nulla.
      // Il warning resta nella console del service worker per la diagnosi.
      console.warn('SimpleDial: impossibile aprire una scheda per', url,
        '—', (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'nessuna scheda');
      return;
    }
    // La scheda appena creata puo' non essere ancora pronta a navigare:
    // si riprova una volta se il primo update viene rifiutato.
    chrome.tabs.update(tab.id, { url }, () => {
      if (!chrome.runtime.lastError) return;
      setTimeout(() => chrome.tabs.update(tab.id, { url }, () => {
        if (!chrome.runtime.lastError) return;
        // Anche il secondo tentativo e' fallito: la composizione non e'
        // partita e la scheda e' rimasta su about:blank, vuota e inutile.
        // La si chiude — non a tempo, ma solo qui dove e' certo che sia
        // vuota: sul percorso di successo la scheda diventa la pagina
        // dell'handler (quando l'handler tel: e' una web app) e va tenuta.
        console.warn('SimpleDial: navigazione verso', url, 'fallita —',
          chrome.runtime.lastError.message);
        chrome.tabs.remove(tab.id, () => void chrome.runtime.lastError);
      }), 150);
    });
  });
}

// Modalita' QR: il codice si mostra in una FINESTRA dedicata, non nel popup
// dell'azione. Il popup si chiude appena perde il focus — cioe' esattamente
// quando l'utente guarda il telefono per inquadrare il QR. Il numero passa da
// storage.session, mai in query string: coerente con come viaggiano gli altri
// dati e fuori da qualunque URL. Il QR forza sempre tel:, qualunque sia lo
// schema impostato: una fotocamera non sa che farsene di callto:/sip:/skype:.
function openQrWindow(number) {
  chrome.storage.session.set({ qrNumber: number || '' })
    .then(() => chrome.windows.create(
      { url: QR_PAGE, type: 'popup', width: 360, height: 500, focused: true },
      () => void chrome.runtime.lastError))
    .catch(() => {});
}

async function dial(tabId, number, direct) {
  if (!direct && number && await getUseQr()) { openQrWindow(number); return; }

  const url = buildUrl(await getScheme(), number);

  if (tabId === undefined || tabId === null) { openInNewTab(url); return; }

  chrome.tabs.update(tabId, { url }, () => {
    // Schede non navigabili dall'estensione (pagine interne, Web Store,
    // nuova scheda): si ripiega su una scheda dedicata.
    if (chrome.runtime.lastError) openInNewTab(url);
  });
}

// La pagina chrome://settings/handlers non e' raggiungibile con un normale
// link: Chrome blocca i collegamenti verso chrome:// da qualsiasi documento,
// pagine dell'estensione comprese. tabs.create e' l'unica via.
function openHandlers() {
  chrome.tabs.create({ url: HANDLERS_URL }, () => {
    if (chrome.runtime.lastError) {
      console.warn('SimpleDial: impossibile aprire', HANDLERS_URL, '—',
        chrome.runtime.lastError.message);
    }
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === MENU_HANDLERS) { openHandlers(); return; }

  let number = '';

  const r = await chrome.storage.session.get('numbers').catch(() => ({}));
  if (r && r.numbers) number = r.numbers[info.menuItemId] || '';

  // Rete di sicurezza: se lo stato salvato e' andato perso, il numero si
  // ricava direttamente dai dati che Chrome allega al click.
  if (!number) {
    const pattern = await getRegex();
    if (info.linkUrl && /^(?:tel|callto):/i.test(info.linkUrl)) {
      let raw = info.linkUrl.replace(/^(?:tel|callto):/i, '');
      try { raw = decodeURIComponent(raw); } catch (_e) { /* href malformato */ }
      // Scarta i parametri RFC 3966 (;ext= ecc.): come in content.js, senza
      // il taglio le loro cifre finirebbero saldate al numero.
      raw = raw.split(';')[0];
      number = cleanNumber(raw);
    } else if (info.selectionText && isValidPhoneNumber(info.selectionText, pattern)) {
      number = cleanNumber(info.selectionText);
    }
  }

  if (!number) return;
  dial(tab && tab.id, number);
});

// La richiesta di composizione manuale arriva dal pannello popup o dalla
// finestra QR. Si naviga la scheda attiva di una finestra NORMALE: la finestra
// QR ha windowType 'popup', e tabs.update senza tabId colpirebbe lei — proprio
// quando si preme "chiama da questo computer". tabs.query non richiede il
// permesso 'tabs' per leggere il solo .id.
function normalWindowActiveTabId() {
  return chrome.tabs.query({ active: true, lastFocusedWindow: true, windowType: 'normal' })
    .then(tabs => (tabs && tabs.length) ? tabs[0].id : null)
    .then(id => id != null ? id
      : chrome.tabs.query({ active: true, windowType: 'normal' })
          .then(tabs => (tabs && tabs.length) ? tabs[0].id : null))
    .catch(() => null);
}

async function dialActiveTab(number, direct) {
  if (!direct && number && await getUseQr()) { openQrWindow(number); return; }

  const url = buildUrl(await getScheme(), number);
  const tabId = await normalWindowActiveTabId();
  if (tabId == null) { openInNewTab(url); return; }
  chrome.tabs.update(tabId, { url }, () => {
    if (chrome.runtime.lastError) openInNewTab(url);
  });
}

// ─── Icona nella barra degli strumenti ────────────────────────────────────────
// Apre tel: senza numero: il browser passa comunque la richiesta all'handler
// registrato, che si limita a mostrare l'applicazione telefono.
chrome.action.onClicked.addListener(tab => {
  dial(tab && tab.id, '');
});
