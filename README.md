# Little Sister Reservation System

A lightweight reservation system for Little Sister — a private guest house ADU in Athens, Georgia. Intended for use by friends, family, and trusted referrals (e.g. from church). There is no public self-signup; guests request stays and an admin approves or denies them.

## Technology Stack

- **Frontend:** Vanilla JS, HTML, CSS (no build step)
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (Heroku Postgres or compatible)
- **Email:** Mailjet
- **Hosting:** Heroku (or any Node-compatible host)

---

## Guest Workflow

1. Guest visits the homepage and browses the availability calendar. Greyed dates are already reserved or blocked.
2. Guest selects a check-in and check-out date range, enters their email, and optionally describes their visit.
3. A magic sign-in link is emailed to them. They click it to authenticate and their reservation request is submitted as **pending**.
4. Guest can also sign in without making a new reservation using the "Returning Guest" form — this creates an account if one doesn't exist yet.
5. Once signed in, guests can view their reservation status and update their profile (first name, last name).
6. When the admin acts on their request, the guest receives an email notification.

---

## Admin Workflow

Admins are identified by email address (configured via `ADMIN_EMAILS`). They sign in the same way guests do.

### Managing Reservations

Admins see all reservations in a table at `/admin.html`, filterable by status. For each pending or approved reservation, admins can:

- **Approve** — confirms the reservation and sends the guest a confirmation email with property details
- **Deny** — rejects the request and notifies the guest
- **Cancel** — cancels an approved reservation and notifies the guest
- **Blocked entries** can be removed by clicking "Remove Block" (sets them to cancelled, no email sent)

### Blocking Time

Admins can reserve date ranges for personal use, maintenance, or any other reason using the "Block Time" form at the top of `/admin.html`. Blocked dates immediately appear as unavailable on the guest calendar. Blocks can be removed from the reservations table.

---

## Reservation Statuses

| Status | Description |
|--------|-------------|
| `pending` | Guest submitted a request; awaiting admin review |
| `approved` | Admin confirmed the stay |
| `denied` | Admin rejected the request |
| `cancelled` | Reservation was cancelled after approval |
| `expired` | Request was never acted on and the dates have passed |
| `complete` | Approved stay whose end date has passed |
| `blocked` | Admin-created time block; not tied to a guest request |

Expired and complete statuses are set automatically by a background scheduler that runs hourly.

---

## Passwordless Magic Link Authentication

### How It Works

1. User submits their email. If no account exists, one is created automatically — there is no separate registration step.
2. A cryptographically random token is generated and stored with a **15-minute expiry**. A link containing that token is emailed to the user.
3. When the user clicks the link, the server validates the token, marks it as used, and creates a **session token** in a single atomic transaction. This makes the link single-use.
4. The session token is set as an `httpOnly`, `secure`, `SameSite=Lax` cookie with a **7-day lifetime**.

### Token Summary

| Token | Lifetime | Ends when |
|-------|----------|-----------|
| Magic link (email) | 15 minutes | Used (single-use) or expired |
| Session (cookie) | 7 days | Logout, expiry, or invalid lookup |

### Per-Request Auth

On every authenticated request, middleware reads the session cookie, looks it up in the database (joined to the user row), and checks the expiry. If invalid, the cookie is cleared. Downstream middleware then allows or redirects based on the result.

### Logout

The session record is deleted server-side before the cookie is cleared. There is no window where a stolen token remains valid after logout.

### Token Cleanup

A background job (hourly) removes expired session tokens and auth tokens from the database.

---

## Email Notifications

All email is sent via Mailjet. Guests receive emails for the following events:

| Event | Subject |
|-------|---------|
| Reservation request / sign-in | *Your Little Sister sign-in link* |
| Reservation approved | *Your Little Sister stay is confirmed!* |
| Reservation denied | *About your Little Sister reservation request* |
| Reservation cancelled | *Your Little Sister reservation has been cancelled* |

The approval email includes property address, check-in/out times, and host contact info (configured via environment variables — see below).

