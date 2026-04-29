import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NGROK_BASE_URL = 'https://nonstereotyped-lina-blatantly.ngrok-free.dev';
const FILE_PATH = path.join(__dirname, 'uptime-history.json');
const PING_TIMEOUT_MS = 10000;

async function ping() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const res = await fetch(`${NGROK_BASE_URL}/ping`, {
      signal: controller.signal,
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

function getTodayISO() {
  // Format pakai YYYY-MM-DD dengan zona waktu WITA (Asia/Makassar)
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
}

function getWitaTime() {
  return new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });
}

async function main() {
  const today = getTodayISO();
  const isOnline = await ping();
  console.log(`[${getWitaTime()}] Ping result: ${isOnline ? 'ONLINE ✓' : 'OFFLINE ✗'}`);

  let history = [];
  if (fs.existsSync(FILE_PATH)) {
    history = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  }

  let todayEntry = history.find(e => e.date === today);

  if (todayEntry) {
    todayEntry.checks += 1;
    if (isOnline) todayEntry.online += 1;
    todayEntry.uptimePercent = parseFloat(
      ((todayEntry.online / todayEntry.checks) * 100).toFixed(2)
    );
  } else {
    todayEntry = {
      date: today,
      checks: 1,
      online: isOnline ? 1 : 0,
      uptimePercent: isOnline ? 100 : 0,
    };
    history.push(todayEntry);
  }

  history.sort((a, b) => a.date.localeCompare(b.date));
  
  if (history.length >= 50) {
    history = history.slice(-25);
  }

  fs.writeFileSync(FILE_PATH, JSON.stringify(history, null, 2) + '\n');
  console.log(`[${getWitaTime()}] Successfully updated ${FILE_PATH}`);
  console.log(`  Today (${today}): ${todayEntry.online}/${todayEntry.checks} checks online → ${todayEntry.uptimePercent}%`);
}

main().catch(err => {
  console.error('Uptime check failed:', err);
  process.exit(1);
});
