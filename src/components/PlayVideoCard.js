export default function PlayVideoCard({ videoUrl, title, thumbnailUrl }) {
  const vid = (videoUrl || '').split('v=')[1]?.split('&')[0];
  const thumb = thumbnailUrl || (vid ? `https://img.youtube.com/vi/${vid}/mqdefault.jpg` : null);
  return (
    <div className="play-video-card" onClick={() => window.open(videoUrl, '_blank', 'noopener,noreferrer')} role="button" tabIndex={0}>
      <div className="play-video-thumb">
        <img src={thumb || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"%3E%3Crect fill="%23333" width="320" height="180"/%3E%3Ctext fill="%23999" x="160" y="95" text-anchor="middle" font-size="14"%3EThumbnail%3C/text%3E%3C/svg%3E'} alt={title || 'Video thumbnail'} loading="eager" />
        <span className="play-video-icon" aria-hidden>▶</span>
      </div>
      <div className="play-video-title">{title || 'Video'}</div>
      <div className="play-video-hint">Click to open in new tab</div>
    </div>
  );
}
