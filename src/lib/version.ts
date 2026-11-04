/** Compare dotted versions ("1.2.10" > "1.2.9"). Non-numeric parts count as 0. Pure. */
export function compareVersions(a: string, b: string): number {
  const pa = String(a ?? '').split(/[.+-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);
  const pb = String(b ?? '').split(/[.+-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** True when the running app is older than the server's minimum supported version. */
export function isUpdateRequired(appVersion: string, minSupported: string | null | undefined) {
  if (!minSupported) return false;
  return compareVersions(appVersion, minSupported) < 0;
}
