import { useState } from 'react';
import './YouTubeChannelDownload.css';

const API = process.env.REACT_APP_API_URL || '';

export default function YouTubeChannelDownload({ onSendToChat }) {
  const [channelUrl, setChannelUrl] = useState('https://www.youtube.com/@veritasium');
  const [maxVideos, setMaxVideos] = useState(10);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleDownload = async () => {
    setError('');
    setResult(null);
    const num = Number(maxVideos) || 10;
    if (num > 100) {
      setError('The maximum is 100');
      return;
    }
    if (num < 1) {
      setError('The minimum is 1');
      return;
    }
    setLoading(true);
    setProgress(0);
    try {
      const res = await fetch(`${API}/api/youtube/channel-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelUrl: channelUrl.trim(),
          maxVideos: Math.min(100, Math.max(1, num)),
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || res.statusText);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === 'progress') setProgress(msg.percent);
            if (msg.type === 'result') finalResult = msg;
            if (msg.type === 'error') throw new Error(msg.error);
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
      if (finalResult) {
        setResult({ channelId: finalResult.channelId, channelTitle: finalResult.channelTitle, videos: finalResult.videos });
      } else {
        throw new Error('No result received');
      }
    } catch (err) {
      setError(err.message || 'Download failed');
      setResult(null);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleSaveJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `youtube-channel-${(result.channelTitle || 'data').replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="youtube-download">
      <div className="youtube-download-card">
        <h2>YouTube Channel Download</h2>
        <p className="youtube-download-desc">
          Enter a YouTube channel page URL to download metadata for its videos (title, description, duration, view count, like count, comment count, video URL). Transcript is included when available.
        </p>
        <div className="youtube-download-form">
          <input
            type="url"
            placeholder="https://www.youtube.com/@veritasium"
            value={channelUrl}
            onChange={(e) => setChannelUrl(e.target.value)}
            disabled={loading}
          />
          <div className="youtube-download-row">
            <label>
              Max videos: <input
                type="number"
                min={1}
                max={100}
                value={maxVideos}
                onChange={(e) => setMaxVideos(e.target.value)}
                disabled={loading}
              />
            </label>
            <button onClick={handleDownload} disabled={loading}>
              {loading ? 'Downloading…' : 'Download Channel Data'}
            </button>
          </div>
        </div>
        {loading && (
          <div className="youtube-progress-wrap">
            <div className="youtube-progress-bar" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <p className="youtube-error">{error}</p>}
        {result && (
          <div className="youtube-result">
            <p><strong>{result.channelTitle}</strong> — {result.videos?.length ?? 0} videos</p>
            <div className="youtube-result-actions">
              {onSendToChat && (
                <button className="youtube-send-to-chat" onClick={() => onSendToChat(result.channelTitle, result.videos)}>
                  Send to Chat
                </button>
              )}
              <button onClick={handleSaveJson}>Download JSON file</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
