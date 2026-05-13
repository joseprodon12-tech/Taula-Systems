# Taula Systems

Sistema de reserves per a restaurants independents espanyols. Formulari multi-pas mobile-first amb confirmació per WhatsApp.

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Supabase (PostgreSQL) — base de dades
- Twilio WhatsApp Business Sandbox — missatges de confirmació

## Iniciar el servidor

```bash
npm run dev
```

URL de prova: `http://localhost:3000/book/el-sortidor`

## Variables d'entorn

Fitxer `.env.local` (no comitejat):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

## Configuració inicial

**1. Supabase** — Crea un projecte i executa `supabase/schema.sql` al SQL Editor. Afegeix les claus al `.env.local`.

**2. Twilio WhatsApp Sandbox** — Activa el Sandbox a la consola Twilio i envia `join <paraula>` al +1 415 523 8886 des del teu mòbil per unir-te. Afegeix les credencials al `.env.local`.

## Estructura del projecte

```
app/
  page.tsx                        → redirigeix a /book/el-sortidor
  book/[restaurantSlug]/page.tsx  → pàgina de reserves (dynamic)
  api/
    reservations/route.ts         → POST reserva → Supabase + WhatsApp
    group-inquiry/route.ts        → POST consulta grup → Supabase + WhatsApp

components/
  BookingForm.tsx         → orquestrador del formulari multi-pas
  ProgressBar.tsx         → barra de progrés dels 3 passos
  Step1DateTime.tsx       → calendari + selector hora + persones
  CalendarPicker.tsx      → calendari visual, bloqueja dies tancats
  Step2Contact.tsx        → nom + telèfon
  Step3Extras.tsx         → al·lèrgies (checkboxes) + ocasió especial
  GroupInquiryForm.tsx    → flux alternatiu per grups >= group_threshold
  ConfirmationScreen.tsx  → pantalla final amb resum de la reserva

lib/
  supabase.ts   → client Supabase + tipus TypeScript (Restaurant, Reservation)
  schedule.ts   → càlcul de dies oberts i franges horàries de 30 min

supabase/
  schema.sql    → SQL complet: taules + restaurant de prova "El Sortidor"
```

## Base de dades

Taules: `restaurants` i `reservations`.

El camp `schedule` de `restaurants` és JSONB amb aquest format:
```json
{
  "thursday": { "lunch": "13:00-17:00", "dinner": "20:00-22:30" },
  "friday":   { "lunch": "13:00-17:00", "dinner": "20:00-22:30" },
  "saturday": { "lunch": "13:00-17:00", "dinner": "20:00-22:30" },
  "sunday":   { "lunch": "13:00-17:00" },
  "monday": null,
  "tuesday": null,
  "wednesday": null
}
```

El camp `group_threshold` (defecte: 8) determina quan s'activa el flux alternatiu per grups grans.

## Flux de la reserva

1. **Pas 1** — Data (calendari visual), hora (botons), persones (botons 1–8+)
2. **Pas 2** — Nom + telèfon
3. **Pas 3** — Al·lèrgies (checkboxes) + ocasió especial (opcional) → confirmació

Si `party_size >= group_threshold`, el pas 2 es substitueix pel `GroupInquiryForm` i s'envia a `/api/group-inquiry` en lloc de `/api/reservations`.

## Disseny

- Mobile-first, columna única
- Colors: blanc `#FFFFFF` i blau `#2563EB`
- Botons mínim 44px d'alçada (táctil)
- Textos d'error en català
- Classes utilitàries globals: `.btn-primary`, `.btn-secondary`, `.btn-option`, `.btn-option-selected`, `.input-field`
