# Little Sister Reservation System

A guest house reservation system for managing bookings at Little Sister guest house.
* Little Sister is an ADU on my property in Athens Georgia.
* Our intended audience is friends, family, and relatively known and trusted sources such as referrals from our Church.
* I can add additional description and images in HTML at a later date.
* I will be providing a pre-created HTML template to establish basic styling.
* The system needs to support the following workflow:
   * The site should show an explorable calendar that shows what dates have already been reserved (and approved).
   * Users should be able to select a reservation range, provide thier email address (required) and a place to tell us about their visit.
   * The user should get an email containing a one-time token to sign in and a call to action to sign in and complete their profile.
   * Signed in users should be determined to either be an admin (by email address) or a regular user.
   * Regular signed-in users can update their profile, including providing first and last names.
   * Regular signed-in users can view their reservation requests and their status.
   * Admin users can view the calendar including all requests.
   * Admin users can see a list of requests, and set a status on those requests (approved, denied, cancelled), and an optional note for the status change.
   * When an Admin user changes the status of  a reservation, the system should send them an email with the status and the note.
   * When a requested reservation has past its end date without have its status updated, it should be marked as expied.
   * When a requested and approved reservation's end date is past, it should be maked as "complete" unless cancelled.
   * Users can sign in from the landing page (requires email, sends the link for sign in)
* The system should use the following technology constraints:
   * Vanilla JS on the client (for now)
   * Heroku application hosting
   * Node JS + Express
   * MailJet for email

## Passwordless Magic Link Authentication
The Two-Token Model
Two separate token types serve distinct purposes:

Email token — short-lived (15 minutes), single-use, sent in a link via email. Its only job is to prove you have access to the inbox.
Session token — long-lived (7 days), stored in a cookie. Represents an ongoing authenticated session.
Keeping them separate prevents accidentally using a login link as a session credential, and makes it easy to invalidate them independently.

The Login Process
User submits their email. If no account exists, one is created automatically — there's no separate registration step.
A cryptographically random token is generated and stored in the database with a 15-minute expiry. A link containing that token is emailed to the user.
When the user clicks the link, the server looks up the token and checks it hasn't expired. If valid, it atomically deletes the email token and creates a new session token in a single database transaction. This makes the link single-use — a second click finds nothing.
The session token is set as an httpOnly, secure, SameSite=Lax cookie with a 7-day maxAge. The httpOnly flag prevents JavaScript from reading it; secure restricts it to HTTPS in production; SameSite=Lax provides basic CSRF protection.
Per-Request Authentication
On every request, a global middleware reads the cookie, looks up the session token in the database (joining to the user row in the same query), and checks the expiry. If valid, the user object is attached to the request. If invalid or expired, the cookie is cleared. Downstream route middleware then either allows or redirects based on whether a user is present.

Logout
The session token is deleted from the database server-side, then the cookie is cleared. Because validity is checked against the database on every request, deleting the record immediately invalidates the session — there's no window where a stolen token remains usable.

Token Cleanup
Expired session tokens accumulate in the database but are harmless since they're rejected at query time. A background job (hourly interval) deletes them to keep the table from growing unboundedly.

Timeout Summary
Token	Lifetime	What ends it
Email (magic link)	15 minutes	Expiry check at click time, or immediate deletion on use
Session (cookie)	7 days	Logout (server-side delete), expiry, or cookie cleared on bad lookup


## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

```bash
npm install
```

### Running the Application

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Project Structure

```
little-sister-reservation/
├── server.js           # Main application entry point
├── package.json        # Project dependencies
├── .gitignore          # Git ignore rules
├── README.md           # This file
└── src/                # Source code directory (to be created)
    ├── routes/         # API routes
    ├── models/         # Data models
    ├── controllers/    # Route controllers
    └── middleware/     # Custom middleware
```

## Features

- [ ] User authentication
- [ ] Reservation management
- [ ] Calendar view
- [ ] Booking confirmation
- [ ] Admin dashboard

## License

ISC
