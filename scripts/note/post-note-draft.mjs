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

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(markdown) {
  return escapeHtml(markdown)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToNoteHtml(markdown) {
  const body = markdown.replace(/^#\s+.+\n+/, "").trim();
  const blocks = body.split(/\n{2,}/);

  return blocks
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) return "";

      if (lines[0].startsWith("## ")) {
        return `<h2>${renderInline(lines[0].replace(/^##\s+/, ""))}</h2>`;
      }

      if (lines.every((line) => line.startsWith("- "))) {
        return `<ul>${lines
          .map((line) => `<li>${renderInline(line.replace(/^-\s+/, ""))}</li>`)
          .join("")}</ul>`;
      }

      return `<p>${lines.map(renderInline).join("<br>")}</p>`;
    })
    .filter(Boolean)
    .join("");
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

async function uploadThumbnail(page, entry) {
  if (!entry?.thumbnail) {
    throw new Error("Refusing to publish without a generated note thumbnail.");
  }

  const thumbnailPath = path.resolve(ROOT, entry.thumbnail);
  const imageButton = page.locator("button").filter({ hasText: "画像を追加" }).first();
  await imageButton.waitFor({ timeout: 60000 });

  const fileChooserPromise = page.waitForEvent("filechooser");
  await imageButton.click({ force: true });
  const uploadButton = page.locator("button").filter({ hasText: "画像をアップロード" }).first();
  await uploadButton.waitFor({ timeout: 60000 });
  await uploadButton.click({ force: true });
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(thumbnailPath);

  const saveButton = page.locator("button").filter({ hasText: "保存" }).last();
  await saveButton.waitFor({ timeout: 60000 });
  await saveButton.click({ force: true });
  await page.waitForTimeout(3000);
}

async function insertChartImage(page, entry) {
  if (!entry?.chartImage) return;

  const chartPath = path.resolve(ROOT, entry.chartImage);
  const chartBuffer = await readFile(chartPath);
  const chartBase64 = chartBuffer.toString("base64");
  const editor = page.locator("[contenteditable='true']").last();

  await editor.evaluate((element) => {
    element.focus();
    const paragraphs = element.querySelectorAll("p");
    const target = paragraphs[Math.min(1, Math.max(0, paragraphs.length - 1))] || element;
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });

  await page.evaluate(async ({ base64 }) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const file = new File([bytes], "usdjpy-learning-chart.png", { type: "image/png" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const target = document.activeElement;
    target?.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer }));
  }, { base64: chartBase64 });

  await page.waitForTimeout(5000);

  const bodyImageCount = await editor.locator("img").count();
  if (bodyImageCount === 0) {
    throw new Error("Chart image insertion could not be verified in the note body.");
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

  const context = await chromium.launchPersistentContext(PROFILE_DIR, { headless: false, channel: "chrome" });
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
  await page.evaluate((html) => {
    const editables = [...document.querySelectorAll("[contenteditable='true']")];
    const bodyEditor =
      editables.find((element) => element.className?.toString().includes("ProseMirror")) ||
      editables[editables.length - 1];

    bodyEditor.focus();
    const range = document.createRange();
    range.selectNodeContents(bodyEditor);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("delete", false);
    document.execCommand("insertHTML", false, html);
    bodyEditor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertHTML" }));
    bodyEditor.dispatchEvent(new Event("change", { bubbles: true }));
  }, markdownToNoteHtml(markdown));

  const ledger = await loadLedger();
  const generatedEntry = (ledger.generated || []).find((entry) => entry.file === file);
  let publishedNoteUrl = null;

  await insertChartImage(page, generatedEntry);
  await uploadThumbnail(page, generatedEntry);

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

  await context.close();

  console.log(publish ? `Published note: ${publishedNoteUrl || title}` : `Filled note draft: ${title}`);
  if (!publish) console.log("Review the editor and publish from note when ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
