import { useEffect, useState } from 'react';
import { savedStore } from '../storage/savedDb';
import { savedEvents, type SavedItem } from '../storage/savedTypes';

/** Live view of one saved article (re-reads when the saved store changes). */
export function useSavedItem(id: string | undefined) {
  const [state, setState] = useState<{ loading: boolean; item: SavedItem | null }>({ loading: true, item: null });
  useEffect(() => {
    if (!id) {
      setState({ loading: false, item: null });
      return;
    }
    let alive = true;
    const load = () =>
      savedStore
        .get(id)
        .then((item) => alive && setState({ loading: false, item }))
        .catch(() => alive && setState({ loading: false, item: null }));
    void load();
    const unsub = savedEvents.subscribe(load);
    return () => {
      alive = false;
      unsub();
    };
  }, [id]);
  return state;
}

/** Live list of all saved articles. */
export function useSavedList() {
  const [state, setState] = useState<{ loading: boolean; items: SavedItem[]; error: unknown }>({ loading: true, items: [], error: null });
  useEffect(() => {
    let alive = true;
    const load = () =>
      savedStore
        .list()
        .then((items) => alive && setState({ loading: false, items, error: null }))
        .catch((error) => alive && setState({ loading: false, items: [], error }));
    void load();
    const unsub = savedEvents.subscribe(load);
    return () => {
      alive = false;
      unsub();
    };
  }, []);
  return state;
}
