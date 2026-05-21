import { build, context } from 'esbuild'
import { cpSync, mkdirSync, writeFileSync } from 'fs'
import { deflateSync } from 'zlib'

const watching = process.argv.includes('--watch')

for (const dir of ['dist', 'dist/background', 'dist/content', 'dist/popup', 'dist/icons']) {
  mkdirSync(dir, { recursive: true })
}

// Bundle service worker (needs @supabase/supabase-js)
const buildOptions = {
  entryPoints: ['src/background/service-worker.js'],
  bundle: true,
  outfile: 'dist/background/service-worker.js',
  format: 'esm',
  platform: 'browser',
  target: 'chrome120',
  minify: !watching,
}

if (watching) {
  const ctx = await context(buildOptions)
  await ctx.watch()
  console.log('Watching for changes…')
} else {
  await build(buildOptions)
}

// Copy files that need no bundling
for (const [src, dest] of [
  ['src/manifest.json',         'dist/manifest.json'],
  ['src/content/base.js',       'dist/content/base.js'],
  ['src/content/youtube.js',    'dist/content/youtube.js'],
  ['src/content/netflix.js',    'dist/content/netflix.js'],
  ['src/content/disney.js',     'dist/content/disney.js'],
  ['src/content/prime.js',      'dist/content/prime.js'],
  ['src/content/max.js',        'dist/content/max.js'],
  ['src/content/hulu.js',       'dist/content/hulu.js'],
  ['src/content/appletv.js',    'dist/content/appletv.js'],
  ['src/content/paramount.js',  'dist/content/paramount.js'],
  ['src/content/chat-overlay.js', 'dist/content/chat-overlay.js'],
  ['src/popup/popup.html',      'dist/popup/popup.html'],
  ['src/popup/popup.js',        'dist/popup/popup.js'],
  ['src/popup/popup.css',       'dist/popup/popup.css'],
]) {
  cpSync(src, dest)
}

// Generate amber PNG icons (rgb 245, 158, 11 = amber-500)
function crc32(buf) {
  const t = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  let c = 0xFFFFFFFF
  for (const b of buf) c = t[(c ^ b) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function makeChunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

function makePNG(size, r, g, b) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2 // 8-bit RGB
  const row = Buffer.alloc(1 + size * 3)
  for (let x = 0; x < size; x++) { row[1+x*3]=r; row[2+x*3]=g; row[3+x*3]=b }
  const raw = Buffer.concat(Array.from({ length: size }, () => row))
  return Buffer.concat([sig, makeChunk('IHDR', ihdr), makeChunk('IDAT', deflateSync(raw)), makeChunk('IEND', Buffer.alloc(0))])
}

for (const size of [16, 48, 128]) {
  writeFileSync(`dist/icons/${size}.png`, makePNG(size, 245, 158, 11))
}

if (!watching) console.log('✓ Build complete → dist/')
