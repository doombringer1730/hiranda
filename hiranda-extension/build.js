import * as esbuild from 'esbuild'
import { copyFileSync, mkdirSync, cpSync, existsSync } from 'fs'

const watch = process.argv.includes('--watch')

const sharedDefines = {
  'process.env.NODE_ENV': '"production"',
}

const builds = [
  {
    entryPoints: ['src/background/service-worker.js'],
    outfile: 'dist/service-worker.js',
    format: 'esm',
    platform: 'browser',
  },
  {
    entryPoints: ['src/content/base.js'],
    outfile: 'dist/base.js',
    format: 'iife',
    platform: 'browser',
  },
  {
    entryPoints: ['src/content/chat.js'],
    outfile: 'dist/chat.js',
    format: 'iife',
    platform: 'browser',
  },
  {
    entryPoints: ['src/content/netflix-main.js'],
    outfile: 'dist/netflix-main.js',
    format: 'iife',
    platform: 'browser',
  },
  {
    entryPoints: ['src/content/youtube-main.js'],
    outfile: 'dist/youtube-main.js',
    format: 'iife',
    platform: 'browser',
  },
]

const baseConfig = {
  bundle: true,
  define: sharedDefines,
  minify: false,
  sourcemap: false,
}

mkdirSync('dist', { recursive: true })
mkdirSync('dist/popup', { recursive: true })
mkdirSync('dist/icons', { recursive: true })

if (watch) {
  const contexts = await Promise.all(
    builds.map(b => esbuild.context({ ...baseConfig, ...b }))
  )
  await Promise.all(contexts.map(c => c.watch()))
  console.log('Watching for changes...')
} else {
  await Promise.all(builds.map(b => esbuild.build({ ...baseConfig, ...b })))

  // Copy static files
  copyFileSync('manifest.json', 'dist/manifest.json')
  cpSync('src/popup', 'dist/popup', { recursive: true })
  if (existsSync('icons')) cpSync('icons', 'dist/icons', { recursive: true })
  if (existsSync('img')) cpSync('img', 'dist/img', { recursive: true })

  console.log('✅ Build complete → dist/')
}
