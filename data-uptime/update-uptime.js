import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple .env parser for standalone script
try {
  const envPath = path.join(__dirname, '..', '.env');
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) process.env[match[1]] = match[2];
  });
} catch (e) {
}

// Configuration
const NGROK_BASE_URL = 'https://nonstereotyped-lina-blatantly.ngrok-free.dev';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'Chell07';
const REPO_NAME = 'Database';
const FILE_PATH = 'data-uptime/uptime-history.json';
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

async function getGitHubFile() {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Uptime-Checker-Bot'
    }
  });

  if (res.status === 404) {
    return { data: [], sha: null };
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch from GitHub: ${res.statusText}`);
  }

  const json = await res.json();
  const contentStr = Buffer.from(json.content, 'base64').toString('utf8');
  return {
    data: JSON.parse(contentStr),
    sha: json.sha
  };
}

async function updateGitHubFile(newData, sha) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
  const contentBase64 = Buffer.from(JSON.stringify(newData, null, 2) + '\n').toString('base64');

  const body = {
    message: `[Bot] update uptime history for ${getTodayISO()}`,
    content: contentBase64,
    committer: {
      name: 'github-actions[bot]',
      email: 'github-actions[bot]@users.noreply.github.com'
    },
    author: {
      name: 'github-actions[bot]',
      email: 'github-actions[bot]@users.noreply.github.com'
    }
  };

  if (sha) {
    body.sha = sha;
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Uptime-Checker-Bot'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to update GitHub file: ${res.statusText} - ${errText}`);
  }
}

async function main() {
  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is not set in .env file");
  }

  const today = getTodayISO();
  const isOnline = await ping();
  console.log(`[${getWitaTime()}] Ping result: ${isOnline ? 'ONLINE ✓' : 'OFFLINE ✗'}`);

  console.log('Fetching current history from GitHub...');
  const { data: history, sha } = await getGitHubFile();

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

  let trimmed = history;
  if (trimmed.length >= 50) {
    trimmed = trimmed.slice(-25);
  }

  console.log('Pushing updated history to GitHub...');
  await updateGitHubFile(trimmed, sha);

  console.log(`[${getWitaTime()}] Successfully updated ${FILE_PATH} in GitHub`);
  console.log(`  Today (${today}): ${todayEntry.online}/${todayEntry.checks} checks online → ${todayEntry.uptimePercent}%`);
}

main().catch(err => {
  console.error('Uptime check failed:', err);
  process.exit(1);
});
