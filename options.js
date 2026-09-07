// SimpleDial — options.js (v3.0.1)
//
// I testi visibili vengono da _locales/<lingua>/messages.json. Chrome sceglie
// la cartella in base alla lingua dell'interfaccia del browser e ripiega su
// default_locale (en) per le lingue non presenti.

const DEFAULT_PHONE_REGEX = [
  String.raw`^\+\d{1,4}\d{4,11}$`,
  String.raw`^00\d{1,4}\d{4,11}$`,
  String.raw`^0(?!0)\d{5,10}$`,
  String.raw`^[1-9]\d{2,14}$`
].join('|');

const HANDLERS_URL = 'chrome://settings/handlers';
const SCHEMES = ['tel', 'callto', 'sip', 'skype'];
const DEFAULT_SCHEME = 'tel';

// L'HTML contiene i testi della lingua di default come sorgente leggibile;
// qui vengono sostituiti con quelli della lingua attiva. data-i18n-html serve alle stringhe
// che contengono markup (<code>, <strong>, <br>): il contenuto arriva dal
// pacchetto, non dalla pagina, quindi non c'e' iniezione di terze parti.
function applyI18n() {
  const t = k => chrome.i18n.getMessage(k) || '';
  document.documentElement.lang = chrome.i18n.getUILanguage();
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = t(el.dataset.i18n); if (v) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const v = t(el.dataset.i18nHtml); if (v) el.innerHTML = v;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const v = t(el.dataset.i18nPlaceholder); if (v) el.placeholder = v;
  });
  const title = t('optTitle'); if (title) document.title = title;
}

document.addEventListener('DOMContentLoaded', () => {
  applyI18n();

  chrome.storage.local.get(['phoneRegex', 'scheme', 'usePopup', 'useQr', 'interceptClicks'], r => {
    document.getElementById('cfgPopup').checked = r.usePopup === true;
    document.getElementById('cfgQr').checked = r.useQr === true;
    // Attiva salvo esplicito rifiuto: chi non ha mai aperto le opzioni deve
    // trovarla accesa, come il content script che legge lo stesso valore.
    document.getElementById('cfgIntercept').checked = r.interceptClicks === true;
    document.getElementById('cfgRegex').value = r.phoneRegex || DEFAULT_PHONE_REGEX;
    document.getElementById('cfgScheme').value =
      SCHEMES.includes(r.scheme) ? r.scheme : DEFAULT_SCHEME;
    runTest();
  });

  document.getElementById('btnSave').addEventListener('click', save);
  document.getElementById('btnResetRegex').addEventListener('click', resetRegex);

  document.getElementById('cfgRegex').addEventListener('input', () => {
    validateRegexField();
    runTest();
  });
  document.getElementById('cfgTest').addEventListener('input', runTest);
  document.getElementById('btnHandlers').addEventListener('click', openHandlers);
});

// Chrome blocca i link verso chrome:// da qualsiasi documento, pagine
// dell'estensione comprese: un <a href> non funzionerebbe. Se anche
// tabs.create venisse rifiutata, resta scritto a video l'indirizzo da
// incollare a mano: la scrittura negli appunti richiedeva clipboardWrite ed
// e' stata tolta nella 3.0.1 per non chiedere un permesso in piu'.
function openHandlers() {
  chrome.tabs.create({ url: HANDLERS_URL }, () => {
    if (!chrome.runtime.lastError) return;
    setHandlersStatus(chrome.i18n.getMessage('handlersManual', [HANDLERS_URL]), 'warn');
  });
}

function setHandlersStatus(msg, type) {
  const s = document.getElementById('handlersStatus');
  s.textContent = msg;
  s.className = 'status' + (type ? ' ' + type : '');
}

function isValidRegex(value) {
  try { new RegExp(value); return true; } catch { return false; }
}

function validateRegexField() {
  const ta = document.getElementById('cfgRegex');
  const err = document.getElementById('regexError');
  const val = ta.value.trim();
  if (!val || isValidRegex(val)) {
    ta.classList.remove('invalid');
    err.textContent = '';
    err.className = 'validation-msg';
    return true;
  }
  ta.classList.add('invalid');
  err.textContent = chrome.i18n.getMessage('regexInvalid');
  err.className = 'validation-msg warn-inline';
  return false;
}

