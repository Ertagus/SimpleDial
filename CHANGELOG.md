# Changelog

Tutte le modifiche rilevanti a SimpleDial sono annotate in questo file.
Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/);
il progetto segue il [versionamento semantico](https://semver.org/lang/it/).

## [3.0.1] — 2026-09-07

### Aggiunto
- **Click sinistro sui link `"tel:"`, disattivo di default.** Attivandolo, il
  click passa per l'estensione invece che per il browser: il permesso ad aprire
  l'applicazione esterna viene chiesto una volta sola invece che sito per sito.
  È spento di serie di proposito — quella richiesta per sito è un presidio di
  sicurezza, e scavalcarla deve restare una scelta dell'utente. Ctrl, Shift o Alt
  tenuti premuti lasciano comunque passare il click al browser, e se la pagina
  gestisce già i propri link comanda lei.
- **Segnale sull'icona quando una composizione fallisce.** Prima l'unica traccia
  era un `console.warn` che nessun utente guarda.

### Corretto
- Una selezione che comprendeva l'etichetta attorno al numero («Tel. 02 1234567»)
  non produceva alcuna voce di menu: la regola ancorata veniva applicata
  all'intera stringa, lettere incluse, e il triplo clic ci cadeva sempre perché
  prende il paragrafo. Ora la selezione viene divisa sugli spazi e le parole
  scartate; se le lettere sono incollate alle cifre il candidato è rifiutato,
  così un codice seriale resta escluso mentre un'etichetta viene ignorata.
  Prezzi e date continuano a non essere riconosciuti.

### Modificato
- Pagina delle opzioni riorganizzata in quattro sezioni, con la portata di ogni
  impostazione dichiarata accanto all'impostazione stessa.
- L'icona nella barra resta un collegamento diretto all'applicazione telefono
  anche con la modalità QR attiva: prima l'impostazione veniva sovrascritta.
- Tutte le catene `.then()` convertite in `async`/`await`.
- Chiave di traduzione dedicata per il segnaposto del pannello di composizione.
- `homepage_url` e `author` dichiarati nel manifest.

### Banco di prova
- Due sezioni nuove, 52 casi in tutto, pubblicato su
  [ertagus.github.io/SimpleDial/test-bench](https://ertagus.github.io/SimpleDial/test-bench).

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
