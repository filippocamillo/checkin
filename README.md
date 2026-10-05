# Check-in

Gestione del check-in per appartamenti in affitto turistico: prenotazioni, dati degli ospiti letti dalla foto del documento, contratto, file per Alloggiati Web. Supporta più appartamenti.

- **Area host** (`/host`): pensata per iPad e desktop, funziona anche da telefono.
- **Link ospite** (`/g/<token>`): solo mobile, italiano e inglese, nessun account.

Stack: Next.js 16, Supabase (Postgres, autenticazione), API Claude per leggere i documenti.

## Cosa fa questa prima fase

| Funzione | Stato |
|---|---|
| Più appartamenti, ciascuno con la propria configurazione | ✓ |
| Import prenotazioni dai calendari iCal di Airbnb e Booking (ogni ora) | ✓ |
| Prenotazioni inserite a mano | ✓ |
| Link per l'ospite: foto del documento → dati precompilati → conferma | ✓ |
| Lettura MRZ con verifica delle cifre di controllo, più lettura visiva per gli altri campi | ✓ |
| Contratto compilato in automatico, accettato dall'ospite, PDF | ✓ |
| File Alloggiati Web (tracciato a 168 caratteri) con controllo dei dati mancanti | ✓ |
| Promemoria culla per prenotazioni con neonati | base |
| Invio diretto ad Alloggiati Web, ISTAT, lettura email di conferma | fase 2 |
| Codici Nuki, promemoria configurabili, tassa di soggiorno trimestrale | fase 3 |

Le foto dei documenti non vengono mai salvate: l'immagine passa in memoria al servizio di lettura e viene scartata.

## Avvio

1. Crea un progetto Supabase in regione UE ed esegui `supabase/migrations/20261005000000_init.sql` (SQL editor o `supabase db push`).
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

Il progetto è pronto per Vercel (regione Francoforte, `vercel.json`): il cron chiama `/api/cron/ical` ogni ora con l'header `Authorization: Bearer $CRON_SECRET`.

## Sviluppo

```bash
npm run lint
npm run typecheck
npm test
```