> **Spam notice:** Emails include a note asking guests to check their Spam folder, since the system sends from a small/new domain.
>
> **Dev tip:** If email fails to send (e.g. Mailjet not configured), the magic link is printed to the server console as `[DEV] Magic link (email failed): ...`.

---

## Environment Variables

Create a `.env` file in the project root. All variables are required unless marked optional.

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `MAILJET_API_KEY` | Mailjet API key |
| `MAILJET_SECRET_KEY` | Mailjet secret key |
| `MAILJET_FROM_EMAIL` | Sender email address (must be verified in Mailjet) |
| `BASE_URL` | Full URL of the app, e.g. `https://yourdomain.com` — **must include `http://` or `https://`** |
| `ADMIN_EMAILS` | Comma-separated list of admin email addresses, e.g. `host@example.com,cohost@example.com` |

### Optional — Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the server listens on |
| `NODE_ENV` | — | Set to `production` to enable secure cookies |
| `MAILJET_FROM_NAME` | — | Display name for outgoing emails |

### Optional — Property Details (used in approval emails)

These appear in the confirmation email sent when a reservation is approved. Leave blank to use placeholder text until ready.

| Variable | Placeholder if unset | Description |
|----------|----------------------|-------------|
| `PROPERTY_ADDRESS` | `[Address TBD]` | Physical address of the guest house |
| `PROPERTY_CHECKIN_TIME` | `[Check-in time TBD]` | e.g. `3:00 PM` |
| `PROPERTY_CHECKOUT_TIME` | `[Check-out time TBD]` | e.g. `11:00 AM` |
| `PROPERTY_CONTACT_NAME` | `[Host name TBD]` | Host name shown in approval email |
| `PROPERTY_CONTACT_PHONE` | `[Phone TBD]` | Host phone number shown in approval email |

---

## Getting Started

### Prerequisites

- Node.js v14 or higher
- A PostgreSQL database
- A Mailjet account with a verified sender domain

### Installation

```bash
npm install
```

Create a `.env` file with the required variables (see above).

### Running

Development (auto-reload via nodemon):
```bash
npm run dev
```

Production:
```bash
npm start
```

The database schema is applied automatically on startup. It is safe to restart — all schema statements are idempotent.

---

## Project Structure

```
little-sister-reservation/
├── server.js                    # Entry point: Express app, middleware, startup
├── package.json
├── .env                         # Local environment variables (not committed)
├── public/                      # Static frontend
│   ├── index.html               # Homepage: calendar + reservation form + sign-in
│   ├── dashboard.html           # Guest dashboard: profile + reservation status
│   ├── admin.html               # Admin panel: block time + manage reservations
│   ├── verify.html              # Magic link landing page
│   └── assets/
│       ├── css/
│       │   ├── main.css         # Base theme (HTML5 UP Phantom)
│       │   └── app.css          # App-specific styles
│       └── js/
│           ├── api.js           # Fetch wrapper (API.get/post/put)
│           ├── calendar.js      # Interactive availability calendar
│           ├── home.js          # Homepage logic
│           ├── dashboard.js     # Guest dashboard logic
│           ├── admin.js         # Admin panel logic
│           └── verify.js        # Token verification logic
└── src/
    ├── db/
    │   ├── index.js             # PostgreSQL pool + schema init
    │   └── schema.sql           # Table and index definitions
    ├── middleware/
    │   └── auth.js              # requireAuth / requireAdmin middleware
    ├── routes/
    │   ├── auth.js              # /api/auth/* — magic links, verify, signin, logout
    │   ├── reservations.js      # /api/reservations/* — calendar, user reservations
    │   ├── profile.js           # /api/profile — get/update current user
    │   └── admin.js             # /api/admin/* — reservation management, time blocks
    └── services/
        ├── email.js             # Mailjet integration: magic links + status emails
        └── scheduler.js         # Hourly job: expire pending, complete approved
```

---

## License

ISC
