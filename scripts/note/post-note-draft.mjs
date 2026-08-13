import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getChromePersistentContextOptions } from "./playwright-launch-options.mjs";

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

function stripTitle(markdown) {
  return markdown.replace(/^#\s+.+\n+/, "").trim();
}

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdownToHtml(input) {
  const escaped = escapeHtml(input);
  return escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, text, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
}

function markdownToHtml(markdown) {
  const lines = stripTitle(markdown).split("\n");
  const blocks = [];
  let listItems = [];
  let orderedItems = [];

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${inlineMarkdownToHtml(item)}</li>`).join("")}</ul>`);
    listItems = [];
  }

  function flushOrderedList() {
    if (orderedItems.length === 0) return;
    blocks.push(`<ol>${orderedItems.map((item) => `<li>${inlineMarkdownToHtml(item)}</li>`).join("")}</ol>`);
    orderedItems = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      flushOrderedList();
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushList();
      flushOrderedList();
      blocks.push(`<h3>${inlineMarkdownToHtml(trimmed.replace(/^###\s+/, ""))}</h3>`);
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      flushOrderedList();
      blocks.push(`<h2>${inlineMarkdownToHtml(trimmed.replace(/^##\s+/, ""))}</h2>`);
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushOrderedList();
      listItems.push(trimmed.replace(/^-\s+/, ""));
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushList();
      orderedItems.push(trimmed.replace(/^\d+\.\s+/, ""));
      continue;
    }

    flushList();
    flushOrderedList();
    blocks.push(`<p>${inlineMarkdownToHtml(trimmed)}</p>`);
  }

  flushList();
  flushOrderedList();
  return blocks.join("\n");
}

function extractMarkdownLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g)].map((match) => match[1]);
}