// Riproduce esattamente la logica di background.js (extractNumber): stessa
// pulizia, stesso fallback sulla regex non compilabile e — dalla 3.0.1 — lo
// stesso ripiego sul gruppo di cifre piu' lungo quando la stringa intera non
// passa. Se le due copie divergono, la prova smette di dire la verita'.
function matches(value, pattern) {
  try { return new RegExp(pattern).test(value); }
  catch { return new RegExp(DEFAULT_PHONE_REGEX).test(value); }
}

function extractNumber(raw, pattern) {
  const direct = (raw || '').replace(/[-.\s()]/g, '');
  if (!direct) return '';
  // Percorso rapido: la selezione e' gia' un numero pulito.
  if (matches(direct, pattern)) return direct.replace(/[^0-9*#+]/g, '');

  // La selezione contiene altro. La regola di riconoscimento e' configurabile
  // dall'utente, quindi il discernimento sta QUI nel pre-trattamento, non nel
  // pattern. Si separa sugli spazi e si guarda ogni pezzo:
  //   "Tel."          solo lettere      -> etichetta, si scarta
  //   "AB2125550142X" lettere E cifre   -> seriale, si RIFIUTA tutto
  // Scartare le lettere e basta trasformerebbe un seriale in un numero.
  const rest = [];
  for (const tok of (raw || '').split(/\s+/)) {
    if (!tok) continue;
    const hasLetter = /[A-Za-zÀ-ɏ]/.test(tok);
    if (hasLetter && /\d/.test(tok)) return '';
    if (hasLetter) continue;
    rest.push(tok);
  }
  if (!rest.length) return '';

  // Restano solo i separatori che un numero di telefono puo' contenere.
  // La virgola (migliaia: "1,249.90") e la barra (data: "09/14/2026") non ne
  // fanno parte: se compaiono, la selezione non e' un numero.
  const cand = rest.join('');
  if (!/^[0-9+*#\-.()]+$/.test(cand)) return '';

  const clean = cand.replace(/[-.()]/g, '');
  return matches(clean, pattern) ? clean.replace(/[^0-9*#+]/g, '') : '';
}


function runTest() {
  const raw = document.getElementById('cfgTest').value;
  const out = document.getElementById('testResult');
  if (!raw.trim()) { out.textContent = ''; return; }

  const pattern = document.getElementById('cfgRegex').value.trim() || DEFAULT_PHONE_REGEX;
  const dialed = extractNumber(raw, pattern);

  if (dialed) {
    out.textContent = chrome.i18n.getMessage('testOk', [dialed]);
    out.className = 'test-result test-ok';
  } else {
    out.textContent = chrome.i18n.getMessage('testNo');
    out.className = 'test-result test-no';
  }
}

function resetRegex() {
  const ta = document.getElementById('cfgRegex');
  ta.value = DEFAULT_PHONE_REGEX;
  ta.classList.remove('invalid');
  document.getElementById('regexError').textContent = '';
  chrome.storage.local.set({ phoneRegex: DEFAULT_PHONE_REGEX }, () => {
    setStatus(chrome.i18n.getMessage('statusReset'), 'ok');
    runTest();
  });
}

function save() {
  const phoneRegex = document.getElementById('cfgRegex').value.trim() || DEFAULT_PHONE_REGEX;
  const schemeSel  = document.getElementById('cfgScheme').value;
  const scheme     = SCHEMES.includes(schemeSel) ? schemeSel : DEFAULT_SCHEME;
  const usePopup   = document.getElementById('cfgPopup').checked;
  const useQr      = document.getElementById('cfgQr').checked;
  const interceptClicks = document.getElementById('cfgIntercept').checked;
  const ok = validateRegexField();
  chrome.storage.local.set({ phoneRegex, scheme, usePopup, useQr, interceptClicks }, () => {
    setStatus(chrome.i18n.getMessage(ok ? 'statusSaved' : 'statusSavedInvalid'), ok ? 'ok' : 'warn');
  });
}

function setStatus(msg, type) {
  const s = document.getElementById('status');
  s.textContent = msg;
  s.className = 'status' + (type ? ' ' + type : '');
  if (type === 'ok') setTimeout(() => { s.textContent = ''; s.className = 'status'; }, 2500);
}
