// Schermo del GM: promemoria delle regole di Daggerheart in italiano (sintesi originale; termini allineati al manuale).
// Le regole di gioco provengono dal Daggerheart SRD 2.0, © Critical Role, LLC, secondo la DPCGL.
window.RULES = [
  { id: "tiri", title: "Risolvere un tiro azione", tags: "dualità speranza paura successo fallimento critico",
    body: `
<p>Il giocatore tira i <b>Dadi Dualità</b> (d12 Speranza + d12 Paura), somma il tratto e le Esperienze usate, e confronta con la <b>Difficoltà</b>.</p>
<table class="rt"><tr><th>Esito</th><th>In breve</th><th>Risorse</th></tr>
<tr><td>Successo con Speranza</td><td><b>Sì, e…</b> ottiene ciò che vuole</td><td>il PG ottiene 1 Speranza</td></tr>
<tr><td>Successo con Paura</td><td><b>Sì, ma…</b> c'è un costo o una complicazione</td><td>voi ottenete 1 Paura</td></tr>
<tr><td>Fallimento con Speranza</td><td><b>No, ma…</b> le cose non vanno come previsto</td><td>il PG ottiene 1 Speranza</td></tr>
<tr><td>Fallimento con Paura</td><td><b>No, e…</b> e peggiorano</td><td>voi ottenete 1 Paura</td></tr>
<tr><td>Successo critico (dadi uguali)</td><td>riesce comunque, e qualcosa in più</td><td>1 Speranza e rimuove 1 Stress</td></tr></table>
<p>Non sminuite un successo con Paura: la complicazione arriva, ma il PG ottiene ciò che voleva.</p>
<p>Dopo un tiro con Paura o un fallimento, i riflettori passano a voi: fate una mossa del GM.</p>` },

  { id: "diff", title: "Difficoltà", tags: "difficoltà tiro difficoltà npc",
    body: `
<table class="rt"><tr><td>5</td><td>Molto facile</td></tr><tr><td>10</td><td>Facile</td></tr><tr><td>15</td><td>Media</td></tr><tr><td>20</td><td>Difficile</td></tr><tr><td>25</td><td>Molto difficile</td></tr><tr><td>30</td><td>Quasi impossibile</td></tr></table>
<p>Non serve un multiplo di 5. Contro un avversario si usa la Difficoltà del suo blocco statistiche; per i tiri non d'attacco potete aggiungervi la sua Esperienza pertinente.</p>
<p><b>Tiro Difficoltà</b>: se un PNG non ha statistiche o volete imprevedibilità, tirate un d20 e aggiungete la sua Esperienza pertinente.</p>
<p><b>Gradi di successo</b>: per indagini e ricordi, scalate quanto rivelare in base a quanto il tiro supera (o manca) il numero.</p>` },

  { id: "vantaggio", title: "Vantaggio, aiuto e tiri di gruppo", tags: "vantaggio svantaggio aiutare alleato tiro di gruppo tiro combinato",
    body: `
<ul><li><b>Vantaggio</b>: si aggiunge un d6 al totale. <b>Svantaggio</b>: si sottrae un d6. Vantaggio e svantaggio si annullano a vicenda.</li>
<li><b>Aiutare un Alleato</b>: un PG spende 1 Speranza e descrive come aiuta: l'alleato tira con vantaggio. Se aiutano in più, si tiene il d6 più alto.</li>
<li><b>Tiro di Gruppo</b>: un capo tira l'azione, gli altri tirano Tiri Reazione; ogni successo dà +1 al tiro del capo, ogni fallimento −1.</li>
<li><b>Tiro Combinato</b>: una volta per sessione per giocatore, due PG spendono insieme 3 Speranze, tirano entrambi e scelgono uno dei due risultati per tutti e due. Se è un attacco, sommano i danni.</li>
<li><b>Tiro Reazione</b>: tiro del tratto indicato contro una Difficoltà; non genera né Speranza né Paura, e il critico riesce e basta.</li></ul>` },

  { id: "mosse", title: "Mosse del GM", tags: "mosse gm morbide dure",
    body: `
<p><b>Quando fate una mossa</b>: dopo un tiro con Paura o un fallimento, quando i giocatori vi guardano per sapere cosa succede, quando vi offrono un'occasione d'oro.</p>
<p>Dalle più morbide alle più dure:</p>
<ol><li>Mostrate come reagisce il mondo.</li><li>Fate una domanda e sviluppate la risposta.</li><li>Fate agire un PNG secondo le sue motivazioni.</li><li>Usate gli obiettivi di un PG per spingerlo ad agire.</li><li>Segnalate una minaccia imminente fuori scena.</li><li>Svelate una verità scomoda o un pericolo inaspettato.</li><li>Costringete il gruppo a dividersi.</li><li>Fate marcare uno Stress come conseguenza.</li><li>Fate una mossa che i personaggi non vedono.</li><li>Mostrate i danni collaterali.</li><li>Eliminate una condizione o un effetto temporaneo.</li><li>Cambiate l'ambiente.</li><li>Rendete protagonista un avversario.</li><li>Catturate qualcuno o qualcosa di importante.</li><li>Usate il passato di un PG.</li><li>Eliminate un'opportunità per sempre.</li></ol>
<p>Mosse morbide per i fallimenti con Speranza, più dure per i tiri con Paura. Descrivete la mossa nella fiction, non con il suo nome.</p>` },

  { id: "paura", title: "Usare la Paura", tags: "paura spendere quanta scena",
    body: `
<p><b>Si ottiene</b>: 1 Paura per ogni tiro dei PG con Paura; con un riposo breve 1d4; con un riposo lungo 1d4 + numero di PG. Massimo 12.</p>
<p><b>Si spende per</b>:</p>
<ul><li>interrompere i PG e fare una mossa del GM;</li><li>fare una mossa aggiuntiva nel vostro turno;</li><li>rendere protagonista un altro avversario;</li><li>usare le caratteristiche di Paura di avversari e ambienti;</li><li>aggiungere un'Esperienza di un avversario a un suo tiro.</li></ul>
<table class="rt"><tr><th>Scena</th><th>Paura da spendere</th></tr>
<tr><td>Incidentale (riposo, spesa, chiacchiere)</td><td>0–1</td></tr><tr><td>Minore (viaggio, rissa)</td><td>1–3</td></tr><tr><td>Normale (battaglia con un obiettivo, trattativa tesa)</td><td>2–4</td></tr><tr><td>Maggiore (Solitario o Condottiero, svolta di un PG)</td><td>4–8</td></tr><tr><td>Climax (scontro finale, battaglia campale)</td><td>6–12</td></tr></table>
<p><b>Troppa Paura accumulata?</b> Iniziate lo scontro interrompendo i PG, spendetene una in più a ogni vostro turno, oppure dopo un attacco mancato rendete protagonista un altro avversario.</p>` },

  { id: "distanze", title: "Distanze", tags: "distanza mischia prossima ravvicinata lontana remota portata",
    body: `
<table class="rt"><tr><th>Distanza</th><th>A occhio</th><th>Caselle</th></tr>
<tr><td>Mischia</td><td>a portata di mano</td><td>1</td></tr>
<tr><td>Prossima</td><td>pochi passi</td><td>3</td></tr>
<tr><td>Ravvicinata</td><td>3–9 metri, l'altro lato della stanza</td><td>6</td></tr>
<tr><td>Lontana</td><td>fino a una trentina di metri</td><td>12</td></tr>
<tr><td>Remota</td><td>oltre, fino a dove si vede</td><td>13+</td></tr>
<tr><td>Fuori Portata</td><td>fuori dalla scena</td><td>—</td></tr></table>
<p>In pericolo, un PG può muoversi entro distanza Ravvicinata come parte della sua azione; più lontano serve un Tiro Agilità.</p>` },

  { id: "danni", title: "Danni, soglie e Armatura", tags: "danno soglie maggiore grave massiccio armatura resistenza immunità diretto stress",
    body: `
<table class="rt"><tr><th>Danno</th><th>PF marcati</th></tr><tr><td>sotto la soglia Maggiore</td><td>1 (Minore)</td></tr><tr><td>Maggiore o più</td><td>2</td></tr><tr><td>Grave o più</td><td>3</td></tr><tr><td>Massiccio (regola opzionale: doppio della Grave)</td><td>4</td></tr></table>
<ul><li><b>Armatura</b>: il PG può marcare una Casella Armatura per ridurre il danno di un livello di soglia.</li>
<li><b>Resistenza</b>: il danno di quel tipo si dimezza prima di confrontarlo con le soglie. <b>Immunità</b>: nessun danno.</li>
<li><b>Danno diretto</b>: non si può ridurre con l'Armatura.</li>
<li><b>Stress</b>: chi deve marcare uno Stress e non può, marca un PF. Con l'ultimo Stress marcato si diventa Vulnerabili.</li>
<li>Seguaci con Attacco in Massa e caratteristiche simili: sommate i danni sullo stesso bersaglio prima di confrontarli con le soglie.</li></ul>` },

  { id: "condizioni", title: "Condizioni", tags: "condizioni vulnerabile trattenuto nascosto temporanea",
    body: `
<ul><li><b>Vulnerabile</b>: i tiri contro di lui hanno vantaggio.</li>
<li><b>Trattenuto</b>: non può muoversi, ma può ancora agire da dove si trova.</li>
<li><b>Nascosto</b>: finché non è visto, i tiri contro di lui hanno svantaggio. Finisce se si mostra, attacca o viene scoperto.</li></ul>
<p>Le condizioni <b>temporanee</b> si rimuovono con un'azione adatta (spesso un tiro) o a fine scena. Un avversario può rimuoverne una se lo rendete protagonista e ha senso nella fiction.</p>
<p>Le caratteristiche possono introdurre condizioni speciali (per esempio Spaventato, Avvelenato): leggete la loro descrizione.</p>` },

  { id: "morte", title: "Mosse finali e cicatrici", tags: "morte mossa finale gloria evitare rischiare cicatrice",
    body: `
<p>Quando un PG marca l'ultimo PF, sceglie una <b>mossa finale</b>:</p>
<ul><li><b>Gloria Finale</b>: compie un'ultima azione epica che riesce con un successo critico, poi muore.</li>
<li><b>Evitare la Morte</b>: sviene e resta fuori dai giochi finché la scena non finisce o qualcuno lo soccorre. Tira il Dado Speranza: se il risultato è pari o inferiore al suo livello, ottiene una <b>cicatrice</b>.</li>
<li><b>Rischiare Tutto</b>: tira i Dadi Dualità. Se vince la Speranza, rimuove PF o Stress per un totale pari al Dado Speranza; se vince la Paura, muore; con un critico rimuove tutti i PF e lo Stress.</li></ul>
<p><b>Cicatrice</b>: cancella per sempre una casella Speranza e il giocatore racconta come l'ha segnato. Senza più caselle Speranza, il PG si ritira. Nell'Era di Umbra invece soccombe all'Umbra.</p>
<p>Al tavolo usate anche la tabella <b>Peggioramenti</b> nel Bestiario → Tabelle.</p>` },

  { id: "riposi", title: "Riposi e interludio", tags: "riposo breve lungo interludio mosse curare prepararsi progetto",
    body: `
<p>A ogni riposo ogni PG sceglie <b>due mosse da interludio</b>, anche la stessa due volte. Dopo tre riposi brevi di fila serve un riposo lungo.</p>
<table class="rt"><tr><th>Riposo breve (circa un'ora)</th><th>Riposo lungo (una notte)</th></tr>
<tr><td>Curare le ferite: rimuove 1d4 + rango PF</td><td>Curare tutte le ferite</td></tr>
<tr><td>Liberare la mente: rimuove 1d4 + rango Stress</td><td>Liberare del tutto la mente</td></tr>
<tr><td>Riparare l'armatura: 1d4 + rango Caselle Armatura</td><td>Riparare tutta l'armatura</td></tr>
<tr><td>Prepararsi: +1 Speranza (+2 a testa se lo fanno insieme)</td><td>Prepararsi</td></tr>
<tr><td></td><td>Lavorare a un progetto (con un conto alla rovescia di progresso)</td></tr></table>
<p><b>Il GM</b>: con un riposo breve ottiene 1d4 Paure; con un riposo lungo 1d4 + numero di PG, e può far avanzare un conto alla rovescia a lungo termine.</p>` },

  { id: "avversari", title: "Punti Battaglia e ruoli", tags: "punti battaglia scontro bilanciare ruoli costi avversari",
    body: `
<p><b>Budget</b>: 3 × numero di PG + 2.</p>
<table class="rt"><tr><th>Costo</th><th>Ruolo</th></tr><tr><td>1</td><td>un gruppo di Seguaci grande quanto il gruppo dei PG, Controparte, Supporto</td></tr><tr><td>2</td><td>Base, Orda, Sicario, Tiratore</td></tr><tr><td>3</td><td>Condottiero</td></tr><tr><td>4</td><td>Bruto</td></tr><tr><td>5</td><td>Solitario</td></tr></table>
<p><b>Modificatori</b>: −1 scontro più facile o breve; −2 con due o più Solitari; −2 se gli avversari infliggono +1d4 danni; +1 con avversari di rango inferiore; +1 senza Bruti, Orde, Condottieri o Solitari; +2 scontro più pericoloso o lungo.</p>
<p>Il creatore di scontri (Scontro → Scontri) fa questi conti per voi.</p>` },

  { id: "umbra", title: "Era di Umbra", tags: "umbra toccato oscurità agguato veglia piaga ramo benedetto cicatrici",
    body: `
<ul><li><b>Toccato dall'Umbra</b>: critico con 19–20 contro i PG.</li>
<li><b>Cicatrici</b>: un PG infligge danni aggiuntivi pari al numero delle sue cicatrici. Se una cicatrice cancella l'ultima casella Speranza, soccombe all'Umbra.</li>
<li><b>Oscurità in Agguato</b> (d12 a ogni riposo lontano da una Sacra Pira): 1–2 un avversario inizia il conflitto; 3–5 qualcosa li segue, +2 Paure; 6–9 +1 Paura; 10–11 niente; 12 presagio di speranza, +1 Speranza a ogni PG. La tabella è nel Bestiario → Tabelle.</li>
<li><b>Veglia</b> (mossa da interludio): chi veglia tira il Dado Speranza e può sostituire il tiro dell'Oscurità in Agguato; tra più vegliatori si tiene il più alto.</li>
<li><b>Piaga dell'Anima</b>: se muore un umanoide, spendete 1 Paura per rialzarlo come Zombi Traballante, oppure 2 per uno Zombi Corpulento.</li>
<li><b>Ramo Benedetto</b>: acceso, dà 3 Speranze a ogni Resistente presente e tiene lontani tutti i mostri tranne i più potenti, finché lo si alimenta ogni giorno.</li></ul>` },
];
