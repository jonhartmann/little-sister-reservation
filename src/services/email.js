'use strict';
const Mailjet = require('node-mailjet');

function getClient() {
  return Mailjet.apiConnect(
    process.env.MAILJET_API_KEY,
    process.env.MAILJET_SECRET_KEY,
  );
}

async function sendMagicLink(email, token) {
  const link = `${process.env.BASE_URL}/verify.html?token=${token}`;

  await getClient().post('send', { version: 'v3.1' }).request({
    Messages: [{
      From: {
        Email: process.env.MAILJET_FROM_EMAIL,
        Name: process.env.MAILJET_FROM_NAME,
      },
      To: [{ Email: email }],
      Subject: 'Your Little Sister sign-in link',
      TextPart: `Click this link to sign in (expires in 15 minutes):\n\n${link}\n\nIf you don't see this email in your inbox, please check your Spam or Junk folder — we're a small sender and occasionally get filtered.\n\nIf you did not request this, you can ignore this email.`,
      HTMLPart: `
        <h2>Sign in to Little Sister</h2>
        <p>Click the button below to sign in. This link expires in <strong>15 minutes</strong> and can only be used once.</p>
        <p><a href="${link}" style="background:#4a90e2;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;">Sign In</a></p>
        <p>Or copy and paste this URL:<br><code>${link}</code></p>
        <p style="font-size:0.9em;color:#888;">If you don't see future emails from us in your inbox, please check your Spam or Junk folder — we're a small sender and occasionally get filtered.</p>
        <p><em>If you did not request this, you can ignore this email.</em></p>
      `,
    }],
  });
}

