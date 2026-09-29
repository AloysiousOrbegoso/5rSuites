import { BLOCKS, ICONS } from '@5rsuites/blocks';
import { useId } from 'react';
import { ImageField } from './media.jsx';

// Renders an editing form for any block, straight from its definition in packages/blocks.

function emptyItem(fields) {
  return Object.fromEntries(
    fields.map((f) => [f.name, f.kind === 'image' ? null : f.kind === 'select' ? f.default : f.kind === 'number' ? 0 : '']),
  );
}

function Field({ field, value, onChange }) {
  const id = useId();
  const label = (
    <label htmlFor={id} className="field-label">
      {field.label}{field.required && <span className="req"> *</span>}
    </label>
  );

  switch (field.kind) {
    case 'text':
    case 'url':
      return (
        <div className="field" data-kind={field.kind} data-name={field.name}>
          {label}
          <input id={id} type="text" value={value ?? ''} maxLength={field.max} required={field.required}
            placeholder={field.kind === 'url' ? '/contact or https://…' : ''} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case 'textarea':
    case 'markdown':
      return (
        <div className="field" data-kind={field.kind} data-name={field.name}>
          {label}
          <textarea id={id} value={value ?? ''} maxLength={field.max} required={field.required}
            rows={field.kind === 'markdown' ? 10 : 3} onChange={(e) => onChange(e.target.value)} />
          {field.kind === 'markdown' && (
            <span className="hint">**bold** · *italic* · [link text](/page) · “- ” for bullets · “1. ” for numbers · “## ” for a heading</span>
          )}
        </div>
      );
    case 'number':
      return (
        <div className="field" data-kind={field.kind} data-name={field.name}>
          {label}
          <input id={id} type="number" value={value ?? 0} min={field.min} max={field.max} step="1" onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />
        </div>
      );
    case 'select':
      return (
        <div className="field" data-kind={field.kind} data-name={field.name}>
          {label}
          <select id={id} value={value ?? field.default} onChange={(e) => onChange(e.target.value)}>
            {field.options.map((o) => <option key={o} value={o}>{prettify(o)}</option>)}
          </select>
        </div>
      );
    case 'image':
      return (
        <div className="field" data-kind={field.kind} data-name={field.name}>
          <span className="field-label">{field.label}{field.required && <span className="req"> *</span>}</span>
          <ImageField value={value} onChange={onChange} />
        </div>
      );
    case 'list':
      return <ListField field={field} value={Array.isArray(value) ? value : []} onChange={onChange} />;
    default:
      return null;
  }
}

function ListField({ field, value, onChange }) {
  const update = (i, item) => onChange(value.map((v, j) => (j === i ? item : v)));
  const move = (i, d) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <fieldset className="list-field">
      <legend>{field.label} <span className="muted small">({value.length}/{field.max})</span></legend>
      {value.map((item, i) => (
        <div className="list-item" key={i}>
          <div className="list-item-head">
            <strong>#{i + 1}</strong>
            <div className="row">
              <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
              <button type="button" className="icon-btn" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
              <button type="button" className="icon-btn danger" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove">×</button>
            </div>
          </div>
          <Fields fields={field.fields} data={item} onChange={(d) => update(i, d)} />
        </div>
      ))}
      {value.length < field.max && (
        <button type="button" className="btn small" onClick={() => onChange([...value, emptyItem(field.fields)])}>+ Add</button>
      )}
    </fieldset>
  );
}

function Fields({ fields, data, onChange }) {
  return (
    <div className="fields">
      {fields.map((f) => (
        <Field key={f.name} field={f} value={data?.[f.name]} onChange={(v) => onChange({ ...data, [f.name]: v })} />
      ))}
    </div>
  );
}

export default function SectionForm({ type, data, onChange }) {
  const def = BLOCKS[type];
  // Photos go in a right-hand column with a large preview; everything else on the left.
  const images = def.fields.filter((f) => f.kind === 'image');
  const rest = def.fields.filter((f) => f.kind !== 'image');
  return (
    <div>
      {def.description && <p className="muted small form-desc">{def.description}</p>}
      <div className={images.length ? 'form-columns' : ''}>
        <Fields fields={rest} data={data} onChange={onChange} />
        {images.length > 0 && (
          <div className="fields">
            {images.map((f) => (
              <div className="field" key={f.name}>
                <span className="field-label">{f.label}</span>
                <ImageField large value={data?.[f.name]} onChange={(v) => onChange({ ...data, [f.name]: v })} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function prettify(s) {
  return ICONS.includes(s) || /_/.test(s) || /^[a-z]/.test(s) ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : s;
}

// One-line summary for the collapsed section card.
export function sectionSummary(type, data) {
  const heading = String(data?.heading || data?.quote || '').replace(/[#*[\]()]/g, '').trim();
  const count = (list, noun) => (Array.isArray(list) ? `${list.length} ${noun}${list.length === 1 ? '' : 's'}` : '');
  const extra = {
    traveler_grid: count(data?.items, 'card'),
    amenity_grid: count(data?.items, 'amenity').replace('amenitys', 'amenities'),
    image_gallery: count(data?.images, data?.variant === 'logo_strip' ? 'logo' : 'image'),
    photo_collage: count(data?.photos, 'photo'),
    form: { contact: 'Contact form', register_property: 'Register Property form', careers: 'Careers form' }[data?.form],
  }[type];
  const text = [heading.length > 70 ? `${heading.slice(0, 70)}…` : heading, extra].filter(Boolean).join(' · ');
  return text || (type === 'rich_text' ? String(data?.body || '').slice(0, 70) : '(no heading)');
}
