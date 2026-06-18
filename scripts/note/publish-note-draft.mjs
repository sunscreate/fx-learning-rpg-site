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

async function uploadThumbnail(page, entry) {
  if (!entry?.thumbnail) return;

  const existingEyecatch = page.locator('img[alt="eyecatch"], img[alt="見出し画像"]').first();
  if ((await existingEyecatch.count()) > 0) return;

  const thumbnailPath = path.resolve(ROOT, entry.thumbnail);
  const labeledImageButton = page.locator('button[aria-label="画像を追加"]').first();
  const imageButton =
    (await labeledImageButton.count()) > 0
      ? labeledImageButton
      : page.locator("button").filter({ hasText: "画像を追加" }).first();
  try {
    await imageButton.waitFor({ timeout: 60000 });
  } catch (error) {
    const visibleText = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(-2000);
    throw new Error(`Thumbnail button was not found at ${page.url()}. Visible text: ${visibleText}`, {
      cause: error,
    });
  }

  const fileChooserPromise = page.waitForEvent("filechooser");
  await imageButton.click({ force: true });
  const uploadButton = page.locator("button").filter({ hasText: "画像をアップロード" }).first();
  await uploadButton.waitFor({ timeout: 60000 });
  await uploadButton.click({ force: true });
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(thumbnailPath);

  const cropModal = page.locator(".CropModal__overlay");
  await cropModal.waitFor({ timeout: 60000 });
  const saveButton = cropModal.locator("button").filter({ hasText: "保存" });
  await saveButton.waitFor({ timeout: 60000 });
  let saveEnabled = false;
  for (let attempt = 0; attempt < 120 && !saveEnabled; attempt += 1) {
    saveEnabled = await saveButton.isEnabled();
    if (!saveEnabled) await page.waitForTimeout(500);
  }
  if (!saveEnabled) throw new Error("Thumbnail upload did not become ready to save.");
  let cropSaved = false;
  for (let attempt = 0; attempt < 3 && !cropSaved; attempt += 1) {
    await saveButton.click({ force: attempt > 0 });
    try {
      await cropModal.waitFor({ state: "hidden", timeout: 20000 });
      cropSaved = true;
    } catch {
      if (attempt === 2) {
        const modalText = (await cropModal.innerText()).replace(/\s+/g, " ").trim();
        throw new Error(`Thumbnail crop modal did not close after save. Modal text: ${modalText}`);
      }
    }
  }
  await page.waitForTimeout(3000);
}

