import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LEDGER_PATH = path.join(ROOT, "content/note-automation/posted-ledger.json");
const PROFILE_DIR = path.join(ROOT, ".note-browser-profile");
const NOTE_NEW_URL = "https://note.com/notes/new";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = true] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const file = args.get("file");
const publish = args.get("publish") === true || args.get("publish") === "true";

if (!file || typeof file !== "string") {
  console.error("Usage: npm run note:post -- --file=content/note-automation/drafts/example.md");
  process.exit(1);
}

function parseTitle(markdown) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || "FX Quest Guild 限定QUEST";
}

function getNoteUrl(url) {
  const match = url.match(/editor\.note\.com\/notes\/([^/]+)\//);
  if (!match) return null;
  return `https://note.com/hearty_tapir5661/n/${match[1]}`;
}

async function configurePublishSettings(page, entry) {
  if (entry?.visibility === "members_only") {
    const membershipButton = page.locator("button[role='checkbox']").filter({ hasText: "メンバーシップ" });
    await membershipButton.waitFor({ timeout: 60000 });

    const isChecked = await membershipButton.getAttribute("aria-checked");
    if (isChecked !== "true") {
      await membershipButton.click({ force: true });
      await page.waitForTimeout(1000);
    }

    const addButton = page.locator("button").filter({ hasText: "追加" });
    if ((await addButton.count()) === 1) {
      await addButton.click({ force: true });
      await page.waitForTimeout(2000);
    }
  }
}

async function loadLedger() {
  try {
    return JSON.parse(await readFile(LEDGER_PATH, "utf8"));
  } catch {
    return { generated: [], posted: [] };
  }
}

async function main() {
  const fullPath = path.resolve(ROOT, file);
  const markdown = await readFile(fullPath, "utf8");
  const title = parseTitle(markdown);

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("Playwright is not installed. Run `npm install` first, then retry.");
    console.error("Fallback: open the generated Markdown and paste it into note manually.");
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext(PROFILE_DIR, { headless: false });
  const page = await context.newPage();
  await page.goto(NOTE_NEW_URL, { waitUntil: "domcontentloaded" });

  console.log("Opened note editor. If login is required, log in in the opened browser, then rerun this command.");

  if (page.url().includes("/login")) {
    console.log("note login is required. Log in in the opened browser window. This command will continue after login.");
    await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 10 * 60 * 1000 });
    await page.goto(NOTE_NEW_URL, { waitUntil: "domcontentloaded" });
  }

  const titleInput = page.getByPlaceholder("タイトル");
  await titleInput.waitFor({ timeout: 60000 });
  await titleInput.fill(title);

  const editor = page.locator("[contenteditable='true']").last();
  await editor.waitFor({ timeout: 60000 });
  await editor.fill(markdown.replace(/^#\s+.+\n+/, ""));

  const ledger = await loadLedger();
  const generatedEntry = (ledger.generated || []).find((entry) => entry.file === file);
  let publishedNoteUrl = null;

  if (publish) {
    if (generatedEntry?.visibility && !["public", "members_only"].includes(generatedEntry.visibility)) {
      throw new Error(`Refusing to auto-publish ${generatedEntry.visibility} as a free public note.`);
    }

    const proceedButton = page.locator("button").filter({ hasText: "公開に進む" });
    await proceedButton.waitFor({ timeout: 60000 });
    await proceedButton.click({ force: true });
    await page.waitForTimeout(5000);

    const noteUrl = getNoteUrl(page.url());
    publishedNoteUrl = noteUrl;
    await configurePublishSettings(page, generatedEntry);

    const postButton = page.locator("button").filter({ hasText: "投稿する" });
    await postButton.waitFor({ timeout: 60000 });
    await postButton.click({ force: true });
    await page.waitForTimeout(10000);

    if (noteUrl) {
      const verifyPage = await context.newPage();
      await verifyPage.goto(noteUrl, { waitUntil: "domcontentloaded" });
      await verifyPage.waitForTimeout(3000);
      const bodyText = await verifyPage.locator("body").innerText();
      if (bodyText.includes("これは公開前の下書きです")) {
        throw new Error("Publish verification failed: draft notice is still visible.");
      }
    }
  }

  if (generatedEntry) {
    const postedAt = new Date().toISOString();
    const noteUrl = publishedNoteUrl || getNoteUrl(page.url());
    const nextLedger = {
      generated: (ledger.generated || []).filter((entry) => entry.file !== file),
      posted: [
        ...(ledger.posted || []),
        {
          ...generatedEntry,
          postedAt,
          postedMode: publish ? "browser_published" : "browser_draft_filled",
          ...(noteUrl ? { noteUrl } : {}),
          ...(publish ? { publishedAt: postedAt } : {}),
        },
      ],
    };
    await writeFile(LEDGER_PATH, `${JSON.stringify(nextLedger, null, 2)}\n`, "utf8");
  }

  console.log(`Filled note draft: ${title}`);
  console.log("Review the editor and publish from note when ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
