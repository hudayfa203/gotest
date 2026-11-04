/**
 * Rewrites incoming system URLs before Expo Router matches them:
 *   https://goworld.news/{section}/{slug}-{id}  → /article/{id}   (Universal Links / App Links)
 *   goworldnews://article/{id}                  → /article/{id}
 *   goworldnews://auth?token=…                  → /auth?token=…
 *   other goworld.news paths                    → in-app screen or /link?path=… (GET /resolve)
 */
import { APP_LINK_HOSTS } from '../src/config';
import { rewriteIncomingPath } from '../src/lib/deeplink';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return rewriteIncomingPath(path, { hosts: APP_LINK_HOSTS });
  } catch {
    return '/';
  }
}
