import { useEffect, useState } from "react";

export type Session = {
  user: {
    id: string;
    handle: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
  org: { id: string; slug: string; name: string };
};

/**
 * Client-side session lookup. Kept out of RR7 loaders on purpose:
 *   - The web worker proxies `/api/me` to the runtime worker. In local dev
 *     the runtime is often not running, so a loader fetch throws and Vite
 *     shows an error overlay that intercepts clicks in Playwright.
 *   - Running in the browser instead means the page always renders; the
 *     UI swaps "로그인" → avatar once /api/me resolves.
 */
export function useSession(): { session: Session | null; loading: boolean } {
  const [state, setState] = useState<{ session: Session | null; loading: boolean }>({
    session: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then(async (r) => {
        if (r.status === 401) return null;
        if (!r.ok) return null;
        return (await r.json()) as Session;
      })
      .catch(() => null)
      .then((session) => {
        if (!cancelled) setState({ session, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
