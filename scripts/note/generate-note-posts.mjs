import { copyFile, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "src/content");
const OUT_DIR = path.join(ROOT, "content/note-automation/drafts");
const THUMBNAIL_DIR = path.join(ROOT, "content/note-automation/thumbnails");
const THUMBNAIL_ARCHIVE_DIR = "/Volumes/MyHD/Archives/fx-quest-guild/note-thumbnails";
const CHART_DIR = path.join(ROOT, "content/note-automation/charts");
const CHART_ARCHIVE_DIR = "/Volumes/MyHD/Archives/fx-quest-guild/note-charts";
const LEDGER_PATH = path.join(ROOT, "content/note-automation/posted-ledger.json");
const LATEST_PATH = path.join(ROOT, "content/note-automation/latest.json");

const SITE_URL = "https://sunscreate.github.io/fx-learning-rpg-site/";
const NOTE_MEMBERSHIP_URL = "https://note.com/hearty_tapir5661/membership";
const A8_URL = "https://px.a8.net/svt/ejp?a8mat=3Z0M25+6HE1RU+4SM6+5YRHE";
const execFileAsync = promisify(execFile);

function link(label, url) {
  return `[${label}](${url})`;
}

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = true] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const count = args.has("count") ? Number(args.get("count")) : 2;
const typeFilter = args.get("type") || "any";
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function hash(input) {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 10);
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapTitle(title, maxLength = 14) {
  const normalized = title
    .replace(/^(無料公開|限定QUEST|掲示板テーマ):\s*/, "")
    .replace(/FX Quest Guild/g, "FX Quest Guild ")
    .trim();
  const lines = [];
  let current = "";

  for (const character of normalized) {
    current += character;
    if (current.length >= maxLength) {
      lines.push(current.trim());
      current = "";
    }
    if (lines.length === 3) break;
  }
  if (current && lines.length < 3) lines.push(current.trim());
  return lines.filter(Boolean).slice(0, 3);
}

