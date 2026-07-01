import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

const BIN_DIR = path.resolve(__dirname, '../../bin');

// Ensures bin directory exists
if (!fs.existsSync(BIN_DIR)) {
  fs.mkdirSync(BIN_DIR, { recursive: true });
}

export async function downloadYtdlp(): Promise<void> {
  const isWindows = process.platform === 'win32';
  const binaryName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
  const destPath = path.join(BIN_DIR, binaryName);

  console.log(`[updater] Checking for latest yt-dlp binary...`);
  try {
    const response = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned status ${response.status}`);
    }

    const release = await response.json() as any;
    const assets = release.assets || [];
    
    // Find the correct asset
    const targetAsset = assets.find((asset: any) => asset.name === binaryName);
    if (!targetAsset) {
      throw new Error(`Could not find binary "${binaryName}" in the latest release assets.`);
    }

    const downloadUrl = targetAsset.browser_download_url;
    console.log(`[updater] Downloading latest yt-dlp from: ${downloadUrl}`);
    
    const fileResponse = await fetch(downloadUrl);
    if (!fileResponse.ok || !fileResponse.body) {
      throw new Error(`Failed to download binary from ${downloadUrl}`);
    }

    // Write file stream
    const fileStream = fs.createWriteStream(destPath);
    await finished(Readable.fromWeb(fileResponse.body as any).pipe(fileStream));

    // Make executable on unix-like platforms
    if (!isWindows) {
      fs.chmodSync(destPath, '755');
    }

    console.log(`[updater] yt-dlp updated successfully at ${destPath}`);
  } catch (error: any) {
    console.error(`[updater] Failed to update yt-dlp: ${error.message}`);
  }
}

// Scheduled daily cron at 2:00 AM
export function startUpdateCron(): void {
  cron.schedule('0 2 * * *', async () => {
    console.log('[updater] Running scheduled daily yt-dlp update...');
    await downloadYtdlp();
  });
  console.log('[updater] Daily yt-dlp update cron scheduled.');
}

// Runs on server startup
export async function initializeYtdlp(): Promise<void> {
  const isWindows = process.platform === 'win32';
  const binaryName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
  const destPath = path.join(BIN_DIR, binaryName);

  if (!fs.existsSync(destPath)) {
    console.log(`[updater] Binary not found. Initializing yt-dlp...`);
    await downloadYtdlp();
  } else {
    console.log(`[updater] yt-dlp binary already present at ${destPath}`);
  }
  
  // Start cron scheduling
  startUpdateCron();
}
