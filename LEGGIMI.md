# Lanterna — taccuino del GM per Daggerheart

App per gestire qualsiasi campagna di Daggerheart dal telefono. Funziona offline e salva tutto sul dispositivo: niente account, niente server, niente costi.

## Cosa fa

- **Tavolo**: tracciato della Paura (0-12), schede rapide dei PG con PF, Stress, Speranza (che si riduce con le cicatrici), Armatura, soglie e condizioni. Calcolo del danno con le soglie e l'uso dello slot Armatura. Riposo in blocco.
- **Conti alla rovescia**: di progresso, di conseguenza e di campagna, anche ciclici.
- **Scontro**: avversari in scena con PF, Stress, condizioni, protagonista (★) e gruppi di Seguaci con la regola Seguace (X). Ambiente attivo con le sue caratteristiche sotto mano.
- **Creatore di scontri** (Scontro → Scontri): scontri salvati e riutilizzabili, ognuno con:
  - calcolo dei Punti Battaglia del manuale (3 × PG + 2) con i modificatori automatici (Solitari, rango inferiore, niente Bruti/Orde/Condottieri) e quelli a scelta, più un **indicatore di difficoltà** (Facile, Equilibrato, Impegnativo, Pericoloso) e l'avviso se usi avversari di rango superiore al gruppo;
  - **Genera** e **Riempi**: una bozza che riempie il budget con avversari del rango giusto, per stile (equilibrato, con boss, orda, élite), fonte e tema anche in italiano ("non morti", "banditi", "demoni"…), da rifinire a mano;
  - selezione multipla degli avversari con filtri, nomi in scena personalizzati (reskin) e note per ogni voce;
  - **rinforzi** fuori budget, pronti da far entrare in scena con un tocco durante lo scontro;
  - obiettivo, ambiente, funzione narrativa, tattiche, terreno, "l'altra via", ricompense e conti alla rovescia dello scontro (creati sul Tavolo all'avvio, rimossi alla fine);
  - stato Bozza / Pronto / Giocato, esito da annotare a fine scontro, anteprima con tutte le schede, duplica e condividi come testo.
- **Bestiario**: avversari e ambienti personalizzati nel formato ufficiale, incluse "L'altra via" e Toccato dall'Umbra. Tabelle casuali personalizzate.
- **Mondo**: PNG, luoghi, fazioni, oggetti e lore, con tag e ricerca.
- **Diario**: prepara, gioca e chiudi ogni sessione.
  - **Prepara** (metodo "Return of the Lazy DM"): i personaggi, l'apertura forte, le scene possibili, i segreti e gli indizi, luoghi e PNG, gli scontri e le mappe della serata, le ricompense. In cima vedi com'è finita l'ultima volta e i conti alla rovescia vicini. I **segreti non rivelati** e i **fili aperti** (promesse, domande, indizi) passano da soli alla sessione dopo. **Copia per Claude** prepara un messaggio con tutto il contesto; con **Incolla la risposta** le sezioni di Claude finiscono da sole nei campi giusti.
  - **Inizia la sessione**: in alto compaiono il timer e il pulsante ✎ per le note veloci, anche **dettate a voce**, con etichette (PNG, promessa, indizio, segreto…). L'app scrive da sola il **diario della serata**: Paura, PF dei PG, mosse della morte, conti alla rovescia, scontri, avversari sconfitti, mappe inviate, scene giocate e segreti rivelati. La pagina della sessione mostra la scaletta da spuntare, i segreti da rivelare con un tocco, gli scontri pronti e i **riflettori** (chi non ha avuto la scena da un po').
  - **Termina e chiudi**: una bozza di resoconto fatta dal diario, i fili da portare avanti, i conti alla rovescia da avanzare, l'"a parte", il **riassunto per il gruppo** senza segreti da mandare su WhatsApp e **Copia per Claude**, che prepara il messaggio per avere resoconto in prosa, riassunto per i giocatori, "a parte" e bozza della prossima sessione.
