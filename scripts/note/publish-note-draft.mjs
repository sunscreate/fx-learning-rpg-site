import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getChromePersistentContextOptions } from "./playwright-launch-options.mjs";

const ROOT = process.cwd();
const LEDGER_PATH = path.join(ROOT, "content/note-automation/posted-ledger.json");
const PROFILE_DIR = path.join(ROOT, ".note-browser-profile");

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = true] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const noteUrl = args.get("url");
const file = args.get("file");

if (typeof noteUrl !== "string" && typeof file !== "string") {
  console.error("Usage: npm run note:publish -- --url=https://note.com/<user>/n/<id>");
  process.exit(1);
}

async function loadLedger() {
  try {
    return JSON.parse(await readFile(LEDGER_PATH, "utf8"));
  } catch {
    return { generated: [], posted: [] };
  }
}

function getPublicUrl(url) {
  const match = url.match(/note\.com\/([^/]+)\/n\/([^/?#]+)/);
  if (!match) return url;
  return `https://note.com/${match[1]}/n/${match[2]}`;
}

function normalizeLedgerFile(filePath) {
  if (typeof filePath !== "string") return null;
  return path.relative(ROOT, path.resolve(ROOT, filePath));
}

function sameEntryFile(entry, targetFile) {
  return entry.file === targetFile || entry.file === normalizeLedgerFile(targetFile);
}

function extractMarkdownLinks(markdown) {
  if (typeof markdown !== "string") return [];
  return [...markdown.matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g)].map((match) => match[1]);
}

async function verifyPublishedNote(context, publicUrl, markdown, generatedEntry) {
  const verifyPage = await context.newPage();
  await verifyPage.goto(publicUrl, { waitUntil: "domcontentloaded" });
  await verifyPage.waitForTimeout(3000);

  const contentScope =
    (await verifyPage.locator("article, main").count()) > 0
      ? verifyPage.locator("article, main").first()
      : verifyPage.locator("body");
  const bodyText = await contentScope.innerText();

  if (bodyText.includes("これは公開前の下書きです")) {
    throw new Error("Publish verification failed: draft notice is still visible.");
  }
  if (bodyText.includes("## ") || bodyText.includes("### ")) {
    throw new Error("Publish verification failed: raw Markdown headings are visible.");
  }

  const expectedLinks = extractMarkdownLinks(markdown);
  const pageLinks = await contentScope.locator("a[href]").evaluateAll((links) => links.map((link) => link.href));
  const missingLinks = expectedLinks.filter((expected) => !pageLinks.some((href) => href === expected));
  if (missingLinks.length > 0) {
    throw new Error(`Publish verification failed: links were not rendered as links: ${missingLinks.join(", ")}`);
  }

  const ogImage = await verifyPage.locator('meta[property="og:image"]').getAttribute("content");
  if (!ogImage) {
    throw new Error("Publish verification failed: og:image was not found.");
  }

  const visibleImages = await contentScope.locator("img").evaluateAll((images) =>
    images
      .filter(
        (image) =>
          (image.currentSrc || image.src) &&
          image.naturalWidth > 0 &&
          image.naturalHeight > 0 &&
          Boolean(image.offsetWidth || image.offsetHeight || image.getClientRects().length),
      )
      .map((image) => ({
        src: image.currentSrc || image.src,
        alt: image.alt || "",
      })),
  );

  if (visibleImages.length === 0) {
    throw new Error("Publish verification failed: visible note thumbnail was not found.");
  }
  if (generatedEntry?.chartImage) {
    const visibleBodyImages = visibleImages.filter(
      (image) =>
        (image.currentSrc || image.src) &&
        !image.alt.includes("見出し") &&
        !image.src.includes("default_profile") &&
        !image.src.startsWith("data:"),
    );
    if (visibleBodyImages.length === 0) {
      throw new Error("Publish verification failed: generated chart image is not visible in the article body.");
    }
  }

  await verifyPage.close();
}

function buildPublishedLedger(ledger, publicUrl, targetFile, generatedEntry) {
  const normalizedFile = normalizeLedgerFile(targetFile);
  const now = new Date().toISOString();
  const nextGenerated = (ledger.generated || []).filter((entry) => !normalizedFile || !sameEntryFile(entry, normalizedFile));
  let updated = false;
  const posted = (ledger.posted || []).map((entry) => {
    if ((normalizedFile && sameEntryFile(entry, normalizedFile)) || entry.noteUrl === publicUrl) {
      updated = true;
      return {
        ...entry,
        noteUrl: publicUrl,
        postedMode: "browser_published",
        thumbnailSet: entry.thumbnailSet ?? Boolean(entry.thumbnail || generatedEntry?.thumbnail),
        qualityChecked: true,
        publishedAt: entry.publishedAt || now,
        postedAt: entry.postedAt || now,
      };
    }
    return entry;
  });

  if (!updated) {
    posted.push({
      ...(generatedEntry || {}),
      ...(normalizedFile ? { file: normalizedFile } : {}),
      postedAt: now,
      postedMode: "browser_published",
      thumbnailSet: Boolean(generatedEntry?.thumbnail),
      qualityChecked: true,
      noteUrl: publicUrl,
      publishedAt: now,
    });
  }

  return { generated: nextGenerated, posted };
}

async function openDraft(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  if (page.url().includes("/login")) {
    console.log("note login is required. Log in in the opened browser window. This command will continue after login.");
    await page.waitForURL((nextUrl) => !nextUrl.href.includes("/login"), { timeout: 10 * 60 * 1000 });
    await page.goto(url, { waitUntil: "domcontentloaded" });
  }

  if (page.url().includes("editor.note.com")) return;

  const editButton = page.locator("button").filter({ hasText: "編集" });
  if ((await editButton.count()) === 1) {
    await editButton.click({ force: true });
    await page.waitForTimeout(5000);
  }
}

async function main() {
  const { chromium } = await import("playwright");
  const ledger = await loadLedger();

  let targetUrl = noteUrl;
  const normalizedFile = normalizeLedgerFile(file);
  const generatedEntry =
    typeof file === "string" ? (ledger.generated || []).find((entry) => sameEntryFile(entry, normalizedFile)) : null;
  const markdown =
    typeof normalizedFile === "string" ? await readFile(path.join(ROOT, normalizedFile), "utf8").catch(() => "") : "";

  if (!targetUrl && typeof file === "string") {
    const entry = (ledger.posted || []).find((item) => sameEntryFile(item, file));
    targetUrl = entry?.noteUrl;
  }

  if (typeof targetUrl !== "string") {
    console.error("No note URL found. Pass --url or use a ledger entry with noteUrl.");
    process.exit(1);
  }

  const publicUrl = getPublicUrl(targetUrl);
  const context = await chromium.launchPersistentContext(
    PROFILE_DIR,
    getChromePersistentContextOptions({ headless: false }),
  );
  const page = await context.newPage();

  await openDraft(page, publicUrl);

  let alreadyPublic = false;
  if (!page.url().includes("editor.note.com")) {
    const text = await page.locator("body").innerText();
    if (!text.includes("これは公開前の下書きです")) {
      console.log(`Already public: ${publicUrl}`);
      alreadyPublic = true;
    }
  }

  if (!alreadyPublic) {
    const proceedButton = page.locator("button").filter({ hasText: "公開に進む" });
    if ((await proceedButton.count()) === 1) {
      await proceedButton.click({ force: true });
      await page.waitForTimeout(5000);
    }

    const postButton = page.locator("button").filter({ hasText: /^(投稿する|更新する)$/ });
    await postButton.first().waitFor({ timeout: 60000 });
    await postButton.first().click({ force: true });
    await page.waitForTimeout(10000);
  }

  await verifyPublishedNote(context, publicUrl, markdown, generatedEntry);

  const nextLedger = buildPublishedLedger(ledger, publicUrl, normalizedFile, generatedEntry);

  await writeFile(LEDGER_PATH, `${JSON.stringify(nextLedger, null, 2)}\n`, "utf8");
  await context.close();
  console.log(`Published note: ${publicUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
