// PWA Manifest Handler
export function getManifest() {
  const manifest = {
    name: "Memos - Modern Notes",
    short_name: "Memos",
    description: "A modern notes app with calendar, tags, and markdown support",
    start_url: "/",
    display: "standalone",
    background_color: "#0f0f1a",
    theme_color: "#6366f1",
    icons: [
      {
        src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📝</text></svg>",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable"
      }
    ],
    categories: ["productivity", "utilities"]
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    }
  });
}