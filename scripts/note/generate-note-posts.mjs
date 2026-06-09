import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "src/content");
const OUT_DIR = path.join(ROOT, "content/note-automation/drafts");
const LEDGER_PATH = path.join(ROOT, "content/note-automation/posted-ledger.json");
const LATEST_PATH = path.join(ROOT, "content/note-automation/latest.json");

const SITE_URL = "https://sunscreate.github.io/fx-learning-rpg-site/";
const NOTE_MEMBERSHIP_URL = "https://note.com/hearty_tapir5661/membership";
const A8_URL = "https://px.a8.net/svt/ejp?a8mat=3Z0M25+6HE1RU+4SM6+5YRHE";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = true] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const count = Number(args.get("count") || 2);
const typeFilter = args.get("type") || "any";
const today = new Date().toISOString().slice(0, 10);

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
${article.url}

## 今日のゴール

知識として覚えるだけでなく、実際のドル円チャートを見ながら「どこを確認すればよいか」を言語化できるようにします。

## 実戦チェック1: まず相場の状態を一文で書く

次のどれに見えるかを決めます。

- 上昇
- 下降
- レンジ
- 判断保留

大事なのは当てることではなく、根拠を短く書くことです。

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
${SITE_URL}

メンバーシップ:
${NOTE_MEMBERSHIP_URL}

取引環境を確認したい方:
${A8_URL}

※本記事は学習目的です。売買指示や利益保証ではありません。投資判断は必ずご自身で行ってください。
`;

  return {
    type: "member_article",
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
${article.url}

## まず押さえること

最初から勝ち方を探すより、用語やチャートの見方を自分の言葉で説明できる状態を作ることが大事です。

## 初心者が止まりやすいポイント

- 言葉は知っているが、実際のチャートで見つけられない
- 1回の値動きだけで判断してしまう
- 根拠が少ないままエントリーを考えてしまう

## FX Quest Guildでできること

無料の本編QUESTで基礎を確認し、メンバーシップでは実践ワーク・掲示板・ドル円チャート分析で理解を深めます。

FX Quest Guild:
${SITE_URL}

メンバーシップはこちら:
${NOTE_MEMBERSHIP_URL}

取引環境を確認したい方:
${A8_URL}

※本記事は学習目的です。売買指示や利益保証ではありません。投資判断は必ずご自身で行ってください。
`;

  return {
    type: "public_teaser",
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
${article.url}

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
${SITE_URL}

メンバーシップ:
${NOTE_MEMBERSHIP_URL}

※掲示板は学習用です。売買指示、個別の投資助言、利益保証は行いません。
`;

  return {
    type: "board_post",
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

  const [articles, ledger] = await Promise.all([readArticles(), readLedger()]);
  const drafts = selectDrafts(articles, ledger);

  if (drafts.length === 0) {
    console.log("No new note drafts. All candidate topics are already generated or posted.");
    return;
  }

  const generatedAt = new Date().toISOString();
  const generatedEntries = [];

  for (const draft of drafts) {
    const outPath = path.join(OUT_DIR, draft.fileName);
    await writeFile(outPath, draft.body, "utf8");
    generatedEntries.push({
      key: draft.key,
      id: hash(`${draft.key}:${generatedAt}`),
      title: draft.title,
      type: draft.type,
      file: path.relative(ROOT, outPath),
      sourcePath: draft.sourcePath,
      sourceUrl: draft.sourceUrl,
      visibility: draft.visibility,
      tags: draft.tags,
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
