<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# The Theater is sandboxed

Watch-together sync lives in `src/app/(theater)/` and `src/theater/` — read
`src/theater/README.md` before touching it. ESLint enforces the fence both
ways: Theater code imports nothing from `@/lib`, `@/components` or `@/app`, and
app code imports only `@/theater/public`.
