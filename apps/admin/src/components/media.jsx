import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { api, mediaUrl } from '../api.js';
import { ErrorNote, Loading, Modal, useToast } from './ui.jsx';

// One shared copy of the media list, so image fields can show thumbnails by id.
let mediaList = null;
let loading = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export function refreshMedia() {
  loading = api('/media').then((d) => {
    mediaList = d.media;
    loading = null;
    emit();
  });
  return loading;
}

export function useMedia() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => mediaList,
  );
  useEffect(() => {
    if (!mediaList && !loading) refreshMedia().catch(() => {});
  }, []);
  const byId = useCallback((id) => list?.find((m) => m.id === id) || null, [list]);
  return { list, byId };
}

function readDimensions(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve({});
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadImage(file, alt = '') {
  const { width, height } = await readDimensions(file);
  const form = new FormData();
  form.append('file', file);
  form.append('alt', alt);
  if (width) form.append('width', width);
  if (height) form.append('height', height);
  const d = await api('/media', { method: 'POST', form });
  await refreshMedia();
  return d.media;
}

export function UploadButton({ onUploaded, label = 'Upload image' }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <label className={`btn${busy ? ' disabled' : ''}`}>
      {busy ? 'Uploading…' : label}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        hidden
        multiple
        disabled={busy}
        onChange={async (e) => {
          const files = [...e.target.files];
          e.target.value = '';
          setBusy(true);
          for (const file of files) {
            try {
              const m = await uploadImage(file);
              onUploaded?.(m);
            } catch (err) {
              toast(`${file.name}: ${err.message}`, 'error');
            }
          }
          setBusy(false);
        }}
      />
    </label>
  );
}

export function Thumb({ media, size = 64 }) {
  if (!media) return <div className="thumb empty" style={{ width: size, height: size }}>No image</div>;
  return <img className="thumb" src={mediaUrl(media.r2_key)} alt={media.alt} width={size} height={size} loading="lazy" />;
}

export function MediaPicker({ onPick, onClose }) {
  const { list } = useMedia();
  return (
    <Modal title="Choose an image" onClose={onClose} wide>
      <div className="row-between">
        <p className="muted small">Pick an existing image or upload a new one.</p>
        <UploadButton onUploaded={(m) => onPick(m)} />
      </div>
      {!list ? <Loading /> : list.length === 0 ? <p className="muted">No images yet.</p> : (
        <div className="media-grid">
          {list.map((m) => (
            <button type="button" key={m.id} className="media-tile" onClick={() => onPick(m)} title={m.alt || m.filename}>
              <img src={mediaUrl(m.r2_key)} alt={m.alt} loading="lazy" />
              <span>{m.alt || m.filename}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function ImageField({ value, onChange, large = false }) {
  const { byId } = useMedia();
  const [picking, setPicking] = useState(false);
  const media = value ? byId(value) : null;
  if (large) {
    return (
      <div className="image-card">
        <div className="image-preview">
          {media ? <img src={mediaUrl(media.r2_key)} alt={media.alt} /> : <span>{value ? 'Image not found' : 'No photo selected'}</span>}
        </div>
        <div className="image-card-foot">
          <span className="muted small truncate">{media ? media.filename : 'Choose from the Media Library or upload'}</span>
          <div className="row">
            {value && <button type="button" className="btn small ghost" onClick={() => onChange(null)}>Remove</button>}
            <button type="button" className="btn small" onClick={() => setPicking(true)}>{value ? 'Replace' : 'Choose'}</button>
          </div>
        </div>
        {media && !media.alt && <p className="warn-text small image-warn">This image has no alt text — add it in the Media Library.</p>}
        {picking && <MediaPicker onClose={() => setPicking(false)} onPick={(m) => { onChange(m.id); setPicking(false); }} />}
      </div>
    );
  }
  return (
    <div className="image-field">
      <Thumb media={media} size={72} />
      <div className="stack-sm">
        <div className="row">
          <button type="button" className="btn small" onClick={() => setPicking(true)}>{value ? 'Change' : 'Choose image'}</button>
          {value && <button type="button" className="btn small ghost" onClick={() => onChange(null)}>Remove</button>}
        </div>
        {media && !media.alt && <span className="warn-text small">This image has no alt text — add it in Media.</span>}
        {value && !media && <ErrorNote error={new Error('Image not found (it may have been deleted).')} />}
      </div>
      {picking && <MediaPicker onClose={() => setPicking(false)} onPick={(m) => { onChange(m.id); setPicking(false); }} />}
    </div>
  );
}
