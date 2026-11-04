import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Dimensions, type HostInstance } from 'react-native';

/**
 * Lightweight "is it on screen?" signal for ad impressions (count only when actually shown).
 * Scroll containers call notify() (throttled); subscribers re-measure themselves in window coordinates.
 */
type Ctx = { subscribe: (fn: () => void) => () => void; notify: () => void };
const ViewportContext = createContext<Ctx | null>(null);

export function ViewportProvider({ children }: { children: ReactNode }) {
  const subs = useRef(new Set<() => void>());
  const last = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback(() => {
    const now = Date.now();
    const run = () => {
      last.current = Date.now();
      subs.current.forEach((f) => f());
    };
    if (now - last.current > 150) run();
    else if (!pending.current) pending.current = setTimeout(() => {
      pending.current = null;
      run();
    }, 160);
  }, []);
  const value = useMemo<Ctx>(() => ({ subscribe: (fn) => (subs.current.add(fn), () => void subs.current.delete(fn)), notify }), [notify]);
  useEffect(() => () => {
    if (pending.current) clearTimeout(pending.current);
  }, []);
  return <ViewportContext.Provider value={value}>{children}</ViewportContext.Provider>;
}

export function useViewportNotify() {
  return useContext(ViewportContext)?.notify ?? (() => {});
}

/** Calls onVisible once, the first time ≥50% of the view is inside the window. */
export function useOnFirstVisible(ref: React.RefObject<HostInstance | null>, onVisible: () => void, enabled = true) {
  const ctx = useContext(ViewportContext);
  const done = useRef(false);
  const cb = useRef(onVisible);
  cb.current = onVisible;
  useEffect(() => {
    if (!enabled) return;
    done.current = false;
    const check = () => {
      if (done.current || !ref.current) return;
      ref.current.measureInWindow((_x, y, _w, h) => {
        if (done.current || !h) return;
        const winH = Dimensions.get('window').height;
        const visible = Math.min(y + h, winH) - Math.max(y, 0);
        if (visible >= h * 0.5) {
          done.current = true;
          cb.current();
        }
      });
    };
    const t = setTimeout(check, 400);
    const unsub = ctx?.subscribe(check);
    return () => {
      clearTimeout(t);
      unsub?.();
    };
  }, [ctx, ref, enabled]);
}
