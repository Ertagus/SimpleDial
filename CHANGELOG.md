# Changelog

Tutte le modifiche rilevanti a SimpleDial sono annotate in questo file.
Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/);
il progetto segue il [versionamento semantico](https://semver.org/lang/it/).

## [3.0.0] — 2026-09-03

Major perché la 2.5.5 ha rimosso una funzione utente (le esclusioni per sito) e
questa versione ne introduce una che cambia il modo in cui la chiamata viene
consegnata. Prima pubblicazione sul Chrome Web Store.

### Aggiunto
- **Chiamata dal telefono tramite codice QR.** Nuova opzione nelle impostazioni:
  «Chiama dal telefono con un codice QR». Quando è attiva, la chiamata non viene
  più passata all'applicazione telefono del computer: si apre una finestrella con
  un codice QR che contiene l'indirizzo `tel:`. Inquadrandolo con la fotocamera
  del cellulare, la chiamata parte da lì. Serve a chiamare col telefono un numero
  che si è trovato sul computer, senza accoppiamenti, account o software in più.
  - Il codice è generato **interamente in locale**. L'estensione continua a non
    effettuare alcuna chiamata di rete: il numero non lascia il dispositivo.
  - La finestra mostra anche il numero in chiaro, così si verifica cosa si sta per
    chiamare prima di inquadrare, e offre un pulsante per chiamare comunque da
    questo computer.
  - Il QR contiene **sempre** `tel:`, qualunque sia lo schema impostato. Le
    fotocamere dei telefoni non sanno interpretare `callto:`, `sip:` o `skype:`, e
    un codice che si scansiona senza produrre nulla sarebbe peggio di una funzione
    assente. Lo schema impostato continua a valere per le chiamate dal computer.
  - Con la modalità QR attiva il clic sull'icona apre sempre il pannello per
    digitare un numero: un codice QR senza numero non avrebbe senso.
  - **Nessun permesso aggiuntivo.** L'estensione richiede ancora soltanto
    `storage` e `contextMenus`; il manifest non dichiara nulla di nuovo.

### Modificato
- Il controllo sul mittente dei messaggi di composizione verifica ora l'**origine**
  (`sender.url` deve appartenere all'estensione) invece della semplice assenza di
  una scheda. La finestra del QR è una finestra vera e quindi ha una scheda, pur
  essendo una pagina dell'estensione: il criterio precedente l'avrebbe rifiutata.
  Il nuovo criterio è anche più corretto in sé, perché i content script vengono
  respinti per l'origine del sito in cui girano.
- La composizione diretta richiesta dalla finestra del QR viaggia con un flag
  dedicato che salta il ramo QR. Senza, il pulsante «chiama da questo computer»
  avrebbe riaperto una finestra QR all'infinito.
- La scheda di appoggio creata quando la composizione non può usare la scheda
  corrente viene chiusa se la navigazione fallisce, invece di restare aperta e
  vuota.

### Note su codice di terzi
- Include `qrcode-generator` 1.4.4 di Kazuhiko Arase, licenza MIT, incluso senza
  modifiche. Non effettua chiamate di rete, non usa `eval` né accede al DOM:
  riceve una stringa e restituisce la matrice del codice, che l'estensione disegna
  da sé come SVG. È la prima libreria di terze parti del progetto: le affermazioni
  «zero dipendenze esterne» presenti fino alla 2.5.5 sono state aggiornate di
  conseguenza nella privacy policy e nella documentazione dello store.
- «QR Code» è un marchio registrato di DENSO WAVE INCORPORATED, citato qui in
  senso descrittivo.

## [2.5.5] — 2026-09-02

### Corretto
- Menu contestuale: quando viene riconosciuto un solo numero, la voce
  «Chiama …» compare direttamente nel menu invece che annidata in un
  sottomenu «SimpleDial ▸». Chrome raggruppa le voci di un'estensione quando
  ne risultano registrate più di una per il contesto in cui si apre il menu,
  e `visible: false` le nasconde ma **non** le de-registra: sul contesto
  `link` restavano registrate sia `dial_href` sia `dial_text`, quindi il
  sottomenu compariva anche con una sola voce visibile. Le voci senza numero
  vengono ora parcheggiate su un `documentUrlPatterns` che non corrisponde a
  nessuna pagina, e così escono dalla costruzione del menu. Con due numeri
  diversi il sottomenu ricompare: quello è il comportamento voluto, non un
  effetto collaterale.

### Rimosso
- **Esclusioni per sito.** La lista di domini su cui disattivare il
  riconoscimento è stata tolta da pagina opzioni, content script e traduzioni.
  Motivo: le voci di menu non venivano azzerate entrando su un sito escluso,
  perciò la voce costruita per la pagina precedente restava nel menu e restava
  cliccabile — componendo un numero che l'utente non aveva scelto lì. La
  pagina delle opzioni prometteva in sei lingue che «la voce di menu non
  compare», e non era vero. Un primo tentativo di correzione ha introdotto una
  seconda regressione, facendo sparire la voce anche sulle pagine normali.
  Nessuna versione era mai stata pubblicata, quindi la rimozione non toglie
  nulla a nessuna installazione esistente: una funzione il cui scopo è *non*
  agire, che poi agisce lo stesso, è peggio che assente. Se tornerà, la prima
  cosa da progettare è l'azzeramento delle voci, non il riconoscimento del
  dominio.

### Modificato
- L'invio dei numeri candidati dal content script al service worker non attende
  più una lettura asincrona da `chrome.storage.local` — serviva solo a sapere se
  il sito fosse escluso. È un passaggio asincrono in meno nel tratto fra il
  click destro e il disegno del menu da parte di Chrome, che è il punto più
  sensibile ai tempi in tutta l'estensione.
- L'impostazione `excludedSites` in `chrome.storage.local` non viene più né
  letta né scritta. Non viene spedito alcun codice di pulizia: nessuna versione
  pubblicata l'ha mai impostata, quindi non esiste in nessun profilo utente.

## [2.5.4] — 2026-09-02

### Corretto
- I parametri di un URI `tel:` (`;ext=`, `;phone-context=`, `;isub=`, RFC 3966)
  non vengono più inglobati nel numero. Prima le loro cifre venivano saldate
  in coda: `tel:+15550101234;ext=99` finiva composto come `+1555010123499`,
  `tel:863-1234;phone-context=+1-914` come `86312341914`. Ora tutto ciò che
  segue il primo `;` viene scartato prima della pulizia del numero, sia sul
  link sotto al cursore (`content.js`, `cleanHref`) sia nella rete di
  sicurezza del click sul menu contestuale (`background.js`). Il taglio
  avviene dopo il decode, quindi copre anche un `;` codificato come `%3B`.
  Il click diretto su un link `tel:` non era interessato: lo gestisce il
  browser, che i parametri li interpreta correttamente.

### Modificato
- I rami di fallimento della composizione (creazione o navigazione della
  scheda rifiutata da Chrome) ora scrivono un `console.warn` nel service
  worker invece di fallire in silenzio: aiuta a capire perché una chiamata
  non è partita. Nessun cambiamento visibile all'utente.
- Il content script non passa più una callback di risposta al messaggio
  `MENU_PREPARE` (non ne è mai attesa una): elimina un `lastError`
  "message port closed" generato e subito scartato a ogni evento.

<!--
Le versioni precedenti alla 2.5.4 non erano tracciate in questo file.
Il numero di versione di riferimento resta quello in manifest.json.
-->
