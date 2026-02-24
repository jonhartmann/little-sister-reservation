'use strict';
const Mailjet = require('node-mailjet');

const mailjet = Mailjet.apiConnect(
  process.env.MAILJET_API_KEY,
  process.env.MAILJET_SECRET_KEY,
);

async function sendMagicLink(email, token) {
  const link = `${process.env.BASE_URL}/api/auth/verify?token=${token}`;

  await mailjet.post('send', { version: 'v3.1' }).request({
    Messages: [{
      From: {
        Email: process.env.MAILJET_FROM_EMAIL,
        Name: process.env.MAILJET_FROM_NAME,
      },
      To: [{ Email: email }],
      Subject: 'Your Little Sister sign-in link',
      TextPart: `Click this link to sign in (expires in 15 minutes):\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
      HTMLPart: `
        <h2>Sign in to Little Sister</h2>
        <p>Click the button below to sign in. This link expires in <strong>15 minutes</strong> and can only be used once.</p>
        <p><a href="${link}" style="background:#4a90e2;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;">Sign In</a></p>
        <p>Or copy and paste this URL:<br><code>${link}</code></p>
        <p><em>If you did not request this, you can ignore this email.</em></p>
      `,
    }],
  });
}

async function sendStatusUpdate(email, reservation, adminNote) {
  const statusMessages = {
    approved:  'Your reservation has been approved!',
    denied:    'Your reservation request was not approved.',
    cancelled: 'Your reservation has been cancelled.',
  };

  const headline = statusMessages[reservation.status] || `Reservation status: ${reservation.status}`;

  await mailjet.post('send', { version: 'v3.1' }).request({
    Messages: [{
      From: {
        Email: process.env.MAILJET_FROM_EMAIL,
        Name: process.env.MAILJET_FROM_NAME,
      },
      To: [{ Email: email }],
      Subject: `Little Sister Reservation Update: ${reservation.status}`,
      TextPart: [
        headline,
        `Dates: ${reservation.start_date} to ${reservation.end_date}`,
        adminNote ? `Note from host: ${adminNote}` : '',
        `Sign in to view your reservation: ${process.env.BASE_URL}`,
      ].filter(Boolean).join('\n\n'),
      HTMLPart: `
        <h2>${headline}</h2>
        <p><strong>Dates:</strong> ${reservation.start_date} to ${reservation.end_date}</p>
        ${adminNote ? `<p><strong>Note from host:</strong> ${adminNote}</p>` : ''}
        <p><a href="${process.env.BASE_URL}">View your reservation</a></p>
      `,
    }],
  });
}

module.exports = { sendMagicLink, sendStatusUpdate };