async function createThumbnail(draft) {
  const baseName = draft.fileName.replace(/\.md$/, "");
  const svgPath = path.join(THUMBNAIL_DIR, `${baseName}.svg`);
  const pngPath = path.join(THUMBNAIL_DIR, `${baseName}.png`);
  const isMember = draft.visibility !== "public";
  const label = draft.visibility === "members_board" ? "MEMBER BOARD" : isMember ? "MEMBER QUEST" : "FREE QUEST";
  const accent = isMember ? "#f2c94c" : "#58d68d";
  const lines = wrapTitle(draft.title);
  const titleSvg = lines
    .map(
      (line, index) =>
        `<text x="92" y="${350 + index * 62}" fill="#ffffff" font-family="Hiragino Sans, Yu Gothic, sans-serif" font-size="44" font-weight="800">${escapeXml(line)}</text>`,
    )
    .join("\n");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="670" viewBox="0 0 1280 670">
  <rect width="1280" height="670" fill="#0d1424"/>
  <g stroke="#29344c" stroke-width="2" opacity="0.72">
    <path d="M0 112H1280M0 224H1280M0 336H1280M0 448H1280M0 560H1280"/>
    <path d="M160 0V670M320 0V670M480 0V670M640 0V670M800 0V670M960 0V670M1120 0V670"/>
  </g>
  <rect x="58" y="52" width="1164" height="566" rx="18" fill="none" stroke="${accent}" stroke-width="4"/>
  <text x="92" y="116" fill="#ffffff" font-family="Hiragino Sans, Yu Gothic, sans-serif" font-size="38" font-weight="700">FX Quest Guild</text>
  <text x="92" y="162" fill="${accent}" font-family="Hiragino Sans, Yu Gothic, sans-serif" font-size="25" font-weight="700">${label} | USDJPY</text>
  <g transform="translate(870 180) scale(0.8)">
    <path d="M0 236L92 150L184 190L276 88L368 120" fill="none" stroke="${accent}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <g stroke-width="8">
      <path d="M38 78V246" stroke="#58d68d"/><rect x="20" y="116" width="36" height="76" fill="#58d68d"/>
      <path d="M112 112V280" stroke="#ff7b7b"/><rect x="94" y="154" width="36" height="82" fill="#ff7b7b"/>
      <path d="M190 42V214" stroke="#58d68d"/><rect x="172" y="78" width="36" height="92" fill="#58d68d"/>
    </g>
  </g>
  ${titleSvg}
  <text x="92" y="592" fill="#b8c2d8" font-family="Hiragino Sans, Yu Gothic, sans-serif" font-size="24" font-weight="600">初心者向けFX学習 | 実践で使える知識へ</text>
</svg>`;

  await mkdir(THUMBNAIL_DIR, { recursive: true });
  await writeFile(svgPath, svg, "utf8");
  await execFileAsync("/usr/bin/sips", ["-s", "format", "png", svgPath, "--out", pngPath]);
  await unlink(svgPath);

  try {
    await mkdir(THUMBNAIL_ARCHIVE_DIR, { recursive: true });
    await copyFile(pngPath, path.join(THUMBNAIL_ARCHIVE_DIR, path.basename(pngPath)));
  } catch (error) {
    console.warn(`Thumbnail archive skipped: ${error.message}`);
  }

  return path.relative(ROOT, pngPath);
}

function shouldIncludeChart(draft) {
  if (draft.type === "member_article") return true;
  if (["chart", "entry", "risk", "analysis"].includes(draft.category)) return true;
  return /(チャート|トレンド|サポート|レジスタンス|ブレイク|押し目|戻り|スプレッド|Bid|Ask)/i.test(
    draft.title,
  );
}

async function createChartImage(draft) {
  if (!shouldIncludeChart(draft)) return null;

  const baseName = draft.fileName.replace(/\.md$/, "");
  const svgPath = path.join(CHART_DIR, `${baseName}-chart.svg`);
  const pngPath = path.join(CHART_DIR, `${baseName}-chart.png`);
  const accent = draft.visibility === "public" ? "#58d68d" : "#f2c94c";
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#0d1424"/>
  <g stroke="#29344c" stroke-width="2" opacity="0.85">
    <path d="M80 150H1200M80 260H1200M80 370H1200M80 480H1200M80 590H1200"/>
    <path d="M200 110V620M360 110V620M520 110V620M680 110V620M840 110V620M1000 110V620M1160 110V620"/>
  </g>
  <text x="80" y="62" fill="#ffffff" font-family="Hiragino Sans, Yu Gothic, sans-serif" font-size="34" font-weight="700">USD/JPY 解説用チャート例</text>
  <text x="80" y="100" fill="#aebbd3" font-family="Hiragino Sans, Yu Gothic, sans-serif" font-size="20">実際の相場価格ではありません。判断ポイントの学習用です。</text>
  <path d="M95 520C190 500 220 420 300 438S430 520 510 430S650 320 730 355S850 445 920 338S1050 220 1180 250" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>
  <g stroke-width="5">
    <path d="M180 430V560" stroke="#58d68d"/><rect x="164" y="462" width="32" height="58" fill="#58d68d"/>
    <path d="M260 398V530" stroke="#ff7b7b"/><rect x="244" y="430" width="32" height="62" fill="#ff7b7b"/>
    <path d="M390 420V548" stroke="#58d68d"/><rect x="374" y="448" width="32" height="66" fill="#58d68d"/>
    <path d="M545 348V478" stroke="#58d68d"/><rect x="529" y="386" width="32" height="58" fill="#58d68d"/>
    <path d="M695 294V410" stroke="#ff7b7b"/><rect x="679" y="326" width="32" height="54" fill="#ff7b7b"/>
    <path d="M825 340V460" stroke="#58d68d"/><rect x="809" y="372" width="32" height="58" fill="#58d68d"/>
    <path d="M960 258V386" stroke="#58d68d"/><rect x="944" y="292" width="32" height="60" fill="#58d68d"/>
  </g>
  <path d="M80 446H1200" stroke="#ff7b7b" stroke-width="3" stroke-dasharray="14 10"/>
  <rect x="92" y="402" width="228" height="42" rx="6" fill="#1b263d"/>
  <text x="108" y="432" fill="#ffb1b1" font-family="Hiragino Sans, Yu Gothic, sans-serif" font-size="21" font-weight="700">見送り・再確認ゾーン</text>
  <path d="M934 204L970 258" stroke="#ffffff" stroke-width="4"/>
  <rect x="810" y="154" width="252" height="48" rx="6" fill="#1b263d"/>
  <text x="832" y="186" fill="#ffffff" font-family="Hiragino Sans, Yu Gothic, sans-serif" font-size="22" font-weight="700">根拠を確認する地点</text>
  <text x="80" y="682" fill="#aebbd3" font-family="Hiragino Sans, Yu Gothic, sans-serif" font-size="20">FX Quest Guild | 通貨ペア: USD/JPY</text>
</svg>`;

  await mkdir(CHART_DIR, { recursive: true });
  await writeFile(svgPath, svg, "utf8");
  await execFileAsync("/usr/bin/sips", ["-s", "format", "png", svgPath, "--out", pngPath]);
  await unlink(svgPath);

  try {
    await mkdir(CHART_ARCHIVE_DIR, { recursive: true });
    await copyFile(pngPath, path.join(CHART_ARCHIVE_DIR, path.basename(pngPath)));
  } catch (error) {
    console.warn(`Chart archive skipped: ${error.message}`);
  }

  return path.relative(ROOT, pngPath);
}

