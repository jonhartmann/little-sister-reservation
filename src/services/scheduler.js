'use strict';
const cron = require('node-cron');
const { pool } = require('../db');

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

  console.log('Scheduler started (daily reservation updates at 00:05 UTC)');
}

module.exports = { startScheduler };
