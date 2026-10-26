/** Marketing and blog pages — always light mode regardless of user theme prefs. */
export function isLandingPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/innspill' || pathname === '/blogg' || pathname.startsWith('/blogg/');
}
