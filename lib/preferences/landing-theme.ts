/** Marketing home — always rendered in light mode regardless of user theme prefs. */
export function isLandingPath(pathname: string): boolean {
  return pathname === '/';
}
