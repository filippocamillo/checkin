# Check-in

Gestione del check-in per appartamenti in affitto turistico: prenotazioni, dati degli ospiti letti dalla foto del documento, contratto, file per Alloggiati Web. Supporta più appartamenti.

- **Area host** (`/host`): pensata per iPad e desktop, funziona anche da telefono.
- **Link ospite** (`/g/<token>`): solo mobile, italiano e inglese, nessun account.

Stack: Next.js 16, Supabase (Postgres, autenticazione), API Claude per leggere i documenti.

## Cosa fa questa prima fase

| Funzione | Stato |
|---|---|
| Più appartamenti, ciascuno con la propria configurazione | ✓ |
| Import prenotazioni dai calendari iCal di Airbnb e Booking (automatico e su richiesta) | ✓ |
| Prenotazioni inserite a mano | ✓ |
| Link per l'ospite: foto del documento → dati precompilati → conferma | ✓ |
| Lettura MRZ con verifica delle cifre di controllo, più lettura visiva per gli altri campi | ✓ |
| Contratto compilato in automatico, accettato dall'ospite, PDF | ✓ |
| File Alloggiati Web (tracciato a 168 caratteri) con controllo dei dati mancanti | ✓ |
| Riconoscimento degli ospiti in videochiamata all'arrivo, registrato per ospite | ✓ |
| Codice Nuki Keypad creato solo dopo il riconoscimento, valido fino al check-out | ✓ |
| Promemoria culla per prenotazioni con neonati | base |
| Invio diretto ad Alloggiati Web, ISTAT, lettura email di conferma | fase 2 |
| Promemoria configurabili, tassa di soggiorno trimestrale | fase 3 |

Le foto dei documenti non vengono mai salvate: l'immagine passa in memoria al servizio di lettura e viene scartata.

## Riconoscimento all'arrivo

Dal novembre 2025 (Consiglio di Stato) l'host deve riconoscere gli ospiti confrontando volto e documento, anche in videochiamata.

1. Finito il check-in, l'ospite trova nel suo link il pulsante "Sono arrivato". In alternativa sceglie un orario per la videochiamata o chiede il riconoscimento di persona.
2. Nell'area host compare l'avviso (con suono e, se attivate, notifiche del browser) e si apre la videochiamata. L'ospite può passare alla fotocamera posteriore per mostrare il documento; accanto l'host vede i dati già inseriti.
3. Per ogni ospite l'host preme "Riconosciuto". Si registrano chi, quando, come e il documento; il video non viene registrato. Se l'ospite cambia il numero di documento, il riconoscimento decade.
4. Quando tutti gli ospiti sono riconosciuti, l'ospite vede le istruzioni d'ingresso e, se l'appartamento ha Nuki, il codice del Keypad creato in quel momento.

Dalla pagina della prenotazione si può anche segnare "Riconosciuto di persona" o "in videochiamata" fatta con un'altra app.

La videochiamata è diretta tra i due dispositivi (WebRTC); offerta e risposta passano dal database. Su alcune reti mobili serve un server TURN: impostare `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` (es. Cloudflare Calls o Metered, entrambi con piano gratuito).

**Nuki**: nella pagina dell'appartamento inserisci l'ID della serratura e un token API di Nuki Web (web.nuki.io → API). Il token si salva in una tabella che legge solo il server.

## Prova rapida (Supabase + Vercel, piani gratuiti)

**Supabase**
1. Su supabase.com crea un progetto in regione *Central EU (Frankfurt)*.
2. *SQL Editor* → incolla ed esegui, in ordine, i file in `supabase/migrations/`.
3. *Authentication → Users → Add user → Create new user* con la tua email (password a piacere, *Auto Confirm User* attivo): è l'unico utente che potrà entrare, sempre con un link via email.
4. *Authentication → URL Configuration*: in *Redirect URLs* aggiungi `https://*.vercel.app/**`.
5. *Project Settings → API*: copia Project URL, chiave `anon` e chiave `service_role`.

**Anthropic**
6. Su console.anthropic.com crea una API key (serve un po' di credito: ogni lettura documento costa pochi centesimi).

**Vercel**
7. Su vercel.com → *Add New → Project* → importa `filippocamillo/checkin`.
8. In *Environment Variables* inserisci `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` e un `CRON_SECRET` qualsiasi, per *Production* e *Preview*.
9. Finché la prima fase non è unita a `main`, apri il deploy del branch `feat/prima-fase-app` (scheda *Deployments*); in alternativa imposta quel branch come *Production Branch* in *Settings → Git*.
10. Apri l'indirizzo del deploy, entra con il link che ricevi via email, crea il tuo appartamento e una prenotazione di prova, poi apri il link ospite dal telefono.

Senza le tabelle Alloggiati (sotto) tutto funziona, ma il file per la Questura segnalerà i codici mancanti.

## Avvio in locale

1. Crea un progetto Supabase in regione UE ed esegui in ordine i file in `supabase/migrations/` (SQL editor o `supabase db push`).
2. In Supabase → Authentication crea il tuo utente host (l'accesso è solo su invito, con link via email) e imposta come Site URL l'indirizzo dell'app.
3. Copia `.env.example` in `.env.local` e compila le chiavi.
4. `npm install && npm run dev`, poi apri `http://localhost:3000`.

### Tabelle Alloggiati Web

Per generare il file servono i codici ufficiali di comuni e stati. Scarica i CSV dal portale Alloggiati Web (Supporto → Tabelle) e importali:

```bash
node --env-file=.env.local scripts/import-alloggiati-tables.mjs comune Comuni.csv
node --env-file=.env.local scripts/import-alloggiati-tables.mjs stato Stati.csv
```

La prima volta che un ospite ha una cittadinanza nuova, la pagina della prenotazione ti chiede di abbinare il paese al codice Alloggiati; l'abbinamento resta salvato.

### Deploy

Il progetto è pronto per Vercel (regione Francoforte, `vercel.json`). Il cron chiama `/api/cron/ical` una volta al giorno, il massimo consentito dal piano gratuito; con un piano a pagamento si può portare a ogni ora (`0 * * * *`). Vercel invia da solo l'header `Authorization: Bearer $CRON_SECRET`.

## Sviluppo

```bash
npm run lint
npm run typecheck
npm test
```