- **Dadi** (pulsante rotondo): tiro di Dualità con vantaggio, svantaggio e Difficoltà; qualsiasi espressione come 3d8+4; cronologia dei tiri.
- **Mappe** (scheda in basso): pensate per il teatro della mente, senza miniature.
  - **Le mie mappe**: aggiungi immagini dalla galleria o dai file, oppure condividile a Lanterna da Drive, dalla galleria o da WhatsApp (dopo aver installato l'app compare tra le app a cui condividere). Restano sul telefono e funzionano offline. Categorie in italiano, tag, didascalia e collegamento a un luogo del Mondo.
  - **Invia**: un tocco apre la condivisione di Android: scegli WhatsApp e il gruppo. L'immagine viene ridotta a 2048 px, così parte subito; la didascalia diventa il testo del messaggio.
  - **Disegna prima di inviare**: penna, segnaposto numerati e **nebbia** ("Nebbia su tutto" e poi "Rivela", oppure "Copri"). Tu la vedi velata, i giocatori la ricevono nera: mandi solo ciò che hanno scoperto. "Invia senza segni" manda la mappa pulita.
  - **In scena** (★): le mappe della serata compaiono in cima al Tavolo, pronte da inviare. Puoi collegare una mappa anche a uno scontro (compare nel riquadro dello scontro in corso) e a un luogo (compare nella sua scheda).
  - **Raccolta**: importa `mappe-raccolta.json` (menu → Importa backup) per avere le 15 categorie del tuo pacchetto da 12.500 mappe. Senza chiave API si aprono in Drive; con la chiave (vedi sotto) le sfogli nell'app, le invii direttamente, le salvi tra le tue e **cerchi in tutta la raccolta in italiano** ("palude", "taverna notte", "cripta"), con le versioni a griglia nascoste.
- **Più campagne**, backup ed esportazione in JSON, ripristino.
- **Pacchetti di contenuti**: "Importa backup" riconosce anche i pacchetti (file `lanterna-pack`) e li aggiunge alla campagna attiva o a una nuova, senza sovrascrivere nulla: le voci con un nome già presente vengono saltate.
- **Da confermare**: le voci importate da un pacchetto possono arrivare "da confermare", con la fonte (manuale, nostre chat, proposta) e una domanda. Le trovi nella barra in cima al Tavolo e al Mondo; per ognuna scegli Conferma, Modifica (salvando si conferma) o Elimina, tutto annullabile. C'è anche "Conferma tutte le voci prese dal manuale".
- **Libreria SRD 2.0 inclusa, in italiano**: 265 avversari e 47 ambienti ufficiali (quelli del manuale base più le novità dello SRD 2.0), filtrabili per fonte, rango e ruolo. I testi sono tradotti dallo SRD inglese; nomi di avversari, ambienti, caratteristiche, armi ed esperienze seguono l'edizione italiana del manuale, e per le creature nuove sono nello stesso stile. Sotto il nome trovi quello inglese, e la ricerca funziona in tutte e due le lingue. Nelle impostazioni puoi tornare al testo inglese originale. Si usano direttamente in scena e nel creatore di scontri; "Copia e modifica" ne crea una versione tua.
- **Pacchetti**: avversari, ambienti e tabelle homebrew si importano da un file JSON (menu → Importa backup). Il pacchetto della campagna resta privato, fuori dal repository.
- **Mappa del mondo** (Mondo → 🗺 Mappa): carica la mappa dell'ambientazione e appoggiaci sopra i luoghi del Mondo. Tocchi un luogo e vedi chi e cosa è collegato (Legami, PNG che ci vivono, dove è citato); i luoghi collegati si illuminano e sono uniti da una linea. Dalla scheda di un luogo, "Sulla mappa" ti porta al punto giusto. L'immagine resta sul telefono: i backup salvano le posizioni ma non l'immagine.
- **Collegamenti**: i nomi di PG, voci del Mondo, avversari e ambienti della campagna diventano link **da soli** mentre scrivi gli appunti: niente parentesi. Funziona anche con il solo nome di un PNG ("Ivo") e con gli **altri nomi** che aggiungi alla voce ("il Fabbro"). `[[Nome]]` resta disponibile per le voci che non esistono ancora: toccandolo le crei. Ogni scheda ha una sezione **Legami** con "+ Legame": scegli chi o cosa collegare e, se vuoi, il rapporto (alleato, nemico, lavora per, vive a…). Il legame compare su entrambe le schede. Sotto trovi "Citato in", cioè dove la voce è nominata. Il collegamento automatico si spegne nelle impostazioni.
- **Schermo del GM** (libro in alto, a tutto schermo): le regole come schede da aprire con un tocco, con una ricerca che trova la riga esatta (es. «Vulnerabile») e tabelle leggibili in verticale sul telefono: tiri ed esiti, Difficoltà, vantaggio e tiri di gruppo, mosse del GM, uso della Paura, distanze, danni e Armatura, condizioni, mosse finali, riposi, Punti Battaglia e meccaniche dell'Era di Umbra. Le trova anche la ricerca globale.
- **Al volo** (Schermo del GM → Al volo, oppure dal pulsante dei dadi): tutti i generatori visibili insieme in una griglia, filtri a tendina, Rilancia sempre in basso e le frecce ‹ › per tornare ai risultati precedenti. Ogni risultato nasce da un **archetipo coerente**: si sceglie prima *cosa* è, poi ogni dettaglio viene da liste scritte per quell'archetipo, e l'app evita di ripetere le uscite recenti. *PNG*: 30 archetipi con frase da leggere, aspetto, battuta, cosa vuole dai PG, cosa offre, segreto solo per il GM, legame con un PG e scheda SRD se si combatte. *Luogo*: 20 ambienti in stile Daggerheart con impeti, caratteristiche tarate sul rango, domande per i giocatori e avversari SRD; si salvano come ambienti nel bestiario. *Viaggio*: 8 terreni con tempo, evento, scoperta, pericolo e avversari. *Trappola*: 16 trappole con innesco, indizio, effetto e disinnesco. *Incarico*: 10 tipi. *Imprevisto*: 72 mosse del GM divise per contesto. *Inizio forte*: 80 aperture in 8 contesti. *Segreti e dicerie* costruiti anche con i PNG, i luoghi e le fazioni del vostro Mondo; ogni diceria dice al GM se è vera e cosa c'è dietro. Poi locande, nomi, bottino e consumabili (manuale base e tabella aggiuntiva SRD 2.0).
- **Adatta al rango**: da ogni scheda avversario crei una copia portata a un altro rango, seguendo la tabella del manuale "Statistiche improvvisate per rango" (Difficoltà, soglie, attacco, danni, Seguaci; PF e Stress quando si passa tra i ranghi 1-2 e 3-4), con l'anteprima di prima e dopo. Nel creatore di scontri "Adatta tutti al Rango N" sistema l'intera composizione.
- **Ricerca globale** (lente in alto): nomi di tutto e testo degli appunti.
- **Paura sempre in alto**, con − e +, da qualsiasi schermata.
- **Dadi nel testo**: ogni espressione come 2d8+3 nelle schede e negli appunti si tira con un tocco.
- **Attacco degli avversari**: d20 + ATT e danno in un tocco, con il critico (19-20 per chi è Toccato dall'Umbra) che aggiunge il massimo dei dadi.
- **Speranza ai PG** direttamente dal risultato del tiro di Dualità.
- **Annulla** dopo ogni eliminazione, al posto delle conferme.
- **Tasto indietro di Android**: chiude il foglio aperto, poi torna alla schermata precedente.
- Nelle impostazioni: **schermo sempre acceso** durante il gioco e **testo più grande**.

## Installarla sul telefono (gratis)

Una PWA va servita da un indirizzo web https; dopo la prima apertura funziona anche offline.

### 1. Metterla online con GitHub Pages
1. Crea un account gratuito su github.com (se non ce l'hai).
2. Crea un nuovo repository pubblico, per esempio `lanterna`.
3. "Add file" → "Upload files" e trascina **tutto il contenuto** di questa cartella (index.html, app.js, cartelle fonts e icons comprese). Conferma.
4. Settings → Pages → Source: "Deploy from a branch", branch `main`, cartella `/ (root)`. Salva.
5. Dopo un minuto l'app è su `https://TUONOME.github.io/NomeRepo/` (maiuscole comprese: il percorso distingue maiuscole e minuscole).

### 2. Installarla su Android
1. Apri quell'indirizzo con **Chrome**.
2. Menu ⋮ → **Installa app** (o "Aggiungi a schermata Home").
3. Si apre a schermo intero, con la sua icona, e funziona anche senza rete.

### 3. Se vuoi un APK vero (facoltativo, gratis)
1. Vai su **pwabuilder.com** e incolla l'indirizzo dell'app.
2. Scegli "Package for stores" → **Android** → genera il pacchetto.
3. Nello zip scaricato trovi l'APK da installare sul telefono (consenti l'installazione da origini sconosciute). Serve solo se vuoi un file .apk; l'installazione dal punto 2 è equivalente nell'uso quotidiano.

## Chiave API di Google Drive (facoltativa, gratis)

Serve solo per sfogliare e cercare la raccolta di mappe dentro l'app. Senza chiave tutto il resto funziona e le categorie si aprono nell'app Drive.

1. Vai su **console.cloud.google.com** con il tuo account Google e crea un progetto (per esempio "Lanterna"). Non serve la carta di credito.
2. Menu → **API e servizi** → **Libreria**: cerca **Google Drive API** e premi **Abilita**.
3. **API e servizi** → **Credenziali** → **Crea credenziali** → **Chiave API**. Copia la chiave (inizia con `AIza`).
4. Apri la chiave e proteggila: in **Restrizioni delle applicazioni** scegli **Referrer HTTP (siti web)** e aggiungi `https://TUONOME.github.io/*`; in **Restrizioni API** scegli solo **Google Drive API**. Salva.
5. In Lanterna: **Mappe** → **Raccolta** → **Inserisci la chiave API**. La chiave resta sul telefono (e, se usi la sincronizzazione, nella cartella nascosta del tuo Drive).
6. La prima volta premi **Crea l'indice**: legge l'elenco di tutte le cartelle (qualche minuto con migliaia di file) e da lì la ricerca è istantanea. Rifallo solo se il venditore aggiunge mappe.

La chiave funziona perché le cartelle del pacchetto sono condivise con "chiunque abbia il link". Se un giorno il venditore le rende private, la ricerca smette di funzionare, ma le mappe già salvate tra le tue restano.

## Più dispositivi: sincronizzazione con Google Drive (facoltativa, gratis)

Le campagne restano uguali su telefono, tablet e computer. L'app le salva in una cartella **nascosta** del tuo Drive, che può leggere solo Lanterna: non vede gli altri tuoi file, e tu non la vedi tra i file di Drive. Si sincronizzano le campagne, le mappe salvate (immagini, segni e nebbia), la mappa del mondo, la Raccolta collegata e la chiave API. Restano su ogni dispositivo solo l'indice di ricerca della Raccolta (premi «Crea l'indice» sul nuovo dispositivo) e le preferenze.

Serve un "ID client OAuth", da creare una volta sola nello stesso progetto Google Cloud della chiave API:

1. Vai su **console.cloud.google.com** e scegli il progetto della chiave API.
2. **API e servizi → Libreria**: controlla che **Google Drive API** sia attivata.
3. **API e servizi → Schermata consenso OAuth** (o "Google Auth Platform"): tipo **Esterno**, nome app "Lanterna", la tua email come contatto. Nella sezione **Utenti di prova** (Pubblico/Audience) aggiungi la tua email Gmail, e quella di chiunque altro userà la sincronizzazione. Non serve pubblicare l'app.
4. **API e servizi → Credenziali → Crea credenziali → ID client OAuth**:
   - Tipo di applicazione: **Applicazione web**.
   - **Origini JavaScript autorizzate**: `https://ismaelebagnara.github.io` (solo il dominio, senza `/Lanterna/` e senza barra finale).
   - Non servono URI di reindirizzamento.
5. Copia l'**ID client** (finisce con `.apps.googleusercontent.com`). Non è un segreto: identifica solo l'app.
6. In Lanterna: menu → **Più dispositivi** → incolla l'ID → **Accedi con Google e sincronizza**. Google dirà che l'app "non è verificata": tocca **Continua**, è la tua.
7. Ripeti il punto 6 su ogni dispositivo.

Come funziona poi:
- Quando apri l'app scarica le novità; quando modifichi qualcosa, salva su Drive dopo qualche secondo.
- La **nuvola** in alto mostra lo stato: verde = sincronizzato, gialla = tocca per riconnetterti (l'accesso di Google dura un'ora; quando scade basta un tocco), rossa = c'è un problema o una scelta da fare. Durante una sessione la nuvola verde si nasconde per fare spazio.
- Se la stessa campagna è stata modificata su due dispositivi prima di sincronizzarsi, l'app chiede quale tenere (o tiene entrambe come copie). Niente viene sovrascritto in silenzio.
- Se elimini una campagna, sugli altri dispositivi ti chiede se eliminarla anche lì. Una mappa eliminata sparisce da tutti i dispositivi.
- Le mappe occupano spazio nel tuo Drive (i 15 GB gratuiti): la prima sincronizzazione con tante mappe può richiedere qualche minuto.

## Attenzione ai segreti

Il repository di GitHub Pages è pubblico: **non caricarci mai i file della tua campagna** (backup, pacchetti come `umbra-campagna-da-confermare.json` o `umbra-pacchetto-privato.json`, né `mappe-raccolta.json`, che contiene i link del pacchetto che hai comprato). Contengono i segreti per il GM. Importali direttamente dal telefono con "Importa backup".

## Backup

I dati restano solo sul telefono. Le immagini delle mappe non sono dentro il backup .json (sarebbe enorme): le originali restano su Drive o nella tua galleria. Se cancelli i dati di Chrome o cambi dispositivo li perdi, quindi ogni tanto apri il menu (tocca il nome della campagna in alto) → **Esporta tutto**, e conserva il file .json. Con **Importa backup** lo ripristini, anche su un altro telefono.

## Aggiornare l'app

Sostituisci i file nel repository. Per far scaricare subito la nuova versione a chi l'ha installata, cambia il numero in `sw.js` (ora `lanterna-v10`: portalo a `lanterna-v11`, e così via). Se il telefono continua a mostrare la versione vecchia: menu → **Aggiorna l'app** (non cancella campagne né mappe).

---
Strumento non ufficiale, non affiliato né approvato da Critical Role o Darrington Press. Include materiali dal Daggerheart System Reference Document 2.0, © Critical Role, LLC, secondo i termini della Darrington Press Community Gaming License (DPCGL). Modifiche: conversione di formato e traduzione in italiano. Informazioni: daggerheart.com. Font Cinzel e Crimson Pro sotto SIL Open Font License.
