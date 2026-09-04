// SimpleDial — qr.js (v3.0.0)
//
// Finestra della modalita' QR. Legge il numero da chrome.storage.session
// (scritto dal service worker in openQrWindow), genera IN LOCALE un codice QR
// contenente tel:NUMERO e lo mostra come SVG. Nessuna chiamata di rete: la
// libreria qrcode-generator.js e' pura computazione e l'SVG e' costruito qui
// con soli interi e markup statico.
//
// Il QR forza sempre tel:, qualunque schema sia impostato per le chiamate dal
// computer: una fotocamera non sa gestire callto:/sip:/skype:.

function t(k) { return chrome.i18n.getMessage(k) || ''; }

function applyI18n() {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = t(el.dataset.i18n); if (v) el.textContent = v;
  });
  const title = t('qrPageTitle'); if (title) document.title = title;
}

// SVG costruito a mano: <rect> neri sui moduli scuri, sfondo bianco (i lettori
// QR vogliono scuro-su-chiaro). shape-rendering=crispEdges tiene i bordi netti
// a qualunque scala. Nessun dato utente finisce nel markup: solo coordinate
// intere e la stringa xmlns, che e' un identificatore, non un indirizzo.
function buildSvg(qr, margin) {
  const count = qr.getModuleCount();
  const dim = count + margin * 2;
  let rects = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        rects += '<rect x="' + (c + margin) + '" y="' + (r + margin) + '" width="1" height="1"/>';
      }
    }
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim +
    '" shape-rendering="crispEdges">' +
    '<rect width="100%" height="100%" fill="#ffffff"/>' +
    '<g fill="#000000">' + rects + '</g></svg>';
}

function render(number) {
  const numEl = document.getElementById('number');
  const qrEl = document.getElementById('qr');
  const hintEl = document.getElementById('hint');
  const btn = document.getElementById('callHere');

  if (!number) {
    qrEl.hidden = true;
    btn.hidden = true;
    hintEl.textContent = t('qrNoNumber') || 'No number.';
    numEl.textContent = '';
    return;
  }

  numEl.textContent = number;

  try {
    const qr = qrcode(0, 'M');
    qr.addData('tel:' + number);
    qr.make();
    qrEl.innerHTML = buildSvg(qr, 2);
  } catch (_e) {
    // Numero fuori misura per un QR (non dovrebbe capitare con un telefono):
    // resta almeno il numero in chiaro e il pulsante per chiamare dal computer.
    qrEl.hidden = true;
    hintEl.textContent = t('qrNoNumber') || '';
  }

  // "Chiama da questo computer": salta la modalita' QR (direct:true) e usa la
  // composizione normale. Si chiude dopo la conferma del service worker, con
  // un timeout di sicurezza.
  btn.addEventListener('click', () => {
    btn.disabled = true;
    let closed = false;
    const done = () => { if (!closed) { closed = true; window.close(); } };
    setTimeout(done, 800);
    chrome.runtime.sendMessage({ type: 'dial', number, direct: true }, () => {
      void chrome.runtime.lastError;
      done();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyI18n();
  chrome.storage.session.get('qrNumber', r => {
    void chrome.runtime.lastError;
    render((r && typeof r.qrNumber === 'string') ? r.qrNumber : '');
  });
});
