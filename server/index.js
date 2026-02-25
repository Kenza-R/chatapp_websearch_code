require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { YoutubeTranscript } = require('youtube-transcript');

async function fetchTranscriptForVideo(videoId) {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    if (Array.isArray(segments) && segments.length) {
      return segments.map((s) => (typeof s === 'string' ? s : s?.text)).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    }
  } catch {
    // Transcript not available (disabled, private, or no captions)
  }
  return null;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const URI = process.env.REACT_APP_MONGODB_URI || process.env.MONGODB_URI || process.env.REACT_APP_MONGO_URI;
const DB = 'chatapp';

let db;

async function connect() {
  const client = await MongoClient.connect(URI);
  db = client.db(DB);
  console.log('MongoDB connected');
}

app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="font-family:sans-serif;padding:2rem;background:#00356b;color:white;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0">
        <div style="text-align:center">
          <h1>Chat API Server</h1>
          <p>Backend is running. Use the React app at <a href="http://localhost:3000" style="color:#ffd700">localhost:3000</a></p>
          <p><a href="/api/status" style="color:#ffd700">Check DB status</a></p>
        </div>
      </body>
    </html>
  `);
});

app.get('/api/status', async (req, res) => {
  try {
    const usersCount = await db.collection('users').countDocuments();
    const sessionsCount = await db.collection('sessions').countDocuments();
    res.json({ usersCount, sessionsCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Users ────────────────────────────────────────────────────────────────────

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, email, firstName, lastName } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });
    const name = String(username).trim().toLowerCase();
    const existing = await db.collection('users').findOne({ username: name });
    if (existing) return res.status(400).json({ error: 'Username already exists' });
    const hashed = await bcrypt.hash(password, 10);
    await db.collection('users').insertOne({
      username: name,
      password: hashed,
      email: email ? String(email).trim().toLowerCase() : null,
      firstName: firstName ? String(firstName).trim() : null,
      lastName: lastName ? String(lastName).trim() : null,
      createdAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });
    const name = username.trim().toLowerCase();
    const user = await db.collection('users').findOne({ username: name });
    if (!user) return res.status(401).json({ error: 'User not found' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid password' });
    res.json({
      ok: true,
      username: name,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sessions ─────────────────────────────────────────────────────────────────

app.get('/api/sessions', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username required' });
    const sessions = await db
      .collection('sessions')
      .find({ username })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(
      sessions.map((s) => ({
        id: s._id.toString(),
        agent: s.agent || null,
        title: s.title || null,
        createdAt: s.createdAt,
        messageCount: (s.messages || []).length,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { username, agent } = req.body;
    if (!username) return res.status(400).json({ error: 'username required' });
    const { title } = req.body;
    const result = await db.collection('sessions').insertOne({
      username,
      agent: agent || null,
      title: title || null,
      createdAt: new Date().toISOString(),
      messages: [],
    });
    res.json({ id: result.insertedId.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await db.collection('sessions').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/sessions/:id/title', async (req, res) => {
  try {
    const { title } = req.body;
    await db.collection('sessions').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { title } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Messages ─────────────────────────────────────────────────────────────────

app.post('/api/messages', async (req, res) => {
  try {
    const { session_id, role, content, imageData, charts, toolCalls } = req.body;
    if (!session_id || !role || content === undefined)
      return res.status(400).json({ error: 'session_id, role, content required' });
    const msg = {
      role,
      content,
      timestamp: new Date().toISOString(),
      ...(imageData && {
        imageData: Array.isArray(imageData) ? imageData : [imageData],
      }),
      ...(charts?.length && { charts }),
      ...(toolCalls?.length && { toolCalls }),
    };
    await db.collection('sessions').updateOne(
      { _id: new ObjectId(session_id) },
      { $push: { messages: msg } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const doc = await db
      .collection('sessions')
      .findOne({ _id: new ObjectId(session_id) });
    const raw = doc?.messages || [];
    const msgs = raw.map((m, i) => {
      const arr = m.imageData
        ? Array.isArray(m.imageData)
          ? m.imageData
          : [m.imageData]
        : [];
      return {
        id: `${doc._id}-${i}`,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        images: arr.length
          ? arr.map((img) => ({ data: img.data, mimeType: img.mimeType }))
          : undefined,
        charts: m.charts?.length ? m.charts : undefined,
        toolCalls: m.toolCalls?.length ? m.toolCalls : undefined,
      };
    });
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Image generation (for generateImage tool) ─────────────────────────────────
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, anchor_image_base64 } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt required' });
    }
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    let imageBase64 = null;
    let mimeType = 'image/png';

    if (apiKey) {
      try {
        const genAI = require('@google/generative-ai').GoogleGenerativeAI;
        const gen = new genAI(apiKey);
        const model = gen.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        const parts = [{ text: `Generate an image: ${prompt}` }];
        if (anchor_image_base64) {
          parts.push({
            inlineData: { mimeType: 'image/png', data: anchor_image_base64 },
          });
        }
        const result = await model.generateContent(parts);
        const candidate = result.response?.candidates?.[0];
        const inlineData = candidate?.content?.parts?.find((p) => p.inlineData);
        if (inlineData?.inlineData?.data) {
          imageBase64 = inlineData.inlineData.data;
          mimeType = inlineData.inlineData.mimeType || 'image/png';
        }
      } catch (e) {
        console.warn('[generate-image] Gemini image gen failed:', e.message);
      }
    }

    if (!imageBase64) {
      return res.status(503).json({
        error: 'Image generation requires GEMINI_API_KEY. Add REACT_APP_GEMINI_API_KEY or GEMINI_API_KEY to your environment.',
      });
    }

    return res.json({ imageBase64, mimeType });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Image generation failed' });
  }
});

// ── YouTube Channel Data ─────────────────────────────────────────────────────
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.REACT_APP_YOUTUBE_API_KEY;

function parseDuration(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return iso;
  const h = parseInt(match[1] || 0, 10);
  const m = parseInt(match[2] || 0, 10);
  const s = parseInt(match[3] || 0, 10);
  return `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

