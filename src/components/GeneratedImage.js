import { useState } from 'react';

export default function GeneratedImage({ imageBase64, mimeType, fallback, error }) {
  const [enlarged, setEnlarged] = useState(false);
  const src = imageBase64 ? `data:${mimeType || 'image/png'};base64,${imageBase64}` : null;

  if (!src && fallback) {
    return (
      <div className="generated-image-wrap generated-image-fallback-only">
        <p className="generated-image-fallback-msg">{error || 'Image generation is currently unavailable.'}</p>
      </div>
    );
  }

  if (!src) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    const ext = (mimeType || '').includes('svg') ? 'svg' : 'png';
    a.download = `generated-image-${Date.now()}.${ext}`;
    a.click();
  };

  return (
    <div className="generated-image-wrap">
      {fallback && (
        <p className="generated-image-fallback-note">Image generation unavailable — showing placeholder</p>
      )}
      <img
        src={src}
        alt="Generated"
        className={enlarged ? 'generated-image enlarged' : 'generated-image'}
        onClick={() => setEnlarged(true)}
      />
      <div className="generated-image-actions">
        <button type="button" onClick={handleDownload}>Download</button>
        <button type="button" onClick={() => setEnlarged(true)}>Enlarge</button>
      </div>
      {enlarged && (
        <div className="generated-image-overlay" onClick={() => setEnlarged(false)}>
          <img src={src} alt="Generated (enlarged)" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="close-enlarge" onClick={() => setEnlarged(false)}>×</button>
        </div>
      )}
    </div>
  );
}
