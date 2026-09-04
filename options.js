// SimpleDial — options.js (v3.0.0)
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

  chrome.storage.local.get(['phoneRegex', 'scheme', 'usePopup', 'useQr'], r => {
    document.getElementById('cfgPopup').checked = r.usePopup === true;
    document.getElementById('cfgQr').checked = r.useQr === true;
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
// tabs.create venisse rifiutata, l'indirizzo viene copiato negli appunti.
function openHandlers() {
  chrome.tabs.create({ url: HANDLERS_URL }, () => {
    if (!chrome.runtime.lastError) return;
    navigator.clipboard.writeText(HANDLERS_URL)
      .then(() => setHandlersStatus(chrome.i18n.getMessage('handlersCopied'), 'warn'))
      .catch(() => setHandlersStatus(chrome.i18n.getMessage('handlersManual', [HANDLERS_URL]), 'warn'));
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

// Riproduce esattamente la logica di background.js: stessa pulizia,
// stesso fallback, cosi' la prova rispecchia il comportamento reale.
function runTest() {
  const raw = document.getElementById('cfgTest').value;
  const out = document.getElementById('testResult');
  if (!raw.trim()) { out.textContent = ''; return; }

  const pattern = document.getElementById('cfgRegex').value.trim() || DEFAULT_PHONE_REGEX;
  const clean = raw.replace(/[-.\s()]/g, '');
  let match;
  try {
    match = new RegExp(pattern).test(clean);
  } catch {
    match = new RegExp(DEFAULT_PHONE_REGEX).test(clean);
  }

  if (match) {
    const dialed = clean.replace(/[^0-9*#+]/g, '');
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
  const ok = validateRegexField();
  chrome.storage.local.set({ phoneRegex, scheme, usePopup, useQr }, () => {
    setStatus(chrome.i18n.getMessage(ok ? 'statusSaved' : 'statusSavedInvalid'), ok ? 'ok' : 'warn');
  });
}

function setStatus(msg, type) {
  const s = document.getElementById('status');
  s.textContent = msg;
  s.className = 'status' + (type ? ' ' + type : '');
  if (type === 'ok') setTimeout(() => { s.textContent = ''; s.className = 'status'; }, 2500);
}