app.post('/api/youtube/channel', async (req, res) => {
  if (!YOUTUBE_API_KEY) {
    return res.status(503).json({ error: 'YouTube API key not configured. Set YOUTUBE_API_KEY or REACT_APP_YOUTUBE_API_KEY.' });
  }
  try {
    const { channelUrl, maxVideos = 10 } = req.body;
    const cap = Math.min(Math.max(Number(maxVideos) || 10, 1), 100);
    let channelId = null;
    const url = (channelUrl || '').trim();
    // Handle /@handle or /channel/UC... or ?channel_id=
    const handleMatch = url.match(/youtube\.com\/@([^/?]+)/);
    const channelMatch = url.match(/youtube\.com\/channel\/(UC[\w-]+)/);
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
      return res.status(400).json({ error: 'Could not resolve channel. Use a URL like https://www.youtube.com/@veritasium or https://www.youtube.com/channel/UC...' });
    }
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`
    );
    const channelData = await channelRes.json();
    const uploadsId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) {
      return res.status(400).json({ error: 'Channel has no uploads playlist.' });
    }
    const channelTitle = channelData.items?.[0]?.snippet?.title || 'Unknown';
    const videoIds = [];
    let nextPageToken = '';
    while (videoIds.length < cap) {
      const listRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails,snippet&playlistId=${uploadsId}&maxResults=50&pageToken=${nextPageToken}&key=${YOUTUBE_API_KEY}`
      );
      const listData = await listRes.json();
      const items = listData.items || [];
      for (const it of items) {
        const vid = it.contentDetails?.videoId;
        if (vid) videoIds.push(vid);
        if (videoIds.length >= cap) break;
      }
      nextPageToken = listData.nextPageToken || '';
      if (!nextPageToken) break;
    }
    const ids = videoIds.slice(0, cap);
    const transcriptById = new Map();
    const results = await Promise.allSettled(ids.map((id) => fetchTranscriptForVideo(id)));
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value) transcriptById.set(ids[i], r.value);
    }
    const detailsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${YOUTUBE_API_KEY}`
    );
    const detailsData = await detailsRes.json();
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
    res.json({ channelId, channelTitle, videos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'YouTube API error' });
  }
});

// Streaming variant: sends NDJSON lines with progress, then final result
app.post('/api/youtube/channel-stream', async (req, res) => {
  if (!YOUTUBE_API_KEY) {
    return res.status(503).json({ error: 'YouTube API key not configured.' });
  }
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const send = (obj) => res.write(JSON.stringify(obj) + '\n');

  try {
    const { channelUrl, maxVideos = 10 } = req.body;
    const cap = Math.min(Math.max(Number(maxVideos) || 10, 1), 100);
    send({ type: 'progress', percent: 5, stage: 'Resolving channel' });
    let channelId = null;
    const url = (channelUrl || '').trim();
    const handleMatch = url.match(/youtube\.com\/@([^/?]+)/);
    const channelMatch = url.match(/youtube\.com\/channel\/(UC[\w-]+)/);
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
      send({ type: 'error', error: 'Could not resolve channel.' });
      return res.end();
    }
    send({ type: 'progress', percent: 15, stage: 'Fetching video list' });
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`
    );
    const channelData = await channelRes.json();
    const uploadsId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) {
      send({ type: 'error', error: 'Channel has no uploads playlist.' });
      return res.end();
    }
    const channelTitle = channelData.items?.[0]?.snippet?.title || 'Unknown';
    const videoIds = [];
    let nextPageToken = '';
    while (videoIds.length < cap) {
      const listRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails,snippet&playlistId=${uploadsId}&maxResults=50&pageToken=${nextPageToken}&key=${YOUTUBE_API_KEY}`
      );
      const listData = await listRes.json();
      for (const it of listData.items || []) {
        const vid = it.contentDetails?.videoId;
        if (vid) videoIds.push(vid);
        if (videoIds.length >= cap) break;
      }
      nextPageToken = listData.nextPageToken || '';
      if (!nextPageToken) break;
    }
    const ids = videoIds.slice(0, cap);
    send({ type: 'progress', percent: 25, stage: 'Fetching transcripts' });
    const transcriptById = new Map();
    for (let i = 0; i < ids.length; i++) {
      const text = await fetchTranscriptForVideo(ids[i]);
      if (text) transcriptById.set(ids[i], text);
      send({ type: 'progress', percent: 25 + Math.floor(((i + 1) / ids.length) * 35), stage: `Transcripts ${i + 1}/${ids.length}` });
    }
    send({ type: 'progress', percent: 65, stage: 'Fetching video details' });
    const detailsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${YOUTUBE_API_KEY}`
    );
    const detailsData = await detailsRes.json();
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
    send({ type: 'progress', percent: 100, stage: 'Done' });
    send({ type: 'result', channelId, channelTitle, videos });
  } catch (err) {
    console.error(err);
    send({ type: 'error', error: err.message || 'YouTube API error' });
  }
  res.end();
});

// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

connect()
  .then(() => {
    app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
