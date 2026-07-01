/**
 * Vidra Hybrid Extraction Engine CLI Test Script
 * Run: node test_extraction.js <URL>
 */

const { extractWithYtdlp } = require('./dist/extractors/ytdlp-handler');
const { cheerioScrapingPass } = require('./dist/extractors/generic/cheerio-pass');
const { puppeteerScrapingPass } = require('./dist/extractors/generic/puppeteer-pass');
const { resolveManifestVariants } = require('./dist/extractors/generic/manifest-resolver');
const { YTDLP_ONLY_DOMAINS } = require('./dist/config/constants');

const url = process.argv[2];

if (!url) {
  console.log('Error: Please provide a target URL to test.');
  console.log('Usage: node test_extraction.js <URL>');
  process.exit(1);
}

// Helper to check if domain matches whitelist
function isWhitelisted(targetUrl) {
  try {
    const hostname = new URL(targetUrl).hostname;
    return YTDLP_ONLY_DOMAINS.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

async function runTest() {
  console.log(`\n======================================================`);
  console.log(`Starting Vidra Extraction Test for: ${url}`);
  console.log(`Platform Whitelisted for Direct yt-dlp: ${isWhitelisted(url) ? 'YES' : 'NO'}`);
  console.log(`======================================================\n`);

  // Stage 1: Try yt-dlp first
  console.log('[STAGE 1] Invoking yt-dlp handler...');
  try {
    const result = await extractWithYtdlp(url);
    console.log('\n✅ [SUCCESS] yt-dlp successfully extracted metadata:');
    printResult(result);
    return;
  } catch (err) {
    if (err.message === 'UNSUPPORTED_URL') {
      console.log('ℹ️ yt-dlp reports: Unsupported URL. Falling back to Generic Scrapers...');
    } else {
      console.log(`❌ yt-dlp error encountered: ${err.message}`);
      console.log('Falling back to Generic Scrapers...');
    }
  }

  // Stage 2: Fast Cheerio Pass
  console.log('\n[STAGE 2] Running Cheerio fast pass HTML parser...');
  try {
    const cheerioResult = await cheerioScrapingPass(url);
    if (cheerioResult) {
      console.log('\n✅ [SUCCESS] Cheerio fast pass extracted metadata:');
      printResult(cheerioResult);
      return;
    }
    console.log('ℹ️ Cheerio fast pass found no video elements.');
  } catch (err) {
    console.log(`❌ Cheerio pass error: ${err.message}`);
  }

  // Stage 3: Puppeteer Pool Pass
  console.log('\n[STAGE 3] Running Headless browser (Puppeteer) network interceptor...');
  try {
    const puppeteerResult = await puppeteerScrapingPass(url);
    if (puppeteerResult) {
      console.log('\n✅ [SUCCESS] Puppeteer browser pass extracted metadata:');
      printResult(puppeteerResult);
      
      // If manifest found, show resolved quality variants
      const hasManifest = puppeteerResult.videos.some(v => v.type.includes('mpegURL') || v.type.includes('dash+xml'));
      if (hasManifest) {
        console.log('\n[STAGE 4] Resolving stream manifest variants...');
        const manifestVideo = puppeteerResult.videos.find(v => v.type.includes('mpegURL') || v.type.includes('dash+xml'));
        const variants = await resolveManifestVariants(manifestVideo.url);
        console.log('Manifest quality variants resolved:');
        console.dir(variants, { depth: null });
      }
      return;
    }
    console.log('❌ Puppeteer browser pass could not capture any video streams.');
  } catch (err) {
    console.log(`❌ Puppeteer pass error: ${err.message}`);
  }

  console.log('\n======================================================');
  console.log('❌ [FAILURE] All extraction stages failed for this URL.');
  console.log('======================================================\n');
}

function printResult(res) {
  console.log('\n-------------------- Result --------------------');
  console.log(`Title           : ${res.title}`);
  console.log(`Thumbnail       : ${res.thumbnail}`);
  console.log(`Source Platform : ${res.sourcePlatform}`);
  console.log(`Streams Found   : ${res.videos.length}`);
  console.log('\nAvailable Streams:');
  res.videos.forEach((v, index) => {
    const mergeInfo = v.requiresMerge ? ' [Requires Audio+Video Merge]' : '';
    console.log(`  [#${index + 1}] Quality: ${v.quality} | Format: ${v.format} | Type: ${v.type}${mergeInfo}`);
    console.log(`       URL: ${v.url.substring(0, 80)}...`);
  });
  console.log('------------------------------------------------\n');
}

runTest().then(() => {
  // force exit Puppeteer pool process if hanging
  process.exit(0);
});
