'use strict';
const cron = require('node-cron');
const { pool } = require('../db');
const { sendCheckinReminder } = require('./email');

function startScheduler() {
  // Daily at 00:05 UTC: update reservation statuses
  cron.schedule('5 0 * * *', async () => {
    console.log('[cron] Running daily reservation status update...');

    try {
      const expiredResult = await pool.query(
        `UPDATE reservations
            SET status = 'expired', updated_at = NOW()
          WHERE status = 'pending'
            AND end_date < CURRENT_DATE
          RETURNING id`
      );
      console.log(`[cron] Marked ${expiredResult.rowCount} reservations as expired`);

      const completeResult = await pool.query(
        `UPDATE reservations
            SET status = 'complete', updated_at = NOW()
          WHERE status = 'approved'
            AND end_date < CURRENT_DATE
          RETURNING id`
      );
      console.log(`[cron] Marked ${completeResult.rowCount} reservations as complete`);
    } catch (err) {
      console.error('[cron] Daily status update failed:', err.message);
    }
  });

  // Hourly: delete expired sessions
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await pool.query(`DELETE FROM sessions WHERE expires_at < NOW()`);
      if (result.rowCount > 0) {
        console.log(`[cron] Cleaned up ${result.rowCount} expired sessions`);
      }
    } catch (err) {
      console.error('[cron] Session cleanup failed:', err.message);
    }
  });

  // Daily at 10:00 UTC: send check-in reminder emails
  cron.schedule('0 10 * * *', async () => {
    const days = parseInt(process.env.CHECKIN_REMINDER_DAYS, 10) || 3;
    try {
      const result = await pool.query(
        `SELECT r.id, r.start_date, r.end_date, u.email, u.first_name
           FROM reservations r
           JOIN users u ON u.id = r.user_id
          WHERE r.status = 'approved'
            AND r.start_date = CURRENT_DATE + ($1 * INTERVAL '1 day')`,
        [days]
      );
      for (const row of result.rows) {
        try {
          await sendCheckinReminder(row.email, row.first_name, row);
          console.log(`[cron] Sent check-in reminder to ${row.email} (reservation ${row.id})`);
        } catch (err) {
          console.error(`[cron] Failed to send reminder to ${row.email}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[cron] Check-in reminder job failed:', err.message);
    }
  });

  console.log('Scheduler started (daily reservation updates at 00:05 UTC)');
}

module.exports = { startScheduler };
