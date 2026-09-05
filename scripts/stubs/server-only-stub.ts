// No-op stand-in for the `server-only` package when running scripts directly through
// `tsx` (see scripts/tsconfig.json). `server-only`'s real module throws unconditionally
// unless resolved through the "react-server" package-export condition, which is a
// Next.js webpack/turbopack build-time concept with no equivalent when running a plain
// Node script outside Next entirely — this stub is scripts-only and never used by the
// actual Next.js build (see scripts/tsconfig.json's `paths` override, which is not the
// tsconfig Next itself compiles with).
export {};
