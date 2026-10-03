import { useState } from 'react';
import { settings } from '../resources.js';
import { ImageField } from '../components/media.jsx';
import { ErrorNote, Loading, useLoad, useSaveToast } from '../components/ui.jsx';

// Owner-only: business details and links shown on every page of the public site.
export default function Settings() {
  const { data, error, setData } = useLoad(settings.get, []);
  const [values, setValues] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [busy, setBusy] = useState(false);
  const saveToast = useSaveToast();

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;
  const current = values ?? data.settings;
  const set = (key, value) => setValues({ ...current, [key]: value });
  const groups = [...new Set(data.fields.map((f) => f.group))];

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setSaveError(null);
    try {
      const res = await settings.save(current);
      setData({ ...data, settings: res.settings });
      setValues(null);
      saveToast(res, 'Settings saved — live on every page.');
    } catch (err) {
      setSaveError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <header className="page-head">
        <div>
          <h1>Site Settings</h1>
          <p className="subtitle">Contact details and links shown in the top bar and footer of every page. Leave a field blank to hide it. Changes go live when you save.</p>
        </div>
      </header>
      <form className="stack settings-form" onSubmit={save}>
        {groups.map((group) => (
          <section key={group} className="panel panel-pad stack">
            <h2 className="section-title">{group}</h2>
            <div className="settings-grid">
              {data.fields.filter((f) => f.group === group).map((f) =>
                f.kind === 'image' ? (
                  <div key={f.key} className="field span-2">
                    {f.label}
                    <ImageField value={current[f.key]} onChange={(v) => set(f.key, v)} />
                    <span className="hint">Shown when a link to the site is shared (Facebook, LinkedIn, texts), unless the page has its own in Page settings. Best at 1200×630.</span>
                  </div>
                ) : (
                  <label key={f.key} className="field">
                    {f.label}
                    <input
                      type={f.kind === 'email' ? 'email' : 'text'}
                      inputMode={f.kind === 'url' ? 'url' : undefined}
                      value={current[f.key] ?? ''}
                      maxLength={f.max}
                      placeholder={f.kind === 'url' ? 'https://… or /page' : ''}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  </label>
                ),
              )}
            </div>
          </section>
        ))}
        <ErrorNote error={saveError} />
        <div className="row">
          <button className="btn primary" disabled={busy || !values}>{busy ? 'Saving…' : 'Save settings'}</button>
          {values && <button type="button" className="btn ghost" onClick={() => setValues(null)}>Discard changes</button>}
        </div>
      </form>
    </div>
  );
}
