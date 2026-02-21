export default function PlayVideoCard({ videoUrl, title, thumbnailUrl }) {
  return (
    <div className="play-video-card" onClick={() => window.open(videoUrl, '_blank', 'noopener,noreferrer')}>
      <div className="play-video-thumb">
        <img src={thumbnailUrl || `https://img.youtube.com/vi/${(videoUrl || '').split('v=')[1]}/mqdefault.jpg`} alt="" />
        <span className="play-video-icon">▶</span>
      </div>
      <div className="play-video-title">{title || 'Video'}</div>
      <div className="play-video-hint">Click to open in new tab</div>
    </div>
  );
}
