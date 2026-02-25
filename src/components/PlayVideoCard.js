const FALLBACK_SVG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90"%3E%3Crect fill="%232d2416" width="160" height="90"/%3E%3Ctext fill="%23e8dcc8" x="80" y="48" text-anchor="middle" font-size="12"%3EThumbnail%3C/text%3E%3C/svg%3E';

export default function PlayVideoCard({ videoUrl, title, thumbnailUrl }) {
  const vid = (videoUrl || '').split('v=')[1]?.split('&')[0];
  const thumb = thumbnailUrl || (vid ? `https://img.youtube.com/vi/${vid}/mqdefault.jpg` : null) || FALLBACK_SVG;

  return (
    <div
      className="play-video-card"
      onClick={() => window.open(videoUrl, '_blank', 'noopener,noreferrer')}
      role="button"
      tabIndex={0}
    >
      <img src={thumb} alt={title} className="play-video-thumb-img" />
      <div className="play-video-body">
        <div className="play-video-title">{title || 'Video'}</div>
        <div className="play-video-hint">Click to open in new tab</div>
      </div>
    </div>
  );
}