async function ensureGeneratedThumbnails(ledger) {
  const generated = [];

  for (const entry of ledger.generated || []) {
    const draft = {
      fileName: path.basename(entry.file),
      title: entry.title,
      type: entry.type,
      category: entry.category || entry.sourcePath?.split("/")[2],
      visibility: entry.visibility,
    };
    const thumbnail = entry.thumbnail || (await createThumbnail(draft));
    const chartImage = entry.chartImage || (await createChartImage(draft));
    generated.push({ ...entry, thumbnail, ...(chartImage ? { chartImage } : {}) });
  }

  return { ...ledger, generated };
}

async function syncLatestThumbnails(ledger) {
  try {
    const latest = JSON.parse(await readFile(LATEST_PATH, "utf8"));
    const generatedByFile = new Map((ledger.generated || []).map((entry) => [entry.file, entry]));
    const synced = latest.map((entry) => generatedByFile.get(entry.file) || entry);
    await writeFile(LATEST_PATH, `${JSON.stringify(synced, null, 2)}\n`, "utf8");
  } catch {
    // latest.json is optional until the first draft is generated.
  }
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, body: markdown };

  const data = {};
  const lines = match[1].split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;

    const [, key, rawValue] = pair;
    let value = rawValue.trim();

    if (value === "") {
      const items = [];
      while (lines[i + 1]?.trim().startsWith("- ")) {
        i += 1;
        items.push(lines[i].trim().replace(/^- /, "").replace(/^"|"$/g, ""));
      }
      data[key] = items;
      continue;
    }

    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
      continue;
    }

    data[key] = value.replace(/^"|"$/g, "");
  }

  return { data, body: match[2] };
}

async function readArticles(dir = CONTENT_DIR) {
  const entries = await readdir(dir, { withFileTypes: true });
  const articles = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      articles.push(...(await readArticles(fullPath)));
      continue;
    }

    if (!entry.name.endsWith(".md")) continue;

    const markdown = await readFile(fullPath, "utf8");
    const { data, body } = parseFrontmatter(markdown);
    if (!data.title || !data.category) continue;

    const slug = entry.name.replace(/\.md$/, "");
    articles.push({
      title: data.title,
      description: data.description || "",
      category: data.category,
      level: Number(data.level || 1),
      tags: Array.isArray(data.tags) ? data.tags : [],
      slug,
      body,
      sourcePath: path.relative(ROOT, fullPath),
      url: `${SITE_URL}category/${data.category}/${slug}/`,
    });
  }

  return articles.sort((a, b) => a.level - b.level || a.title.localeCompare(b.title, "ja"));
}

async function readLedger() {
  try {
    return JSON.parse(await readFile(LEDGER_PATH, "utf8"));
  } catch {
    return { generated: [], posted: [] };
  }
}

