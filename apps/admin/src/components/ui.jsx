import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// ---- Toasts -----------------------------------------------------------------

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = 'ok') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'ok' ? 3500 : 8000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// After a save, tell the editor whether the live site was refreshed.
export function useSaveToast() {
  const toast = useToast();
  return useCallback(
    (result, message = 'Saved — live on the site.') => {
      if (result && result.purged === false) {
        toast(`Saved, but the live site may show the old version for a while: ${result.purgeError}`, 'warn');
      } else {
        toast(message);
      }
    },
    [toast],
  );
}

// ---- Modal ------------------------------------------------------------------

export function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog ref={ref} className={`modal${wide ? ' wide' : ''}`} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <header className="modal-head">
        <h2>{title}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}

// ---- Misc ---------------------------------------------------------------------

export function ErrorNote({ error }) {
  if (!error) return null;
  return <p className="error-note" role="alert">{error.message || String(error)}</p>;
}

export function Loading() {
  return <p className="muted">Loading…</p>;
}

export function formatDate(sqlDate) {
  if (!sqlDate) return '—';
  const d = new Date(`${sqlDate.replace(' ', 'T')}Z`);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// Load data on mount, with reload().
export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ data: await fn(), error: null, loading: false });
    } catch (error) {
      setState({ data: null, error, loading: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    run();
  }, [run]);
  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
}
