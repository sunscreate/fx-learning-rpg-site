import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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

  if (!targetUrl && typeof file === "string") {
    const entry = (ledger.posted || []).find((item) => item.file === file);
    targetUrl = entry?.noteUrl;
  }

  if (typeof targetUrl !== "string") {
    console.error("No note URL found. Pass --url or use a ledger entry with noteUrl.");
    process.exit(1);
  }

  const publicUrl = getPublicUrl(targetUrl);
  const context = await chromium.launchPersistentContext(PROFILE_DIR, { headless: false });
  const page = await context.newPage();

  await openDraft(page, publicUrl);

  if (!page.url().includes("editor.note.com")) {
    const text = await page.locator("body").innerText();
    if (!text.includes("これは公開前の下書きです")) {
      console.log(`Already public: ${publicUrl}`);
      await context.close();
      return;
    }
  }

  const proceedButton = page.locator("button").filter({ hasText: "公開に進む" });
  if ((await proceedButton.count()) === 1) {
    await proceedButton.click({ force: true });
    await page.waitForTimeout(5000);
  }

  const postButton = page.locator("button").filter({ hasText: "投稿する" });
  await postButton.waitFor({ timeout: 60000 });
  await postButton.click({ force: true });
  await page.waitForTimeout(10000);

  const verifyPage = await context.newPage();
  await verifyPage.goto(publicUrl, { waitUntil: "domcontentloaded" });
  await verifyPage.waitForTimeout(3000);
  const bodyText = await verifyPage.locator("body").innerText();

  if (bodyText.includes("これは公開前の下書きです")) {
    throw new Error("Publish verification failed: draft notice is still visible.");
  }

  const now = new Date().toISOString();
  const nextLedger = {
    generated: ledger.generated || [],
    posted: (ledger.posted || []).map((entry) => {
      if ((typeof file === "string" && entry.file === file) || entry.noteUrl === publicUrl) {
        return {
          ...entry,
          noteUrl: publicUrl,
          postedMode: "browser_published",
          publishedAt: now,
        };
      }
      return entry;
    }),
  };

  await writeFile(LEDGER_PATH, `${JSON.stringify(nextLedger, null, 2)}\n`, "utf8");
  await context.close();
  console.log(`Published note: ${publicUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
