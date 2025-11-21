import cron from 'node-cron';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import pool from '../config/pg.js';
import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

const REPORT_EMAIL_TO = process.env.REPORT_EMAIL_TO || 'contact@cartalks.site';
const REPORT_FROM = process.env.REPORT_FROM || 'no-reply@yourdomain.com';

/**
 * Query sales summary for given date (YYYY-MM-DD)
 */
async function fetchSalesForDate(dateStr) {
  // ventes totals for the day (date_vente)
  const { rows: ventes } = await pool.query(
    `SELECT id, numero, date_vente, montant_total FROM vente WHERE date_vente::date = $1 ORDER BY date_vente`,
    [dateStr]
  );

  // aggregated top products for the day
  const { rows: topProducts } = await pool.query(
    `SELECT vi.nom, SUM(vi.quantite) AS qty, SUM(vi.total) AS total
     FROM vente_item vi
     JOIN vente v ON v.id = vi.vente_id
     WHERE v.date_vente::date = $1
     GROUP BY vi.nom
     ORDER BY SUM(vi.total) DESC
     LIMIT 10`,
    [dateStr]
  );

  return { ventes, topProducts };
}

/**
 * Generate chart PNG buffer using chartjs-node-canvas
 */
async function generateCharts(ventes, topProducts, dateStr) {
  const width = 1000;
  const height = 600;
  const chartCallback = (ChartJS) => {
    // can register plugins or fonts here if needed
  };
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, chartCallback });

  // Sales over hours (group ventes by hour)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const salesByHour = new Array(24).fill(0);
  ventes.forEach(v => {
    const d = new Date(v.date_vente);
    const h = d.getHours();
    salesByHour[h] += Number(v.montant_total || 0);
  });

  const salesHourConfig = {
    type: 'bar',
    data: {
      labels: hours.map(h => `${String(h).padStart(2,'0')}:00`),
      datasets: [{
        label: `Ventes par heure (${dateStr})`,
        data: salesByHour,
        backgroundColor: 'rgba(37,99,235,0.8)'
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  };

  const salesHourBuffer = await chartJSNodeCanvas.renderToBuffer(salesHourConfig);

  // Top products pie or bar
  const prodLabels = topProducts.map(p => p.nom);
  const prodTotals = topProducts.map(p => Number(p.total));
  const prodConfig = {
    type: 'bar',
    data: {
      labels: prodLabels,
      datasets: [{
        label: `Top produits (${dateStr})`,
        data: prodTotals,
        backgroundColor: prodLabels.map((_, i) => `hsl(${(i * 40) % 360} 70% 50%)`)
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } }
    }
  };

  const prodBuffer = await chartJSNodeCanvas.renderToBuffer(prodConfig);

  return { salesHourBuffer, prodBuffer };
}

/**
 * Send mail with charts attached
 */
async function sendReportEmail(dateStr, ventes, topProducts, charts) {
  if (!process.env.SMTP_HOST) {
    logger.error('SMTP configuration missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true', // true for 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const html = `
    <h3>Rapport des ventes du ${dateStr}</h3>
    <p>Total ventes: <b>${ventes.length}</b></p>
    <p>Montant total (somme): <b>${ventes.reduce((s, v) => s + Number(v.montant_total || 0), 0).toFixed(2)} F CFA</b></p>
    <p>Voir graphiques ci-joints.</p>
  `;

  const attachments = [
    { filename: `sales-by-hour-${dateStr}.png`, content: charts.salesHourBuffer },
    { filename: `top-products-${dateStr}.png`, content: charts.prodBuffer },
  ];

  const info = await transporter.sendMail({
    from: REPORT_FROM,
    to: REPORT_EMAIL_TO,
    subject: `Rapport ventes ${dateStr}`,
    html,
    attachments,
  });

  logger.info('Daily report email sent: %s', info.messageId);
}

/**
 * Main job: fetch data, build charts, send email
 */
export async function runDailyReportOnce(date = new Date()) {
  try {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    logger.info('Running daily report for %s', dateStr);

    const { ventes, topProducts } = await fetchSalesForDate(dateStr);
    const charts = await generateCharts(ventes, topProducts, dateStr);

    await sendReportEmail(dateStr, ventes, topProducts, charts);

    logger.info('Daily report completed for %s', dateStr);
  } catch (error) {
    logger.error('Daily report failed:', error);
  }
}

/**
 * Schedule the job every day at 22:45
 */
export function startDailyReportScheduler() {
  // '45 22 * * *' runs at 22:45 server local time
  cron.schedule('45 22 * * *', async () => {
    await runDailyReportOnce(new Date());
  }, { timezone: process.env.SERVER_TIMEZONE || undefined });

  logger.info('Daily report scheduler started (22:45)');
}