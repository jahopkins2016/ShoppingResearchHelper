// Marketing version. Bump manually for meaningful releases.
export const APP_VERSION = "1.11.0";

// Short commit SHA of the currently-deployed build. On Vercel this is
// automatically set from VERCEL_GIT_COMMIT_SHA at build time; locally
// it's empty.
//
// We read the env var at module-evaluation time so it's inlined into
// the client bundle. (process.env.NEXT_PUBLIC_* is the only env that
// Next.js exposes to the browser; Vercel populates
// NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA for every deploy.)
export const APP_COMMIT_SHA =
  (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);

/** Combined label for the UI, e.g. "v1.11.0 · a1b2c3d" or "v1.11.0". */
export const APP_VERSION_LABEL = APP_COMMIT_SHA
  ? `v${APP_VERSION} · ${APP_COMMIT_SHA}`
  : `v${APP_VERSION}`;