function getPublicUrl(url) {
  const match = url.match(/note\.com\/([^/]+)\/n\/([^/?#]+)/);
  if (match) return `https://note.com/${match[1]}/n/${match[2]}`;

  const editorMatch = url.match(/editor\.note\.com\/notes\/([^/?#]+)/);
  if (editorMatch) return `https://note.com/hearty_tapir5661/n/${editorMatch[1]}`;

  return url;
}

function getEditorUrl(url) {
  const editorMatch = url.match(/editor\.note\.com\/notes\/([^/?#]+)/);
  if (editorMatch) return `https://editor.note.com/notes/${editorMatch[1]}/edit/`;

  const publicMatch = url.match(/note\.com\/[^/]+\/n\/([^/?#]+)/);
  if (publicMatch) return `https://editor.note.com/notes/${publicMatch[1]}/edit/`;

  return url;
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
    return;
  }

  const editLink = page.locator("a").filter({ hasText: "編集" });
  if ((await editLink.count()) === 1) {
    await editLink.click({ force: true });
    await page.waitForTimeout(5000);
    return;
  }

  const settingsButton = page.locator("button").filter({ hasText: "設定する" });
  if ((await settingsButton.count()) === 1) {
    await settingsButton.click({ force: true });
    await page.waitForTimeout(500);

    if (page.url().includes("editor.note.com")) {
      await page.waitForTimeout(5000);
      return;
    }

    const editControl = page.getByText("編集", { exact: true });
    if ((await editControl.count()) === 1) {
      await editControl.click({ force: true });
      await page.waitForTimeout(5000);
      return;
    }
  }

  const controls = await page.locator("button:visible, a:visible").allInnerTexts();
  const editorLinks = await page.locator('a[href*="editor.note.com"]').evaluateAll((links) =>
    links.map((link) => ({ text: link.textContent?.trim(), href: link.href })),
  );
  console.log(`Edit controls not found. Visible controls: ${controls.filter(Boolean).join(" | ")}`);
  console.log(`Editor links: ${JSON.stringify(editorLinks)}`);
}

async function configurePublishSettings(page, entry) {
  if (entry?.visibility !== "members_only") return;

  const membershipButton = page.locator("button[role='checkbox']").filter({ hasText: "メンバーシップ" });
  await membershipButton.waitFor({ timeout: 60000 });

  const isChecked = await membershipButton.getAttribute("aria-checked");
  if (isChecked !== "true") {
    await membershipButton.click({ force: true });
    await page.waitForTimeout(1000);
  }

  const added = await page.evaluate(() =>
    [...document.querySelectorAll("button")].some((button) => {
      const rowText = button.parentElement?.parentElement?.textContent?.replace(/\s+/g, "");
      return button.textContent?.trim() === "追加済" && rowText?.includes("メンバー全員に公開");
    }),
  );

  if (!added) {
    await page.evaluate(() => {
      const target = [...document.querySelectorAll("button")].find((button) => {
        const rowText = button.parentElement?.parentElement?.textContent?.replace(/\s+/g, "");
        return button.textContent?.trim() === "追加" && rowText?.includes("メンバー全員に公開");
      });

      if (!target) throw new Error("Membership all-members add button was not found.");
      target.click();
    });
    await page.waitForTimeout(2000);
  }

  const trialButton = page.locator("button").filter({ hasText: "試し読みエリアを設定" }).first();
  if ((await trialButton.count()) > 0) {
    await trialButton.click({ force: true });
    await page.waitForTimeout(3000);
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
  const targetEntry = (ledger.posted || []).find(
    (entry) => (typeof file === "string" && entry.file === file) || entry.noteUrl === publicUrl,
  );
  const context = await chromium.launchPersistentContext(PROFILE_DIR, { headless: false, channel: "chrome" });
  const page = await context.newPage();

  await openDraft(page, getEditorUrl(targetUrl));

  if (!page.url().includes("editor.note.com")) {
    const text = await page.locator("body").innerText();
    if (!text.includes("これは公開前の下書きです")) {
      console.log(`Already public: ${publicUrl}`);
      await context.close();
      return;
    }
  }

  await uploadThumbnail(page, targetEntry);

  const proceedButton = page.locator("button").filter({ hasText: "公開に進む" });
  if ((await proceedButton.count()) === 1) {
    const savedIndicator = page.getByText("下書きを保存しました", { exact: true });
    if ((await savedIndicator.count()) > 0) {
      await savedIndicator.last().waitFor({ timeout: 60000 });
    }

    let reachedPublishSettings = false;
    for (let attempt = 0; attempt < 3 && !reachedPublishSettings; attempt += 1) {
      await proceedButton.click({ force: true });
      try {
        await page.waitForURL(/\/publish\/?$/, { timeout: 20000 });
        reachedPublishSettings = true;
      } catch {
        await page.waitForTimeout(1000);
      }
    }
    if (!reachedPublishSettings) {
      throw new Error(`Publish settings did not open from ${page.url()}.`);
    }
  }

  await configurePublishSettings(page, targetEntry);

  const postButton = page.getByRole("button", { name: /^(投稿|公開|更新)する$/ }).first();
  try {
    await postButton.waitFor({ timeout: 60000 });
  } catch (error) {
    const visibleButtons = await page.locator("button:visible").allInnerTexts();
    const visibleText = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(-2000);
    throw new Error(
      `Final publish button was not found at ${page.url()}. Visible buttons: ${visibleButtons.join(" | ")}. ` +
        `Visible text: ${visibleText}`,
      { cause: error },
    );
  }
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
