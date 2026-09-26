import { useState } from 'react';
import { api, mediaUrl } from '../api.js';
import { UploadButton, refreshMedia, useMedia } from '../components/media.jsx';
import { ErrorNote, Loading, Modal, formatDate, useSaveToast, useToast } from '../components/ui.jsx';

export default function MediaLibrary() {
  const { list } = useMedia();
  const [editing, setEditing] = useState(null);

  return (
    <div>
      <header className="page-head">
        <h1>Media</h1>
        <UploadButton label="Upload images" onUploaded={() => {}} />
      </header>
      <p className="muted small">JPEG, PNG, WebP, GIF or AVIF, up to 10 MB. Add alt text so the images are accessible and help search rankings.</p>
      {!list ? <Loading /> : list.length === 0 ? <p className="muted">No images uploaded yet.</p> : (
        <div className="media-grid">
          {list.map((m) => (
            <button type="button" key={m.id} className="media-tile" onClick={() => setEditing(m)}>
              <img src={mediaUrl(m.r2_key)} alt={m.alt} loading="lazy" />
              <span>{m.alt || <em className="warn-text">No alt text</em>}</span>
            </button>
          ))}
        </div>
      )}
      {editing && <MediaDetail media={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function MediaDetail({ media, onClose }) {
  const [alt, setAlt] = useState(media.alt);
  const [error, setError] = useState(null);
  const saveToast = useSaveToast();
  const toast = useToast();

  const save = async (e) => {
    e.preventDefault();
    try {
      saveToast(await api(`/media/${media.id}`, { method: 'PATCH', body: { alt } }), 'Alt text saved.');
      await refreshMedia();
      onClose();
    } catch (err) {
      setError(err);
    }
  };

  const del = async () => {
    if (!confirm('Delete this image permanently?')) return;
    try {
      await api(`/media/${media.id}`, { method: 'DELETE' });
      await refreshMedia();
      toast('Image deleted.');
      onClose();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <Modal title={media.filename} onClose={onClose} wide>
      <div className="media-detail">
        <img src={mediaUrl(media.r2_key)} alt={media.alt} />
        <form className="stack" onSubmit={save}>
          <label className="field">Alt text
            <textarea value={alt} maxLength={300} rows={3} onChange={(e) => setAlt(e.target.value)} />
            <span className="hint">Describe the image for people using screen readers, e.g. “Living room with sofa and city view”.</span>
          </label>
          <dl className="meta">
            <dt>Size</dt><dd>{media.width && media.height ? `${media.width} × ${media.height}px · ` : ''}{Math.round(media.size / 1024)} KB</dd>
            <dt>Uploaded</dt><dd>{formatDate(media.created_at)}</dd>
            <dt>URL</dt><dd className="mono small">/{media.r2_key}</dd>
          </dl>
          <ErrorNote error={error} />
          <div className="row-between">
            <button type="button" className="btn danger" onClick={del}>Delete</button>
            <button className="btn primary">Save</button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
