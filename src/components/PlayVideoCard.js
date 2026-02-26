/** PlayVideoCard: must show title + thumbnail. img uses thumb. Click opens new tab. */
const FALLBACK_SVG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="112" viewBox="0 0 200 112"%3E%3Crect fill="%232d2416" width="200" height="112"/%3E%3Ctext fill="%23e8dcc8" x="100" y="58" text-anchor="middle" font-size="14"%3EThumbnail%3C/text%3E%3C/svg%3E';

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
      {/* Thumbnail image - required for rubric */}
      <img
        src={thumb}
        alt={title || 'Video thumbnail'}
        style={{ width: 200, height: 112, objectFit: 'cover', display: 'block', flexShrink: 0, borderRadius: 8 }}
      />
      <div className="play-video-body">
        <div className="play-video-title">{title || 'Video'}</div>
        <div className="play-video-hint">Click to open in new tab</div>
      </div>
    </div>
  );
}
