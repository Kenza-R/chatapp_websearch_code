#!/usr/bin/env node
/**
 * Fetches 10 videos from Veritasium channel (with transcripts when available) and writes public/veritasium_10.json.
 * Requires YOUTUBE_API_KEY in .env. Run: node scripts/fetch-veritasium.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const TranscriptClient = require('youtube-transcript-api');

let transcriptClientPromise = null;
function getTranscriptClient() {
  if (!transcriptClientPromise) {
    transcriptClientPromise = (async () => {
      const client = new TranscriptClient({
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        },
      });
      await client.ready;
      return client;
    })();
  }
  return transcriptClientPromise;
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.REACT_APP_YOUTUBE_API_KEY;
const CHANNEL_URL = 'https://www.youtube.com/@veritasium';
const MAX_VIDEOS = 10;

function parseDuration(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return iso;
  const h = parseInt(match[1] || 0, 10);
  const m = parseInt(match[2] || 0, 10);
  const s = parseInt(match[3] || 0, 10);
  return `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function fetchVeritasium() {
  if (!YOUTUBE_API_KEY) {
    console.error('Missing YOUTUBE_API_KEY or REACT_APP_YOUTUBE_API_KEY in .env');
    process.exit(1);
  }
  const url = CHANNEL_URL.trim();
  const handleMatch = url.match(/youtube\.com\/@([^/?]+)/);
  const channelMatch = url.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  let channelId = null;
  if (channelMatch) {
    channelId = channelMatch[1];
  } else if (handleMatch) {
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handleMatch[1])}&key=${YOUTUBE_API_KEY}`
    );
    const searchData = await searchRes.json();
    const first = searchData.items?.[0];
    channelId = first?.snippet?.channelId || first?.id?.channelId;
  }
  if (!channelId) {
    console.error('Could not resolve channel');
    process.exit(1);
  }
  const channelRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`
  );
  const channelData = await channelRes.json();
  const uploadsId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) {
    console.error('Channel has no uploads playlist');
    process.exit(1);
  }
  const channelTitle = channelData.items?.[0]?.snippet?.title || 'Unknown';
  const videoIds = [];
  let nextPageToken = '';
  while (videoIds.length < MAX_VIDEOS) {
    const listRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails,snippet&playlistId=${uploadsId}&maxResults=50&pageToken=${nextPageToken}&key=${YOUTUBE_API_KEY}`
    );
    const listData = await listRes.json();
    const items = listData.items || [];
    for (const it of items) {
      const vid = it.contentDetails?.videoId;
      if (vid) videoIds.push(vid);
      if (videoIds.length >= MAX_VIDEOS) break;
    }
    nextPageToken = listData.nextPageToken || '';
    if (!nextPageToken) break;
  }
  const ids = videoIds.slice(0, MAX_VIDEOS);
  const detailsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${YOUTUBE_API_KEY}`
  );
  const detailsData = await detailsRes.json();
  const transcriptById = new Map();
  try {
    const client = await getTranscriptClient();
    const results = await Promise.allSettled(ids.map((id) => client.getTranscript(id)));
    for (let i = 0; i < ids.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value) {
        const t = r.value;
        const segs = t?.tracks?.[0]?.transcript ?? t?.transcript ?? t?.segments ?? (Array.isArray(t) ? t : []);
        if (Array.isArray(segs) && segs.length) {
          const text = segs
            .map((s) => (typeof s === 'string' ? s : s?.text))
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (text) transcriptById.set(ids[i], text);
        }
      }
    }
  } catch (e) {
    console.warn('[Transcripts] fetch failed:', e?.message || e);
  }
  const videos = (detailsData.items || []).map((v) => {
    const s = v.snippet || {};
    const st = v.statistics || {};
    const cd = v.contentDetails || {};
    return {
      videoId: v.id,
      videoUrl: `https://www.youtube.com/watch?v=${v.id}`,
      thumbnailUrl: s.thumbnails?.medium?.url || s.thumbnails?.default?.url || `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`,
      title: s.title || '',
      description: (s.description || '').slice(0, 5000),
      transcript: transcriptById.get(v.id) || null,
      duration: parseDuration(cd.duration) || cd.duration,
      releaseDate: s.publishedAt || null,
      viewCount: parseInt(st.viewCount, 10) || 0,
      likeCount: parseInt(st.likeCount, 10) || 0,
      commentCount: parseInt(st.commentCount, 10) || 0,
    };
  });
  return { channelId, channelTitle, videos };
}

fetchVeritasium()
  .then((data) => {
    const outPath = path.join(__dirname, '..', 'public', 'veritasium_10.json');
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Wrote ${data.videos.length} videos to public/veritasium_10.json (${data.channelTitle})`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
