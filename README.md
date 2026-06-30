# Mappa di Varallo Sesia — Form di raccolta contenuti

Form web da condividere via link (anche QR code) con i partecipanti. Ogni invio
carica il file su una cartella di Google Drive e scrive una riga su un Google Sheet
(autore, zona, luogo, testo, tipo file, link al file).

## 1. Crea un Service Account Google (una sola volta)

Questo è l'account "robot" che caricherà i file e scriverà sul foglio al posto tuo,
senza che i partecipanti debbano fare login.

1. Vai su https://console.cloud.google.com e crea un nuovo progetto (es. "mappa-varallo").
2. Nel menu "API e servizi" → "Libreria", abilita:
   - **Google Drive API**
   - **Google Sheets API**
3. Vai su "API e servizi" → "Credenziali" → "Crea credenziali" → "Account di servizio".
4. Dagli un nome (es. `mappa-varallo-bot`), crealo, poi apri l'account di servizio creato.
5. Scheda "Chiavi" → "Aggiungi chiave" → "Crea nuova chiave" → formato **JSON**. Si scarica un file:
   contiene `client_email` e `private_key`, che ti servono dopo.

## 2. Prepara Drive e Sheet

1. Crea su Google Drive la cartella dove vuoi che arrivino i media (es. "Mappa Varallo - Contributi").
   Apri la cartella e copia l'ID dall'URL:
   `https://drive.google.com/drive/folders/QUESTO_È_L_ID`
2. Crea un nuovo Google Sheet (es. "Mappa Varallo - Dati") con queste intestazioni nella riga 1
   del foglio "Foglio1": `Data | Autore | Zona | Luogo | Testo | TipoFile | Link`
   Copia l'ID dall'URL: `https://docs.google.com/spreadsheets/d/QUESTO_È_L_ID/edit`
3. **Importante**: condividi sia la cartella Drive sia lo Sheet con l'email del Service Account
   (quella tipo `mappa-varallo-bot@mappa-varallo.iam.gserviceaccount.com`), dandogli ruolo
   "Editor". Senza questo passaggio il bot non potrà scrivere nulla.

## 3. Deploy su Vercel

1. Carica questa cartella su un repository GitHub (o usa `vercel` da terminale / drag&drop su vercel.com).
2. Su https://vercel.com → "Add New Project" → importa il repository.
3. Prima del deploy (o dopo, in "Settings" → "Environment Variables"), aggiungi:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` → il `client_email` dal file JSON
   - `GOOGLE_PRIVATE_KEY` → il `private_key` dal file JSON (incollalo intero, comprese le righe
     `-----BEGIN PRIVATE KEY-----` ... `-----END PRIVATE KEY-----`)
   - `GOOGLE_DRIVE_FOLDER_ID` → l'ID della cartella copiato sopra
   - `GOOGLE_SHEET_ID` → l'ID del foglio copiato sopra
4. Fai il deploy. Vercel ti darà un link tipo `https://mappa-varallo.vercel.app`.
5. Quel link è ciò che condividi con i partecipanti (puoi generare un QR code da incollare
   per la città, ad esempio con qr-code-generator.com).

## 4. Test prima di condividere

Apri il link da telefono, invia un contributo di prova con foto, e controlla che:
- il file compaia nella cartella Drive
- una nuova riga compaia nello Sheet

## Note

- Il limite di 30 secondi per i video non è imposto tecnicamente dal form (i browser mobile non
  permettono di tagliare video facilmente lato client); è una linea guida da comunicare ai
  partecipanti. Se vuoi, posso aggiungere un limite di dimensione file (es. rifiutare file > 80MB).
- I file caricati vengono resi visualizzabili con link da chiunque abbia il link (necessario per
  poterli poi proiettare/recuperare facilmente per il progetto artistico). Se preferisci che restino
  privati e accessibili solo a te, dimmelo: tolgo quella riga di codice.
- Per il muro proiettato, puoi poi costruire una pagina che legge i dati dallo Sheet (via Google
  Sheets API o pubblicandolo come CSV) e mostra una mappa interattiva con i contenuti geolocalizzati:
  query questo se ti interessa, è un secondo step.