function fmtDate(dateStr) {
  const [year, month, day] = String(dateStr).slice(0, 10).split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function buildStatusEmail(reservation, adminNote) {
  const start = fmtDate(reservation.start_date);
  const end   = fmtDate(reservation.end_date);
  const dashboardUrl = process.env.BASE_URL;

  const addr    = process.env.PROPERTY_ADDRESS     || '[Address TBD]';
  const checkIn = process.env.PROPERTY_CHECKIN_TIME  || '[Check-in time TBD]';
  const checkOut= process.env.PROPERTY_CHECKOUT_TIME || '[Check-out time TBD]';
  const contact = process.env.PROPERTY_CONTACT_NAME  || '[Host name TBD]';
  const phone   = process.env.PROPERTY_CONTACT_PHONE || '[Phone TBD]';

  const noteText = adminNote ? `Note from host: ${adminNote}\n\n` : '';
  const noteHtml = adminNote ? `<p><strong>Note from host:</strong> ${adminNote}</p>` : '';

  if (reservation.status === 'approved') {
    return {
      subject: 'Your Little Sister stay is confirmed!',
      textPart: [
        `Great news — your stay at Little Sister is confirmed!`,
        `Dates: ${start} → ${end}`,
        `Address: ${addr}`,
        `Check-in: ${checkIn}\nCheck-out: ${checkOut}`,
        noteText + `Questions? Reach out any time:\n${contact}\n${phone}`,
        `Sign in to view your reservation: ${dashboardUrl}`,
      ].join('\n\n'),
      htmlPart: `
        <h2>Your stay is confirmed!</h2>
        <p>Great news — we're so happy to have you at Little Sister.</p>
        <table style="border-collapse:collapse;width:100%;margin:1.5em 0;">
          <tr>
            <td style="padding:0.5em 1em 0.5em 0;color:#9fa6a8;white-space:nowrap;vertical-align:top;">Dates</td>
            <td style="padding:0.5em 0;font-weight:700;">${start} &rarr; ${end}</td>
          </tr>
          <tr>
            <td style="padding:0.5em 1em 0.5em 0;color:#9fa6a8;white-space:nowrap;vertical-align:top;">Address</td>
            <td style="padding:0.5em 0;">${addr}</td>
          </tr>
          <tr>
            <td style="padding:0.5em 1em 0.5em 0;color:#9fa6a8;white-space:nowrap;vertical-align:top;">Check-in</td>
            <td style="padding:0.5em 0;">${checkIn}</td>
          </tr>
          <tr>
            <td style="padding:0.5em 1em 0.5em 0;color:#9fa6a8;white-space:nowrap;vertical-align:top;">Check-out</td>
            <td style="padding:0.5em 0;">${checkOut}</td>
          </tr>
        </table>
        ${noteHtml}
        <p>Questions? Reach out any time — <strong>${contact}</strong> at ${phone}.</p>
        <p><a href="${dashboardUrl}" style="background:#4a90e2;color:white;padding:10px 22px;text-decoration:none;border-radius:4px;">View Reservation</a></p>
      `,
    };
  }

  if (reservation.status === 'denied') {
    return {
      subject: 'About your Little Sister reservation request',
      textPart: [
        `Thank you for your interest in Little Sister.`,
        `Unfortunately, we're unable to accommodate your request for ${start} – ${end}.`,
        noteText.trimEnd() || '',
        `We hope you'll consider reaching out for future dates.`,
      ].filter(Boolean).join('\n\n'),
      htmlPart: `
        <h2>About your reservation request</h2>
        <p>Thank you for your interest in Little Sister.</p>
        <p>Unfortunately, we're unable to accommodate your request for <strong>${start} – ${end}</strong>.</p>
        ${noteHtml}
        <p>We hope you'll consider reaching out for future dates.</p>
      `,
    };
  }

  if (reservation.status === 'cancelled') {
    return {
      subject: 'Your Little Sister reservation has been cancelled',
      textPart: [
        `Your reservation for ${start} – ${end} has been cancelled.`,
        noteText.trimEnd() || '',
        `If you have questions, feel free to get in touch.`,
      ].filter(Boolean).join('\n\n'),
      htmlPart: `
        <h2>Reservation cancelled</h2>
        <p>Your reservation for <strong>${start} – ${end}</strong> has been cancelled.</p>
        ${noteHtml}
        <p>If you have questions, feel free to get in touch.</p>
      `,
    };
  }

  // Fallback for any other status
  return {
    subject: `Little Sister reservation update`,
    textPart: `Your reservation status has been updated to: ${reservation.status}\n\nDates: ${start} – ${end}\n\n${noteText}${dashboardUrl}`,
    htmlPart: `<p>Your reservation status has been updated to <strong>${reservation.status}</strong>.</p><p>Dates: ${start} – ${end}</p>${noteHtml}<p><a href="${dashboardUrl}">View reservation</a></p>`,
  };
}

async function sendStatusUpdate(email, reservation, adminNote) {
  const { subject, textPart, htmlPart } = buildStatusEmail(reservation, adminNote);

  await getClient().post('send', { version: 'v3.1' }).request({
    Messages: [{
      From: {
        Email: process.env.MAILJET_FROM_EMAIL,
        Name: process.env.MAILJET_FROM_NAME,
      },
      To: [{ Email: email }],
      Subject: subject,
      TextPart: textPart,
      HTMLPart: htmlPart,
    }],
  });
}

async function sendCheckinReminder(email, firstName, reservation) {
  const start = fmtDate(reservation.start_date);
  const end   = fmtDate(reservation.end_date);
  const days  = parseInt(process.env.CHECKIN_REMINDER_DAYS, 10) || 3;

  const addr    = process.env.PROPERTY_ADDRESS      || '[Address TBD]';
  const checkIn = process.env.PROPERTY_CHECKIN_TIME  || '[Check-in time TBD]';
  const checkOut= process.env.PROPERTY_CHECKOUT_TIME || '[Check-out time TBD]';
  const contact = process.env.PROPERTY_CONTACT_NAME  || '[Host name TBD]';
  const phone   = process.env.PROPERTY_CONTACT_PHONE || '[Phone TBD]';
  const dashboardUrl = process.env.BASE_URL;

  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';

  await getClient().post('send', { version: 'v3.1' }).request({
    Messages: [{
      From: {
        Email: process.env.MAILJET_FROM_EMAIL,
        Name:  process.env.MAILJET_FROM_NAME,
      },
      To: [{ Email: email }],
      Subject: `Your Little Sister stay starts in ${days} day${days === 1 ? '' : 's'}!`,
      TextPart: [
        `${greeting}`,
        `Just a reminder that your stay at Little Sister begins in ${days} day${days === 1 ? '' : 's'}!`,
        `Dates: ${start} → ${end}`,
        `Address: ${addr}`,
        `Check-in: ${checkIn}\nCheck-out: ${checkOut}`,
        `Questions? Contact us:\n${contact}\n${phone}`,
        `View your reservation: ${dashboardUrl}`,
      ].join('\n\n'),
      HTMLPart: `
        <h2>Your stay is coming up!</h2>
        <p>${greeting}</p>
        <p>Just a reminder that your stay at Little Sister begins in <strong>${days} day${days === 1 ? '' : 's'}</strong>. We can't wait to have you!</p>
        <table style="border-collapse:collapse;width:100%;margin:1.5em 0;">
          <tr>
            <td style="padding:0.4em 1em 0.4em 0;color:#9fa6a8;white-space:nowrap;vertical-align:top;">Dates</td>
            <td style="padding:0.4em 0;font-weight:700;">${start} &rarr; ${end}</td>
          </tr>
          <tr>
            <td style="padding:0.4em 1em 0.4em 0;color:#9fa6a8;white-space:nowrap;vertical-align:top;">Address</td>
            <td style="padding:0.4em 0;">${addr}</td>
          </tr>
          <tr>
            <td style="padding:0.4em 1em 0.4em 0;color:#9fa6a8;white-space:nowrap;vertical-align:top;">Check-in</td>
            <td style="padding:0.4em 0;">${checkIn}</td>
          </tr>
          <tr>
            <td style="padding:0.4em 1em 0.4em 0;color:#9fa6a8;white-space:nowrap;vertical-align:top;">Check-out</td>
            <td style="padding:0.4em 0;">${checkOut}</td>
          </tr>
        </table>
        <p>Questions? Reach out any time — <strong>${contact}</strong> at ${phone}.</p>
        <p><a href="${dashboardUrl}" style="background:#4a90e2;color:white;padding:10px 22px;text-decoration:none;border-radius:4px;">View Reservation</a></p>
      `,
    }],
  });
}

async function sendNewReservationAlert(reservation, guest) {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  if (!adminEmails.length) return;

  const start = fmtDate(reservation.start_date);
  const end   = fmtDate(reservation.end_date);
  const guestName = [guest.first_name, guest.last_name].filter(Boolean).join(' ') || guest.email;
  const adminUrl  = `${process.env.BASE_URL}/admin.html`;

  const descText = reservation.description ? `\n\nGuest note: ${reservation.description}` : '';
  const descHtml = reservation.description
    ? `<p style="color:#555;font-style:italic;">${reservation.description}</p>`
    : '';

  await getClient().post('send', { version: 'v3.1' }).request({
    Messages: [{
      From: {
        Email: process.env.MAILJET_FROM_EMAIL,
        Name:  process.env.MAILJET_FROM_NAME,
      },
      To: adminEmails.map(e => ({ Email: e })),
      Subject: `New reservation request — ${start} → ${end}`,
      TextPart: `A new reservation request has been submitted.\n\nGuest: ${guestName} (${guest.email})\nDates: ${start} → ${end}${descText}\n\nReview and respond: ${adminUrl}`,
      HTMLPart: `
        <h2>New Reservation Request</h2>
        <table style="border-collapse:collapse;width:100%;margin:1em 0;">
          <tr>
            <td style="padding:0.4em 1em 0.4em 0;color:#9fa6a8;white-space:nowrap;">Guest</td>
            <td style="padding:0.4em 0;font-weight:700;">${guestName}</td>
          </tr>
          <tr>
            <td style="padding:0.4em 1em 0.4em 0;color:#9fa6a8;white-space:nowrap;">Email</td>
            <td style="padding:0.4em 0;">${guest.email}</td>
          </tr>
          <tr>
            <td style="padding:0.4em 1em 0.4em 0;color:#9fa6a8;white-space:nowrap;">Dates</td>
            <td style="padding:0.4em 0;font-weight:700;">${start} &rarr; ${end}</td>
          </tr>
        </table>
        ${descHtml}
        <p><a href="${adminUrl}" style="background:#4a90e2;color:white;padding:10px 22px;text-decoration:none;border-radius:4px;">Review in Admin</a></p>
      `,
    }],
  });
}

module.exports = { sendMagicLink, sendStatusUpdate, sendCheckinReminder, sendNewReservationAlert };
