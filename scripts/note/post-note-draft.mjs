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
    console.error("note login is required. Log in once in the opened browser window, then rerun this command.");
    await context.close();
    process.exit(2);
  }

  const titleInput = page.getByPlaceholder("タイトル");
  await titleInput.waitFor({ timeout: 60000 });
  await titleInput.fill(title);

  const editor = page.locator("[contenteditable='true']").last();
  await editor.waitFor({ timeout: 60000 });
  await editor.fill(markdown.replace(/^#\s+.+\n+/, ""));

  if (publish) {
    const publishButtons = [
      page.getByRole("button", { name: "公開設定" }),
      page.getByRole("button", { name: "投稿" }),
      page.getByRole("button", { name: "公開" }),
    ];

    for (const button of publishButtons) {
      try {
        if ((await button.count()) === 1) {
          await button.click();
          break;
        }
      } catch {
        // Continue to the next candidate. note changes its editor labels often.
      }
    }

    console.log("Publish mode requested. If note opened a final confirmation screen, review it before completing publication.");
  }

  const ledger = await loadLedger();
  const generatedEntry = (ledger.generated || []).find((entry) => entry.file === file);
  if (generatedEntry) {
    const postedAt = new Date().toISOString();
    const nextLedger = {
      generated: (ledger.generated || []).filter((entry) => entry.file !== file),
      posted: [
        ...(ledger.posted || []),
        {
          ...generatedEntry,
          postedAt,
          postedMode: publish ? "browser_publish_requested" : "browser_draft_filled",
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
