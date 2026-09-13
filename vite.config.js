import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Fills the share image and social links into index.html's raw HTML (meta tags +
// JSON-LD) from src/generated/meta.json, which scripts/build-content.mjs writes
// from content/site.json before every dev/build run. Crawlers and link previews
// read this raw HTML, so these can't be set from React at runtime.
function contentMeta() {
  return {
    name: 'nirmal-content-meta',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const meta = JSON.parse(fs.readFileSync(new URL('./src/generated/meta.json', import.meta.url), 'utf8'))
        if (!meta.shareImage) throw new Error('content: no share image resolved — check site.json homepage.shareImage')
        // Functions (not strings) so a "$&" in a URL isn't treated as a pattern;
        // "<" escaped so a link can never close the JSON-LD <script> tag.
        const sameAs = JSON.stringify(meta.sameAs).replaceAll('<', '\\u003c')
        const shareImage = meta.shareImage.replaceAll('"', '%22').replaceAll('<', '%3C')
        return html.replaceAll('__NIRMAL_SHARE_IMAGE__', () => shareImage).replaceAll('__NIRMAL_SAME_AS__', () => sameAs)
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), contentMeta()],
})