function buildPremiumArticle(article, index) {
  const title = `限定QUEST: ${article.title}を実戦で使う3つの確認ポイント`;
  const key = `article:${article.category}/${article.slug}:premium-checkpoints`;
  const fileSlug = `${today}-${slugify(article.slug)}-premium-${index + 1}`;

  const body = `# ${title}

この記事は、FX Quest Guild本編の「${article.title}」を読んだあとに進めるメンバー限定ワークです。

元QUEST:
${link(`${article.title}をFX Quest Guildで確認する`, article.url)}

## 今日のゴール

知識として覚えるだけでなく、実際のドル円チャートを見ながら「どこを確認すればよいか」を言語化できるようにします。

## 実戦チェック1: まず相場の状態を一文で書く

次のどれに見えるかを決めます。

- 上昇
- 下降
- レンジ
- 判断保留

**大事なのは当てることではなく、根拠を短く書くことです。**

## 実戦チェック2: 入る場所より、入らない場所を決める

初心者ほど「どこで入るか」を急ぎます。
でも最初に決めるべきなのは、無理に入らない条件です。

- 直近高値と安値が近すぎる
- 損切り位置が置きにくい
- 経済指標の前後で値動きが荒い
- 根拠が1つしかない

## 実戦チェック3: 1回の判断を記録する

以下を掲示板かノートに残してください。

- 見た通貨ペア: USD/JPY
- 見た時間足:
- 相場認識:
- 根拠:
- 見送る条件:

## 次にやること

本編で基礎を確認し、限定ワークで実戦の見方を増やしていきましょう。

FX Quest Guild:
${link("FX Quest Guildで基礎QUESTを進める", SITE_URL)}

メンバーシップ:
${link("メンバーシップでドル円チャート実践ワークに参加する", NOTE_MEMBERSHIP_URL)}

取引環境を確認したい方:
${link("MATSUI FXの取引環境を確認する", A8_URL)}

※本記事は学習目的です。売買指示や利益保証ではありません。投資判断は必ずご自身で行ってください。
`;

  return {
    type: "member_article",
    category: article.category,
    title,
    key,
    fileName: `${fileSlug}.md`,
    sourcePath: article.sourcePath,
    sourceUrl: article.url,
    tags: ["FX初心者", "ドル円", "チャート分析", "FX Quest Guild"],
    visibility: "members_only",
    body,
  };
}

function buildPublicTeaser(article, index) {
  const title = `無料公開: ${article.title}でつまずく前に確認したいこと`;
  const key = `public:${article.category}/${article.slug}:membership-teaser`;
  const fileSlug = `${today}-${slugify(article.slug)}-public-${index + 1}`;

  const body = `# ${title}

FXを学び始めた人が「${article.title}」でつまずきやすいポイントを、短く整理します。

本編QUEST:
${link(`${article.title}をFX Quest Guildで確認する`, article.url)}

## まず押さえること

**最初から勝ち方を探すより、用語やチャートの見方を自分の言葉で説明できる状態を作ることが大事です。**

## 初心者が止まりやすいポイント

- 言葉は知っているが、実際のチャートで見つけられない
- 1回の値動きだけで判断してしまう
- 根拠が少ないままエントリーを考えてしまう

## FX Quest Guildでできること

無料の本編QUESTで基礎を確認し、メンバーシップでは実践ワーク・掲示板・ドル円チャート分析で理解を深めます。

FX Quest Guild:
${link("FX Quest Guildで基礎QUESTを進める", SITE_URL)}

メンバーシップはこちら:
${link("メンバーシップでドル円チャート実践ワークに参加する", NOTE_MEMBERSHIP_URL)}

取引環境を確認したい方:
${link("MATSUI FXの取引環境を確認する", A8_URL)}

※本記事は学習目的です。売買指示や利益保証ではありません。投資判断は必ずご自身で行ってください。
`;

  return {
    type: "public_teaser",
    category: article.category,
    title,
    key,
    fileName: `${fileSlug}.md`,
    sourcePath: article.sourcePath,
    sourceUrl: article.url,
    tags: ["FX初心者", "FX学習", "ドル円", "FX Quest Guild"],
    visibility: "public",
    body,
  };
}

