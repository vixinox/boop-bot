# Agent Instructions

- Prefer shadcn UI components for application interfaces. Check `src/components/ui/` first; when a component is missing, install it with the shadcn CLI instead of hand-building a substitute. Run `proxy-off` and the CLI command in the same terminal session, for example `proxy-off; pnpm exec shadcn add -y -p src/components/ui <component>`; do not split them across terminals. Keep generated components under `src/components/ui/` so the application aliases resolve them.
- Leave complex manual acceptance flows, especially visual and interaction-heavy browser acceptance, to a human reviewer.
- For browser or Computer Use acceptance, make at most three attempts to resolve the same issue. If it remains unresolved after the third attempt, stop and document the observed state and hand it to a human reviewer.
- Continue to run appropriate automated checks; these limits apply to complex manual acceptance, not local tests, type checks, lint, formatting, or builds.
