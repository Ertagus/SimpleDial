// SimpleDial — popup.js (v3.0.0)
//
// Composizione manuale: l'utente digita un numero che non e' in pagina.
// Il popup non compone da se': manda il numero al service worker, che usa
// la stessa dial() del menu contestuale, cosi' esiste un solo percorso.

const DEFAULT_PHONE_REGEX = [
  String.raw`^\+\d{1,4}\d{4,11}$`,
  String.raw`^00\d{1,4}\d{4,11}$`,
  String.raw`^0(?!0)\d{5,10}$`,
  String.raw`^[1-9]\d{2,14}$`
].join('|');

let pattern = DEFAULT_PHONE_REGEX;
let qrMode = false;   // opzione useQr: il Call apre un QR invece dell'app telefono

function t(k) { return chrome.i18n.getMessage(k) || ''; }

function applyI18n() {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = t(el.dataset.i18n); if (v) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const v = t(el.dataset.i18nPlaceholder); if (v) el.placeholder = v;
  });
}

// La regex serve a scartare i falsi positivi trovati nelle pagine. Qui il
// numero lo scrive l'utente di proposito, percio' un valore fuori formato
// viene segnalato ma non bloccato: codici brevi e sequenze come *97 devono
// restare componibili.
function check() {
  const raw = document.getElementById('num').value;
  const clean = raw.replace(/[-.\s()]/g, '');
  const hint = document.getElementById('hint');
  if (!clean) { hint.textContent = t('popupHint'); hint.className = 'hint'; return; }
  let okFmt;
  try { okFmt = new RegExp(pattern).test(clean); }
  catch { okFmt = new RegExp(DEFAULT_PHONE_REGEX).test(clean); }
  hint.textContent = okFmt ? (qrMode ? t('popupQrHint') : t('popupHint')) : t('popupUnusual');
  hint.className = okFmt ? 'hint' : 'hint warn';
}

function dial() {
  const raw = document.getElementById('num').value;
  const number = raw.replace(/[-.\s()]/g, '').replace(/[^0-9*#+]/g, '');
  const btn = document.getElementById('call');
  btn.disabled = true;
  // Chiusura solo dopo la conferma del service worker; il timeout evita
  // che il popup resti aperto se la risposta non arriva.
  let closed = false;
  const done = () => { if (!closed) { closed = true; window.close(); } };
  setTimeout(done, 800);
  chrome.runtime.sendMessage({ type: 'dial', number }, () => {
    void chrome.runtime.lastError;
    done();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyI18n();
  chrome.storage.local.get(['phoneRegex', 'useQr'], r => {
    void chrome.runtime.lastError;
    if (r && r.phoneRegex) pattern = r.phoneRegex;
    qrMode = !!(r && r.useQr);
    check();
  });
  const input = document.getElementById('num');
  input.addEventListener('input', check);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') dial(); });
  document.getElementById('call').addEventListener('click', dial);
  input.focus();
});