function buildBoardPost(article, index) {
  const title = `掲示板テーマ: ${article.title}をドル円チャートで確認しよう`;
  const key = `board:${article.category}/${article.slug}:usdjpy-check`;
  const fileSlug = `${today}-${slugify(article.slug)}-board-${index + 1}`;

  const body = `# ${title}

今週の掲示板テーマです。

元QUEST:
${link(`${article.title}をFX Quest Guildで確認する`, article.url)}

## 投稿テーマ

ドル円チャートを見て、「今の相場をどう読むか」を短く投稿してください。

## 投稿テンプレート

- 見ている時間足:
- 今の相場認識:
- 根拠:
- 迷っている点:
- 次に確認したいQUEST:

## コメントのルール

正解探しではなく、根拠を言語化する練習として使いましょう。
他の人の投稿には、否定ではなく「どの根拠を見たか」を返してください。

FX Quest Guild:
${link("FX Quest Guildで基礎QUESTを進める", SITE_URL)}

メンバーシップ:
${link("メンバーシップでドル円チャート実践ワークに参加する", NOTE_MEMBERSHIP_URL)}

※掲示板は学習用です。売買指示、個別の投資助言、利益保証は行いません。
`;

  return {
    type: "board_post",
    category: article.category,
    title,
    key,
    fileName: `${fileSlug}.md`,
    sourcePath: article.sourcePath,
    sourceUrl: article.url,
    tags: ["FX初心者", "ドル円", "掲示板", "学習記録"],
    visibility: "members_board",
    body,
  };
}

function selectDrafts(articles, ledger) {
  if (count <= 0) return [];
  const usedKeys = new Set([
    ...(ledger.generated || []).map((entry) => entry.key),
    ...(ledger.posted || []).map((entry) => entry.key),
  ]);

  const preferred = articles.filter((article) =>
    ["basic", "chart", "entry", "risk", "analysis", "operation"].includes(article.category),
  );

  const drafts = [];

  for (const article of preferred) {
    const buildersByType = {
      any: [buildPublicTeaser, buildPremiumArticle, buildBoardPost],
      public: [buildPublicTeaser],
      member: [buildPremiumArticle],
      board: [buildBoardPost],
    };
    const builders = buildersByType[typeFilter] || buildersByType.any;
    for (const builder of builders) {
      const draft = builder(article, drafts.length);
      if (usedKeys.has(draft.key)) continue;
      drafts.push(draft);
      usedKeys.add(draft.key);
      if (drafts.length >= count) return drafts;
    }
  }

  return drafts;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(THUMBNAIL_DIR, { recursive: true });
  await mkdir(CHART_DIR, { recursive: true });

  const [articles, rawLedger] = await Promise.all([readArticles(), readLedger()]);
  const ledger = await ensureGeneratedThumbnails(rawLedger);
  const drafts = selectDrafts(articles, ledger);

  if (drafts.length === 0) {
    await writeFile(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
    await syncLatestThumbnails(ledger);
    console.log("No new note drafts. All candidate topics are already generated or posted.");
    return;
  }

  const generatedAt = new Date().toISOString();
  const generatedEntries = [];

  for (const draft of drafts) {
    const outPath = path.join(OUT_DIR, draft.fileName);
    await writeFile(outPath, draft.body, "utf8");
    const thumbnail = await createThumbnail(draft);
    const chartImage = await createChartImage(draft);
    generatedEntries.push({
      key: draft.key,
      id: hash(`${draft.key}:${generatedAt}`),
      title: draft.title,
      type: draft.type,
      file: path.relative(ROOT, outPath),
      sourcePath: draft.sourcePath,
      sourceUrl: draft.sourceUrl,
      category: draft.category,
      visibility: draft.visibility,
      tags: draft.tags,
      thumbnail,
      ...(chartImage ? { chartImage } : {}),
      generatedAt,
    });
  }

  const nextLedger = {
    generated: [...(ledger.generated || []), ...generatedEntries],
    posted: ledger.posted || [],
  };

  await writeFile(LEDGER_PATH, `${JSON.stringify(nextLedger, null, 2)}\n`, "utf8");
  await writeFile(LATEST_PATH, `${JSON.stringify(generatedEntries, null, 2)}\n`, "utf8");

  console.log(`Generated ${generatedEntries.length} note draft(s).`);
  for (const entry of generatedEntries) {
    console.log(`- ${entry.file}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
