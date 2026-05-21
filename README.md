# Taula Systems — Panell de gestió

Llibreta digital de reserves per a restaurants familiars. Substitutiu del paper.

**Stack:** Next.js 16 · TypeScript · Tailwind 4 · Drizzle ORM · SQLite (local) / Turso (producció)

---

## Iniciar en local

```bash
pnpm install --ignore-scripts
pnpm dev
```

Obre `http://localhost:3000` (o el port lliure que indiqui el terminal).

---

## Primer ús — configuració i dades

### 1. Crear les taules (primera vegada)

```bash
pnpm db:migrate
```

Crea `taula.db` al directori arrel amb les 3 taules: `restaurants`, `reservations`, `closures`.

### 2. Poblar amb dades de demo

```bash
pnpm seed
```

Insereix:
- 7 reserves avui (Cristina Ruiz, Carme Blasco, Oriol Mas, etc.) amb estats mixtos
- 22 reserves als propers 7 dies per veure dots al mini-calendari
- 1 restaurant de demo si no n'hi havia cap

Torna a executar `pnpm seed` per reiniciar les dades en qualsevol moment (esborra i recrea).

### 3. Accedir al panell

| Ruta | Descripció |
|---|---|
| `/avui` | Reserves del dia (pantalla principal) |
| `/avui?data=2026-05-16` | Reserves d'un dia concret |
| `/config` | Configuració del restaurant, horari, capacitat, dies tancats |
| `/agenda` | Pròximament — Setmana 4 |

---

## Variables d'entorn

Copia `.env.local` i omple els valors reals per a producció:

```bash
DATABASE_URL=file:./taula.db        # local SQLite
DATABASE_AUTH_TOKEN=                 # buit en local, requerit a Turso
BETTER_AUTH_SECRET=canvia-en-prod
BETTER_AUTH_URL=http://localhost:3000
RESEND_API_KEY=                      # per a recordatoris per email
```

---

## Comandos útils

```bash
pnpm dev              # servidor de dev
pnpm build            # build de producció
pnpm seed             # poblar DB amb dades de demo
pnpm db:migrate       # aplicar migracions pendents
pnpm db:generate      # generar nova migració des del schema
pnpm db:push          # push directe (sense migració, útil en dev)
pnpm db:studio        # Drizzle Studio — GUI de la BD al navegador
```

---

## Estructura del projecte

```
src/
├── app/
│   ├── (auth)/login/        → Magic link (pròximament)
│   ├── (panel)/             → Panell amb nav lateral
│   │   ├── layout.tsx       → Sidebar desktop + bottom nav mòbil
│   │   ├── avui/            → ✅ Llista del dia
│   │   ├── agenda/          → Pròximament
│   │   ├── reserva/nova/    → Pròximament
│   │   ├── reserva/[id]/    → Pròximament
│   │   └── config/          → ✅ Configuració
│   ├── actions/             → Server Actions
│   │   ├── config.ts        → CRUD restaurant + closures
│   │   └── reservations.ts  → CRUD reserves + canvi estat
│   └── r/[slug]/            → Widget públic (pròximament)
├── components/
│   ├── ui/Toast.tsx         → Toast notifications
│   ├── ReservationCard.tsx  → Targeta de reserva amb botons d'estat
│   └── MiniCalendar.tsx     → Mini-calendari 2 mesos per a sidebar
├── db/
│   ├── schema.ts            → 3 taules Drizzle
│   └── index.ts             → Client libsql + Drizzle
└── scripts/
    └── seed.ts              → Dades de demo
```

---

## Roadmap

| Setmana | Estat | Lliurable |
|---|---|---|
| 1 | ✅ | Setup + schema + `/config` |
| 2 | ✅ | `/avui` amb reserves i canvi d'estat |
| 3 | 🔜 | `/reserva/nova` + `/reserva/:id` |
| 4 | 🔜 | `/agenda` + widget `/r/:slug` |
| 5 | 🔜 | Recordatoris email + beta real |
