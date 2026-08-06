/** Marketing pages — always rendered in light mode regardless of user theme prefs. */
export function isLandingPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/om-oss' || pathname === '/innspill';
}
