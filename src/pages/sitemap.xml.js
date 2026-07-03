import { getCollection } from "astro:content";

export async function GET() {
  const base = "https://sunscreate.github.io/fx-learning-rpg-site";

  const collections = [
    "basic",
    "chart",
    "entry",
    "technical",
    "risk",
    "mental",
    "market",
    "fundamental",
    "analysis",
    "style",
    "advanced",
    "operation",
    "ea",
    "glossary",
  ];

  const urls = [];

  urls.push(`${base}/`);
  urls.push(`${base}/category/`);
  urls.push(`${base}/tag/`);
  urls.push(`${base}/search/`);
  urls.push(`${base}/fx-broker-checklist/`);

  for (let i = 1; i <= 12; i++) {
    urls.push(`${base}/level/${i}/`);
  }

  for (const collection of collections) {
    const posts = await getCollection(collection);

    posts.forEach((post) => {
      const slug = post.slug || post.id?.replace(/\.md$/, "");

      if (slug && !/-\d+$/.test(slug)) {
        urls.push(`${base}/category/${collection}/${slug}/`);
      }

      (post.data.tags || [])
        .filter(Boolean)
        .forEach((tag) => {
          urls.push(
            `${base}/tag/${encodeURIComponent(String(tag).toLowerCase())}/`
          );
        });
    });
  }

  const uniqueUrls = [...new Set(urls)].filter(
    (url) => !url.includes("undefined")
  );

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueUrls
  .map(
    (url) => `  <url>
    <loc>${url}</loc>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