function getNoteUrl(url) {
  const match = url.match(/editor\.note\.com\/notes\/([^/]+)\//);
  if (!match) return null;
  return `https://note.com/hearty_tapir5661/n/${match[1]}`;
}

function getNoteKey(noteUrl) {
  return noteUrl?.match(/\/n\/([^/?#]+)/)?.[1] || null;
}

async function waitForMembershipPaywall(noteUrl) {
  const noteKey = getNoteKey(noteUrl);
  if (!noteKey) {
    throw new Error("Publish verification failed: note URL key was not found.");
  }

  let lastState = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(`https://note.com/api/v3/notes/${noteKey}`);
    if (!response.ok) {
      throw new Error(`Publish verification failed: note API returned ${response.status}.`);
    }
    const payload = await response.json();
    const note = payload?.data || {};
    lastState = {
      status: note.status,
      is_limited: note.is_limited,
      can_read: note.can_read,
      is_membership_connected: note.paywall?.context?.is_membership_connected,
    };

    if (
      lastState.status === "published" &&
      lastState.is_limited === true &&
      lastState.can_read === false &&
      lastState.is_membership_connected === true
    ) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Publish verification failed: note membership paywall is not active: ${JSON.stringify(lastState)}`);
}

async function pasteRichContent(page, editor, markdown) {
  const html = markdownToHtml(markdown);
  await editor.click({ force: true });

  const inserted = await editor.evaluate((element, htmlContent) => {
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("delete", false);
    document.execCommand("insertHTML", false, htmlContent);
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertHTML" }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return { text: element.innerText, html: element.innerHTML };
  }, html);

  if (inserted.text.includes("## ") || inserted.text.includes("### ") || !inserted.html.includes("<a ")) {
    throw new Error("Rich content insertion failed.");
  }
}

async function setThumbnail(page, generatedEntry) {
  if (!generatedEntry?.thumbnail) return false;

  const thumbnailPath = path.resolve(ROOT, generatedEntry.thumbnail);
  const imageButton = page.locator('button[aria-label="画像を追加"], button[aria-label="見出し画像を追加"]').first();
  const imageButtonCount = await imageButton.count();
  if (imageButtonCount > 0) {
    await imageButton.click({ force: true });
  } else {
    const buttons = page.locator("button");
    const fallbackIndex = await buttons.evaluateAll((buttonElements) =>
      buttonElements.findIndex((button) => {
        const rect = button.getBoundingClientRect();
        const text = (button.innerText || button.textContent || "").trim();
        return (
          rect.width === 40 &&
          rect.height === 40 &&
          rect.x > 250 &&
          rect.y > 60 &&
          rect.y < 180 &&
          !button.getAttribute("aria-label") &&
          !text
        );
      }),
    );

    if (fallbackIndex < 0) {
      throw new Error("Thumbnail upload button was not found. Refusing to continue without a thumbnail.");
    }

    await buttons.nth(fallbackIndex).click({ force: true });
  }

  const uploadButton = page.locator("button").filter({ hasText: "画像をアップロード" }).first();
  if ((await uploadButton.count()) === 0) {
    throw new Error("Thumbnail upload button was not found. Refusing to continue without a thumbnail.");
  }

  await page.waitForTimeout(1000);

  const chooserPromise = page.waitForEvent("filechooser", { timeout: 60000 });
  await uploadButton.click({ force: true });
  const chooser = await chooserPromise;
  await chooser.setFiles(thumbnailPath);
  await page.waitForTimeout(8000);

  const cropSaveButton = page.locator("button").filter({ hasText: /^保存$/ }).last();
  await cropSaveButton.waitFor({ timeout: 60000 });
  await cropSaveButton.click({ force: true });
  await page.waitForTimeout(5000);

  const eyecatchImage = page.locator('img[alt="eyecatch"]').first();
  await eyecatchImage.waitFor({ timeout: 60000 });
  return true;
}

async function addMembershipPublicationTarget(page) {
  const addButtons = page.locator("button").filter({ hasText: /^追加$/ });
  const candidates = await addButtons.evaluateAll((buttons) =>
    buttons.map((button, index) => {
      let text = "";
      let node = button;
      for (let depth = 0; depth < 5 && node; depth += 1, node = node.parentElement) {
        text += ` ${(node.innerText || node.textContent || "").trim().replace(/\s+/g, " ")}`;
      }
      return { index, text };
    }),
  );

  if (candidates.length === 0) return false;

  const selected =
    candidates.find((candidate) => candidate.text.includes("ギルドメンバー")) ||
    candidates.find((candidate) => candidate.text.includes("メンバー全員")) ||
    candidates[0];

  await addButtons.nth(selected.index).click({ force: true });
  await page.waitForTimeout(2500);
  return true;
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

    await addMembershipPublicationTarget(page);
  }
}

async function submitPublishSettings(page) {
  const trialAreaButton = page.locator("button").filter({ hasText: "試し読みエリアを設定" });
  if ((await trialAreaButton.count()) > 0) {
    await trialAreaButton.first().click({ force: true });
    await page.waitForTimeout(5000);
  }

  const postButton = page.locator("button").filter({ hasText: /^(投稿する|更新する)$/ }).first();
  await postButton.waitFor({ timeout: 60000 });
  await postButton.click({ force: true });
  await page.waitForTimeout(10000);
}

async function loadLedger() {
  try {
    return JSON.parse(await readFile(LEDGER_PATH, "utf8"));
  } catch {
    return { generated: [], posted: [] };
  }
}

function sameEntryFile(entry, targetFile) {
  return entry.file === targetFile || entry.file === path.relative(ROOT, path.resolve(ROOT, targetFile));
}

function buildPostingQueue(ledger, targetFile) {
  const relativeTargetFile = path.relative(ROOT, path.resolve(ROOT, targetFile));
  const primary = (ledger.generated || []).find((entry) => sameEntryFile(entry, targetFile));
  if (!primary) {
    return [{ file: relativeTargetFile, generatedEntry: null }];
  }

  const companions = (ledger.generated || [])
    .filter((entry) =>
      entry.file !== primary.file &&
      entry.sourcePath === primary.sourcePath &&
      ["public", "members_only"].includes(entry.visibility),
    )
    .sort((left, right) => {
      const order = { public: 0, members_only: 1 };
      return (order[left.visibility] ?? 99) - (order[right.visibility] ?? 99);
    });

  const queue = [primary, ...companions]
    .filter((entry, index, entries) => entries.findIndex((item) => item.file === entry.file) === index)
    .sort((left, right) => {
      const order = { public: 0, members_only: 1 };
      return (order[left.visibility] ?? 99) - (order[right.visibility] ?? 99);
    })
    .map((entry) => ({ file: entry.file, generatedEntry: entry }));

  return queue;
}

async function writeLedgerEntry(ledger, filePath, generatedEntry, publishState) {
  if (!generatedEntry) return ledger;

  const postedAt = new Date().toISOString();
  const nextLedger = {
    generated: (ledger.generated || []).filter((entry) => entry.file !== filePath),
    posted: [
      ...(ledger.posted || []),
      {
        ...generatedEntry,
        postedAt,
        postedMode: publishState.publish ? "browser_published" : "browser_draft_filled",
        thumbnailSet: publishState.thumbnailSet,
        qualityChecked: publishState.qualityChecked,
        ...(publishState.noteUrl ? { noteUrl: publishState.noteUrl } : {}),
        ...(publishState.publish ? { publishedAt: postedAt } : {}),
      },
    ],
  };

  await writeFile(LEDGER_PATH, `${JSON.stringify(nextLedger, null, 2)}\n`, "utf8");
  return nextLedger;
}

async function postSingleDraft(context, ledger, queueEntry) {
  const fullPath = path.resolve(ROOT, queueEntry.file);
  const relativeFile = path.relative(ROOT, fullPath);
  const markdown = await readFile(fullPath, "utf8");
  const title = parseTitle(markdown);
  const generatedEntry = queueEntry.generatedEntry || (ledger.generated || []).find((entry) => entry.file === relativeFile);

  const page = await context.newPage();
  await page.goto(NOTE_NEW_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  console.log(`Opened note editor for: ${relativeFile}`);

  if (page.url().includes("/login")) {
    console.log("note login is required. Log in in the opened browser window. This command will continue after login.");
    await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 10 * 60 * 1000 });
    await page.goto(NOTE_NEW_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  }

  const titleInput = page.getByPlaceholder("タイトル");
  await titleInput.waitFor({ timeout: 60000 });
  await titleInput.fill(title);
  const thumbnailSet = await setThumbnail(page, generatedEntry);

  const editor = page.locator("[contenteditable='true']").last();
  await editor.waitFor({ timeout: 60000 });
  await pasteRichContent(page, editor, markdown);

  let publishedNoteUrl = null;
  let qualityChecked = false;

  if (publish) {
    if (generatedEntry?.visibility && !["public", "members_only"].includes(generatedEntry.visibility)) {
      throw new Error(`Refusing to auto-publish ${generatedEntry.visibility} as a free public note.`);
    }
    if (!thumbnailSet) {
      throw new Error("Refusing to publish without setting a note thumbnail.");
    }

    const proceedButton = page.locator("button").filter({ hasText: "公開に進む" });
    await proceedButton.waitFor({ timeout: 60000 });
    await proceedButton.click({ force: true });
    await page.waitForTimeout(5000);

    const noteUrl = getNoteUrl(page.url());
    publishedNoteUrl = noteUrl;
    await configurePublishSettings(page, generatedEntry);
    await submitPublishSettings(page);

    if (noteUrl) {
      const verifyPage = await context.newPage();
      await verifyPage.goto(noteUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
      await verifyPage.waitForTimeout(3000);
      if (generatedEntry?.visibility === "members_only") {
        await waitForMembershipPaywall(noteUrl);
      }

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
      qualityChecked = true;
      await verifyPage.close();
    }
  }

  console.log(`Filled note draft: ${title}`);
  if (!publish) {
    console.log("Review the editor and publish from note when ready.");
  }

  const finalNoteUrl = publishedNoteUrl || getNoteUrl(page.url());
  await page.close();
  return {
    file: relativeFile,
    generatedEntry,
    noteUrl: finalNoteUrl,
    thumbnailSet,
    qualityChecked,
    publish,
  };
}

async function main() {
  const postingLedger = await loadLedger();
  const queue = buildPostingQueue(postingLedger, file);

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("Playwright is not installed. Run `npm install` first, then retry.");
    console.error("Fallback: open the generated Markdown and paste it into note manually.");
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext(
    PROFILE_DIR,
    getChromePersistentContextOptions({ headless: false }),
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://note.com" });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://editor.note.com" });

  let ledger = postingLedger;
  for (const queueEntry of queue) {
    const publishState = await postSingleDraft(context, ledger, queueEntry);
    ledger = await writeLedgerEntry(ledger, publishState.file, publishState.generatedEntry, publishState);
  }

  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
