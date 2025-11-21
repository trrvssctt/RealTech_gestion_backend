// src/jobs/cronJobs.ts
import cron from 'node-cron';

// Example: Daily task reminder
cron.schedule('0 0 * * *', async () => {
  // Send reminders for tasks, etc.
  console.log('Running daily cron job');
});