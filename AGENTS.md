<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# The Theater is sandboxed

Watch-together sync lives in `src/app/(theater)/` and `src/theater/` — read
`src/theater/README.md` before touching it. ESLint enforces the fence both
ways: Theater code imports nothing from `@/lib`, `@/components` or `@/app`, and
app code imports only `@/theater/public`.

# The live database is hands-off

Nothing touches the live Supabase project without the owner's go-ahead in the
current session: not SQL (`execute_sql`), not migrations (`apply_migration`),
not even read-only queries. Test SQL on a throwaway local Postgres first. Never
pre-approve those tools in a committed `.claude/settings.json` (CI rejects it);
a personal allowlist goes in `.claude/settings.local.json`, which is ignored.
