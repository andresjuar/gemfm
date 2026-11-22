import { useCallback, useEffect, useState } from 'react';

/** Loads data on mount; `reload` fetches again. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(load, deps);

  const reload = useCallback(async () => {
    try {
      setData(await run());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [run]);

  useEffect(() => { reload(); }, [reload]);

  return { data, error, reload, setData };
}
