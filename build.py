#!/usr/bin/env python3
"""Build Flag Ref from the single source src/app.html.

  site/            -> standalone PWA, served by GitHub Pages from docs/ (index.html, manifest, sw.js, icons)
  flag-ref.html    -> body-only copy for the Claude artifact (the viewer supplies <head>)
"""
import re, pathlib
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).parent
SRC = (ROOT / 'src' / 'app.html').read_text()
VERSION = re.search(r'const VERSION = (\d+);', SRC).group(1)

# ---- artifact copy (unchanged body)
(ROOT / 'flag-ref.html').write_text(SRC)

# ---- split the source: leading head-ish tags, <style>, then body
i = SRC.index('<style>'); j = SRC.index('</style>') + len('</style>')
leading, style, body = SRC[:i], SRC[i:j], SRC[j:]
leading = leading.replace('<meta name="theme-color" content="#002145">', '')  # set below

head = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
<meta name="theme-color" content="#002145">
<meta name="description" content="Scoreboard, game clock and quick rules for refereeing UBC Point Grey Cup flag football.">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
{leading.strip()}
<style>
  [hidden] {{ display: none !important; }}
  img {{ max-width: 100%; }}
</style>
{style}
</head>
<body>
<script>
  // Offline support: the service worker caches the app shell; index.html is fetched network-first.
  if ('serviceWorker' in navigator) {{ navigator.serviceWorker.register('sw.js').then(() => {{ window.__swReady = true; }}).catch(() => {{}}); }}
</script>
{body.strip()}
</body>
</html>
'''
site = ROOT / 'docs'
(site / 'index.html').write_text(head)

(site / 'manifest.webmanifest').write_text(f'''{{
  "name": "Flag Ref",
  "short_name": "Flag Ref",
  "description": "Scoreboard, clock and quick rules for UBC Point Grey Cup flag football refs.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#001A38",
  "theme_color": "#002145",
  "icons": [
    {{ "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" }},
    {{ "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }}
  ]
}}
''')

(site / 'sw.js').write_text(f'''// Flag Ref service worker — v{VERSION}
const CACHE = 'flagref-v{VERSION}';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => {{
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
}});
self.addEventListener('activate', (e) => {{
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
}});
self.addEventListener('fetch', (e) => {{
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !isFont) return;
  if (isFont) {{
    // fonts: cache-first (they never change for a given URL)
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {{ const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; }}).catch(() => hit)));
    return;
  }}
  // app shell: network-first so a cold launch online always gets the newest version; cache when offline
  e.respondWith(fetch(req).then((res) => {{ const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; }})
    .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))));
}});
''')

# ---- icons: UBC-blue tile, white pole, yellow + blue flags (same mark as the header lockup)
def icon(size, path, radius_frac=0.22):
    im = Image.new('RGBA', (size, size), (0, 33, 69, 255))
    d = ImageDraw.Draw(im)
    s = size / 44.0   # the lockup SVG is drawn on a 44-unit grid
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_frac), fill=(0, 33, 69, 255))
    d.rounded_rectangle([4 * s, 4 * s, 40 * s, 40 * s], radius=int(9 * s), fill=(10, 52, 104, 255))
    d.line([(13 * s, 9 * s), (13 * s, 36 * s)], fill=(255, 255, 255, 255), width=max(2, int(3 * s)))
    d.polygon([(15 * s, 10 * s), (31 * s, 10 * s), (27 * s, 16 * s), (31 * s, 22 * s), (15 * s, 22 * s)], fill=(255, 199, 44, 255))
    d.polygon([(15 * s, 23 * s), (28 * s, 23 * s), (25 * s, 28 * s), (28 * s, 33 * s), (15 * s, 33 * s)], fill=(0, 85, 183, 255))
    im.save(path)
icon(512, site / 'icons' / 'icon-512.png')
icon(192, site / 'icons' / 'icon-192.png')
icon(180, site / 'icons' / 'apple-touch-icon.png', radius_frac=0)   # iOS rounds it itself

print('built v' + VERSION, 'site:', sorted(p.name for p in site.iterdir()))
