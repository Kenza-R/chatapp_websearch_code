import { useState, useEffect } from 'react';

const FALLBACK_SVG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"%3E%3Crect fill="%232d2416" width="320" height="180"/%3E%3Ctext fill="%23e8dcc8" x="160" y="95" text-anchor="middle" font-size="14"%3EThumbnail%3C/text%3E%3C/svg%3E';

export default function PlayVideoCard({ videoUrl, title, thumbnailUrl }) {
  const vid = (videoUrl || '').split('v=')[1]?.split('&')[0];
  const thumb = thumbnailUrl || (vid ? `https://img.youtube.com/vi/${vid}/mqdefault.jpg` : null);
  const [imgSrc, setImgSrc] = useState(thumb || FALLBACK_SVG);

  useEffect(() => {
    setImgSrc(thumb || FALLBACK_SVG);
  }, [thumb]);

  const handleImgError = () => setImgSrc(FALLBACK_SVG);

  return (
    <div className="play-video-card" onClick={() => window.open(videoUrl, '_blank', 'noopener,noreferrer')} role="button" tabIndex={0}>
      <div className="play-video-thumb">
        <img src={imgSrc} alt={title || 'Video thumbnail'} loading="eager" referrerPolicy="no-referrer" onError={handleImgError} />
        <span className="play-video-icon" aria-hidden>▶</span>
      </div>
      <div className="play-video-title">{title || 'Video'}</div>
      <div className="play-video-hint">Click to open in new tab</div>
    </div>
  );
}
