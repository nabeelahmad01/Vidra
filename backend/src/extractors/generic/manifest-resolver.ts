import { execFile } from 'child_process';
// @ts-ignore
import ffprobeStatic from 'ffprobe-static';
import { ExtractedVideo } from '../ytdlp-handler';

export async function resolveManifestVariants(manifestUrl: string): Promise<ExtractedVideo[]> {
  const isHls = manifestUrl.includes('.m3u8');
  const isDash = manifestUrl.includes('.mpd');

  if (!isHls && !isDash) {
    return [];
  }

  // 1. If HLS, parse the master playlist manually first (often faster and cleaner than ffprobe)
  if (isHls) {
    try {
      const response = await fetch(manifestUrl, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const text = await response.text();
        const lines = text.split('\n');
        const variants: ExtractedVideo[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('#EXT-X-STREAM-INF:')) {
            // Find RESOLUTION=xxx
            const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
            const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/i);
            
            let quality = 'Unknown';
            if (resMatch) {
              quality = `${resMatch[2]}p`;
            }

            // Next non-empty line is the URL
            let streamUrl = '';
            for (let j = i + 1; j < lines.length; j++) {
              const nextLine = lines[j].trim();
              if (nextLine && !nextLine.startsWith('#')) {
                streamUrl = nextLine;
                break;
              }
            }

            if (streamUrl) {
              // Handle relative URL
              if (!streamUrl.startsWith('http')) {
                streamUrl = new URL(streamUrl, manifestUrl).href;
              }

              variants.push({
                quality,
                format: 'HLS',
                url: streamUrl,
                requiresMerge: false,
                type: 'application/x-mpegURL',
                formatId: `hls-${quality}`,
                sizeEstimate: bandwidthMatch ? Math.round(parseInt(bandwidthMatch[1], 10) / 8) : undefined // raw byte bandwidth approx
              });
            }
          }
        }

        if (variants.length > 0) {
          return variants;
        }
      }
    } catch (e) {
      // Fallback to ffprobe if network parsing fails
    }
  }

  // 2. Run ffprobe static to resolve streams
  return new Promise((resolve) => {
    const ffprobePath = ffprobeStatic.path;
    const args = [
      '-v', 'error',
      '-select_streams', 'v',
      '-show_entries', 'stream=width,height,codec_name,bit_rate',
      '-of', 'json',
      manifestUrl
    ];

    execFile(ffprobePath, args, { timeout: 10000 }, (err, stdout) => {
      if (err) {
        // Return single default quality if ffprobe fails
        return resolve([{
          quality: 'Adaptive',
          format: isHls ? 'HLS' : 'DASH',
          url: manifestUrl,
          requiresMerge: false,
          type: isHls ? 'application/x-mpegURL' : 'application/dash+xml',
          formatId: isHls ? 'hls' : 'dash'
        }]);
      }

      try {
        const data = JSON.parse(stdout);
        const streams = data.streams || [];
        const variants: ExtractedVideo[] = [];

        for (let i = 0; i < streams.length; i++) {
          const stream = streams[i];
          const height = stream.height;
          const width = stream.width;
          const quality = height ? `${height}p` : width ? `${width}x${height}` : 'Adaptive';

          variants.push({
            quality,
            format: isHls ? 'HLS' : 'DASH',
            url: manifestUrl,
            requiresMerge: false,
            type: isHls ? 'application/x-mpegURL' : 'application/dash+xml',
            formatId: `${isHls ? 'hls' : 'dash'}-${quality}`,
            sizeEstimate: stream.bit_rate ? Math.round(parseInt(stream.bit_rate) / 8) : undefined
          });
        }

        resolve(variants.length > 0 ? variants : [{
          quality: 'Adaptive',
          format: isHls ? 'HLS' : 'DASH',
          url: manifestUrl,
          requiresMerge: false,
          type: isHls ? 'application/x-mpegURL' : 'application/dash+xml',
          formatId: isHls ? 'hls' : 'dash'
        }]);
      } catch {
        resolve([{
          quality: 'Adaptive',
          format: isHls ? 'HLS' : 'DASH',
          url: manifestUrl,
          requiresMerge: false,
          type: isHls ? 'application/x-mpegURL' : 'application/dash+xml',
          formatId: isHls ? 'hls' : 'dash'
        }]);
      }
    });
  });
}
