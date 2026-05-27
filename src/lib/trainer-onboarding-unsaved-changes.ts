export function hasOnboardingSnapshotChanges(initialSnapshot: string | null, currentSnapshot: string): boolean {
  return initialSnapshot !== null && currentSnapshot !== initialSnapshot;
}

export function shouldInterceptDashboardNavigation(href: string | null, currentLocationHref: string): boolean {
  if (!href || href.startsWith("#")) return false;

  let currentLocation: URL;
  try {
    currentLocation = new URL(currentLocationHref);
  } catch {
    return false;
  }

  let target: URL;
  try {
    target = new URL(href, currentLocation.href);
  } catch {
    return false;
  }

  if (target.origin !== currentLocation.origin) return false;
  return target.pathname === "/trainer/dashboard" || target.pathname === "/trainer/dashboard/";
}
