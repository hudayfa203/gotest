import { useEffect, useState } from 'react';

/** Current time, re-rendering every `intervalMs` — for relative times ("8 min ago") and freshness checks. */
export function useNow(intervalMs = 60_000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, enabled]);
  return now;
}
