# SimpleDial

Riconosce i numeri di telefono nelle pagine web e li compone tramite l'handler
`tel:` registrato nel browser o nel sistema operativo — oppure li mostra come
codice QR, da inquadrare col telefono per chiamare da lì.

**[Installa dal Chrome Web Store](https://chromewebstore.google.com/detail/simpledial/mpgblhliidfflfdofhpbhjijmncnamfk)**

## Dove guardare

Il codice è pubblico. Questi sono i punti che rispondono alle domande più
comuni su cosa fa e cosa non fa:

| Domanda | Dove si vede |
|---|---|
| Contatta qualche server? | cerca `fetch`, `XMLHttpRequest`, `WebSocket` nei sorgenti: zero occorrenze |
| Scarica codice da fuori? | no, tutti gli script sono nel pacchetto |
| Usa `eval`? | no, il Manifest V3 non lo consente |
| Quali permessi chiede? | `manifest.json` dichiara `storage` e `contextMenus`, nessun `host_permissions` |
| Tocca le pagine che visiti? | `content.js` legge il DOM, non lo scrive mai |
| Il QR viene da internet? | no, `qr.js` costruisce l'SVG con la libreria inclusa |

Il pacchetto pubblicato è in `dist/`, se vuoi confrontarne il contenuto con
questi sorgenti.

## Come funziona

SimpleDial **non compone la chiamata da sé**: riconosce il numero e lo consegna
all'handler che hai già registrato. Chi risponde dipende da quello — un
softphone, un centralino, l'app telefono del sistema.

- **Tasto destro** su un link `tel:` o su un numero selezionato → voce *Chiama*
- **Click sinistro** su un link `tel:` → opzionale, disattivo di default
- **Icona nella barra** → apre l'app telefono, oppure un pannello per digitare

Con l'opzione QR attiva, ogni chiamata mostra invece un codice generato sul
computer: lo inquadri col telefono e la chiamata parte da lì. Utile quando il
numero è sullo schermo ma vuoi chiamare col cellulare.

## Struttura

```
manifest.json          Manifest V3
background.js          service worker: menu contestuale, composizione, finestra QR
content.js             legge link e selezione, intercetta il click (se attivo)
options.html/.js       pagina delle impostazioni
popup.html/.js         pannello per digitare un numero
qr.html/.js            finestra del codice QR
qrcode-generator.js    libreria QR di Kazuhiko Arase (MIT), inclusa senza modifiche
_locales/              6 lingue: de, en, es, fr, it, pt_BR
docs/                  sito pubblico: presentazione, privacy policy, banco di prova
scripts/package.ps1    costruisce il pacchetto da una lista esplicita di file
```

## Provarla dai sorgenti

1. `chrome://extensions` → attiva **Modalità sviluppatore**
2. **Carica estensione non pacchettizzata** → seleziona questa cartella
3. Apri `docs/test-bench.html` e segui i casi — è anche online:
   **[ertagus.github.io/SimpleDial/test-bench](https://ertagus.github.io/SimpleDial/test-bench)**

## Licenza di terze parti

`qrcode-generator.js` è di Kazuhiko Arase, licenza MIT, incluso senza modifiche.
SHA-256: `18ae399f81182bc9de916e9c77b195df20cc58d6f2d55a62b085a299f1bf1780`

«QR Code» è un marchio registrato di DENSO WAVE INCORPORATED, citato qui in
senso descrittivo.
