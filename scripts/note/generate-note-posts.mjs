import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getChromeLaunchOptions } from "./playwright-launch-options.mjs";

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "src/content");
const OUT_DIR = path.join(ROOT, "content/note-automation/drafts");
const THUMBNAIL_DIR = path.join(ROOT, "content/note-automation/thumbnails");
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

function escapeXml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitTitle(title) {
  const normalized = title.replace(/^無料公開:\s*/, "").replace(/^限定QUEST:\s*/, "");
  if (normalized.length <= 24) return [normalized];
  const first = normalized.slice(0, 24);
  const second = normalized.slice(24, 48);
  return [first, second ? `${second}${normalized.length > 48 ? "..." : ""}` : ""].filter(Boolean);
}

function noteTitle(title) {
  return title
    .replace(/Bid\/AskFX初心者/g, "Bid/AskをFX初心者")
    .replace(/Bid\/Ask(?!(?:とは|を))(?=[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}])/u, "Bid/Askを");
}

function cleanBodyLine(line) {
  return line
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/^#+\s+/, "")
    .trim();
}

function articleSections(article) {
  const sections = [];
  let current = null;

  for (const rawLine of article.body.split("\n")) {
    const line = rawLine.trim();
    if (!line || line === "---" || line.startsWith("<!--")) continue;

    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      current = { heading: cleanBodyLine(line), lines: [] };
      continue;
    }

    if (!current || line.startsWith("# ")) continue;
    const cleaned = cleanBodyLine(line);
    if (cleaned) current.lines.push(cleaned);
  }

  if (current) sections.push(current);
  return sections.filter((section) => section.heading && section.lines.length > 0);
}

function pickSection(article, headingPattern, fallbackIndex = 0) {
  const sections = articleSections(article);
  return (
    sections.find((section) => headingPattern.test(section.heading)) ||
    sections[fallbackIndex] ||
    { heading: noteTitle(article.title), lines: [article.description || `${noteTitle(article.title)}を確認します。`] }
  );
}

function sectionSummary(section, maxLines = 4) {
  return section.lines
    .filter((line) => !line.startsWith("["))
    .slice(0, maxLines)
    .join("\n");
}

function sectionBullets(section, maxLines = 4) {
  const bullets = section.lines.filter((line) => line.startsWith("- ")).slice(0, maxLines);
  if (bullets.length > 0) return bullets.join("\n");
  return section.lines
    .filter((line) => !line.startsWith("["))
    .slice(0, maxLines)
    .map((line) => `- ${line.replace(/^- /, "")}`)
    .join("\n");
}

function sectionPoints(section, maxLines = 5) {
  return [...new Set(
    section.lines
      .map((line) => line.replace(/^- /, "").trim())
      .filter((line) => line && !line.startsWith("["))
      .slice(0, maxLines),
  )];
}

function joinBulletList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function explainPoint(point, articleTitle, index) {
  const leads = [
    `「${point}」は、${articleTitle}を単語で終わらせず判断材料として使うための基本です。`,
    `初心者ほどここを曖昧にしたまま進みがちですが、${articleTitle}は使いどころまで理解して初めて役に立ちます。`,
    `${articleTitle}を学ぶときは、意味を覚えるだけでなく「いつ確認するか」を決めることが重要です。`,
    `相場では毎回同じ形が出るわけではないので、この視点を持っておくと無理な判断を減らしやすくなります。`,
  ];
  return `### ポイント${index + 1}: ${point}\n${leads[index % leads.length]}`;
}

function renderDeepDive(items, articleTitle) {
  return items.map((point, index) => explainPoint(point, articleTitle, index)).join("\n\n");
}

function renderMistakeFixes(items, articleTitle) {
  const fixes = [
    `対策は、${articleTitle}を見る前に時間足・方向感・損切り幅を先に決めることです。`,
    "感覚で飛びつかず、使う条件と見送る条件を先にメモしておくと精度が安定します。",
    "判断後に一文だけでも記録を残すと、同じ失敗の再発をかなり防ぎやすくなります。",
    "正解探しよりも、危険な場面を避ける意識を優先した方が初心者の成長は安定します。",
  ];
  return items.map((point, index) => `### 失敗${index + 1}: ${point}\n${point}が起きる背景には、${articleTitle}を単体で万能サインのように扱ってしまうことがあります。${fixes[index % fixes.length]}`).join("\n\n");
}

function renderPracticeMenu(practicalPoints, articleTitle) {
  const items = practicalPoints.length > 0
    ? practicalPoints
    : [`${articleTitle}を見た理由を書く`, "見送る条件を決める", "判断後に記録を残す"];
  return [
    "1. 今日は何を確認する練習なのかを一文で決めます。",
    `2. ドル円の5分足か1時間足を開き、「${items[0]}」を意識しながら現在地を言葉にします。`,
    `3. 次に「${items[Math.min(1, items.length - 1)]}」の視点を追加し、入る理由よりも見送る理由を優先して書きます。`,
    `4. 最後に「${items[Math.min(2, items.length - 1)]}」を使って、判断後の振り返りを30秒で残します。`,
  ].join("\n");
}

function renderChecklist(items) {
  return joinBulletList(items.map((item) => `${item}を自分の言葉で説明できるか確認する`));
}

function renderFaq(articleTitle) {
  return `### まだエントリー経験が少なくても学ぶ意味はありますか？\nあります。${articleTitle}は、勝つための裏技ではなく、危ない場面で無理をしないための基礎だからです。\n\n### これだけ覚えれば勝てますか？\n勝てません。${articleTitle}は重要ですが、環境認識、損切り、ロット管理と組み合わせて初めて機能します。\n\n### どの通貨ペアで練習すればよいですか？\n最初はドル円で十分です。通貨ペアを増やすより、同じ通貨で見方を安定させた方が学習効率は高くなります。`;
}

function renderClosingLinks() {
  return `FX Quest Guild:\n[FX Quest Guild](${SITE_URL})\n\nメンバーシップはこちら:\n[FX Quest Guild メンバーシップ](${NOTE_MEMBERSHIP_URL})\n\n取引環境を確認したい方:\n[MATSUI FXを確認する](${A8_URL})`;
}

function renderPremiumFrameworks(articleTitle) {
  return `## 世界水準で見るときの前提

本気で資金を守りながら増やすトレーダーほど、${articleTitle}を「単発の勝ちを増やす技術」ではなく、「生存確率と再現性を上げる設計要素」として扱います。
相場の世界では、分析の精度が高くても、ロット・損失許容・連敗時の対応が崩れると資産曲線は簡単に壊れます。
だから上位層ほど、手法より先に資金管理、意思決定手順、検証記録の整備に時間を使います。

## 学問横断で理解する

### 統計学の視点
重要なのは「1回の勝ち負け」より分布です。期待値、分散、標準偏差、連敗の長さ、最大ドローダウン想定まで見て、初めて${articleTitle}の実力が見えてきます。

### 行動ファイナンスの視点
人は利益が出るとロットを上げたくなり、損失が続くと取り返そうとして規律を壊しやすいです。${articleTitle}は、感情が暴れたときに自分を守る柵として設計する必要があります。

### 制御工学の視点
トレードは入力に対して出力が不確実な系です。だからこそ、1回の誤差で全体が破綻しないよう、フィードバックを入れた制御設計が必要です。ロット制御、停止条件、再開条件はそのまま制御系の発想です。

### ゲーム理論の視点
相場は「自分だけが見ている盤面」ではありません。他者の損切り、流動性、時間軸の違う参加者が混ざっています。${articleTitle}を使うときも、自分の都合だけでなく、他者の行動がどうぶつかるかを考えると判断の質が上がります。

### オペレーション設計の視点
勝ち続ける人は、トレードを感覚職ではなく運用業務として見ています。事前チェック、実行、記録、週次レビューを回す体制がないと、良いルールも長く維持できません。`;
}

function renderPremiumRiskModels(articleTitle) {
  return `## 資金管理モデルの比較

### 1. 固定比率方式
毎回の損失許容を口座資金の一定割合に固定する方法です。最も扱いやすく、規律も守りやすい一方、ボラティリティの違いを吸収しにくい弱点があります。

### 2. ボラティリティ連動方式
損切り幅やATRに応じてロットを調整し、1回あたりの資金変動をそろえる考え方です。${articleTitle}を実戦で使うなら、本来はこちらの方が理屈に合いやすい場面が多いです。

### 3. ドローダウン制限付き方式
連敗や資産曲線の悪化に応じて自動でロットを落とす方式です。最大の利点は、状態が悪いときに自分を守れることです。欠点は、回復局面で強気に戻しにくいことです。

### 4. ハーフ・ケリー発想
理論上の最適成長率を参考にしつつ、実務では半分以下に抑える考え方です。期待値が高くても推定誤差が大きい現実市場では、フルケリーは攻撃的すぎることが多く、保守化が前提になります。

### 5. 口座分割方式
学習口座、実験口座、本番口座を分ける方法です。検証段階のアイデアを本番資金へ直接ぶつけないので、成長と保全を両立しやすくなります。

${articleTitle}を本気で運用に落とすなら、どれか1つを盲信するより「平常時」「高ボラ時」「連敗時」で切り替える設計まで考えた方が強いです。`;
}

function renderPremiumExperiments(articleTitle) {
  return `## 実験課題

### 実験1: 連敗耐性の確認
直近100トレードを想定し、5連敗・7連敗・10連敗が起きても継続可能かを先に計算します。${articleTitle}が優れていても、連敗耐性が足りなければ運用は継続できません。

### 実験2: ロット固定と変動の比較
同じ手法で、固定ロット・固定比率・ATR連動の3パターンを比べます。勝率ではなく、最大ドローダウン、回復日数、心理負荷の違いを見るのがポイントです。

### 実験3: 判断停止ルールの導入
連敗数、週次損失、睡眠不足、経済指標直前など、停止トリガーを決めて成績の変化を比較します。止まる能力は、攻める能力と同じくらい重要です。

### 実験4: 複数時間足での一貫性確認
5分足、15分足、1時間足で${articleTitle}の見え方がどう変わるかを比較し、どの時間軸で一番再現性が高いかを記録します。

### 実験5: 日記の質と成績の相関
日記の記述量ではなく、事前仮説・執行理由・撤退理由がそろっているかを採点し、成績と相関を見ると、改善すべきボトルネックが見えやすくなります。`;
}

function renderPremiumMonetizationBridge(articleTitle) {
  return `## 実務に落とすときの結論

${articleTitle}で本当に差がつくのは、知識量ではなく設計の密度です。
勝ちやすい形を探す前に、負けても壊れない構造を作る。
感情でロットを変えない。
検証なしで本番ロットへ上げない。
この3つを守れるだけで、学習者から運用者へ一段階進みやすくなります。`;
}

function renderPublicMemberBridge(articleTitle) {
  return `## 有料記事で踏み込む内容

メンバー向けでは、${articleTitle}を「知っている状態」で止めず、

- 世界上位の実務で共通しやすい資金管理の考え方
- 固定比率、ATR連動、ドローダウン制御、ハーフ・ケリーの使い分け
- 統計学、行動ファイナンス、制御工学、ゲーム理論の視点
- そのまま真似できる実験課題と記録テンプレート

まで踏み込みます。
無料記事では土台、有料記事では運用設計まで扱うイメージです。`;
}

function renderPublicAdvancedAngles(articleTitle) {
  return `## もう一段深く見る視点

${articleTitle}を本当に使える知識へ変えるには、単語の意味だけで終わらせないことが重要です。
たとえば次の視点を足すだけでも、無料記事の理解はかなり深まります。

### 1. 時間軸で意味が変わる
同じ${articleTitle}でも、5分足で見たときと1時間足で見たときでは重みが違います。
短い時間足ではノイズに見えるものが、上位足では重要な転換の一部であることもあります。
だから「見えたかどうか」だけでなく、「どの時間軸で見えたか」をセットで考える必要があります。

### 2. ロット管理と切り離さない
初心者は知識と資金管理を別物で考えがちですが、実戦ではつながっています。
${articleTitle}の理解が曖昧な場面ではロットを落とす、説明できる場面だけ通常サイズにする、といった設計にすると事故が減りやすくなります。

### 3. 見送る判断こそ学習価値が高い
「ここでは使えない」「今日は判断材料が足りない」と言えることは、弱さではなく再現性の土台です。
勝っている人ほど、入らない理由を先に集めています。`;
}

function renderPublicExperiments(articleTitle) {
  return `## 無料でもできる実験

### 実験1: 3回連続で同じ型で記録する
${articleTitle}を見た場面を3回分だけ記録し、「見えた」「見えない」ではなく、「なぜそう判断したか」を毎回同じ順番で書きます。

### 実験2: 上位足と下位足を見比べる
5分足と1時間足で${articleTitle}の見え方がどうズレるかを比較し、どちらの方が自分にとって判断しやすいかを確認します。

### 実験3: ロットを変えずに判断だけ検証する
すぐに大きく張らず、しばらくはロットを固定して、${articleTitle}の理解そのものが改善しているかだけを見ます。
成績より先に判断の質をそろえる方が、後で伸びやすいです。`;
}

async function writeThumbnail(draft) {
  await mkdir(THUMBNAIL_DIR, { recursive: true });

  const thumbnailName = draft.fileName.replace(/\.md$/, ".png");
  const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailName);
  const titleLines = splitTitle(draft.title);
  const label = draft.visibility === "members_only" ? "MEMBER QUEST" : "FREE QUEST";
  const accent = draft.visibility === "members_only" ? "#f2c94c" : "#58d68d";

  const svg = `<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
  <rect width="1280" height="720" fill="#111827"/>
  <rect x="56" y="54" width="1168" height="612" rx="28" fill="#172033" stroke="${accent}" stroke-width="4"/>
  <path d="M94 548 C218 482 292 512 382 438 C464 371 540 404 618 320 C702 230 790 268 876 184 C956 106 1056 148 1186 92" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
  <g opacity="0.9">
    <rect x="156" y="178" width="18" height="210" fill="#58d68d"/>
    <line x1="165" y1="138" x2="165" y2="430" stroke="#58d68d" stroke-width="8"/>
    <rect x="252" y="248" width="18" height="166" fill="#ef6461"/>
    <line x1="261" y1="210" x2="261" y2="462" stroke="#ef6461" stroke-width="8"/>
    <rect x="348" y="208" width="18" height="190" fill="#58d68d"/>
    <line x1="357" y1="168" x2="357" y2="452" stroke="#58d68d" stroke-width="8"/>
    <rect x="444" y="286" width="18" height="118" fill="#58d68d"/>
    <line x1="453" y1="232" x2="453" y2="464" stroke="#58d68d" stroke-width="8"/>
  </g>
  <text x="96" y="120" fill="#f8fafc" font-family="Arial, sans-serif" font-size="38" font-weight="700">FX Quest Guild</text>
  <text x="96" y="174" fill="${accent}" font-family="Arial, sans-serif" font-size="28" font-weight="700">${label} / USDJPY</text>
  ${titleLines
    .map(
      (line, index) =>
        `<text x="96" y="${520 + index * 72}" fill="#ffffff" font-family="Arial, sans-serif" font-size="58" font-weight="800">${escapeXml(line)}</text>`,
    )
    .join("")}
</svg>`;

  const fallbackName = draft.visibility === "members_only"
    ? "2026-06-10-what-is-bid-ask-9-premium-1.png"
    : "2026-06-10-what-is-bid-ask-10-public-1.png";
  const fallbackPath = path.join(THUMBNAIL_DIR, fallbackName);

  if (process.env.NOTE_SKIP_THUMBNAIL === "1") {
    await copyFile(fallbackPath, thumbnailPath);
    return path.relative(ROOT, thumbnailPath);
  }

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch(getChromeLaunchOptions({ headless: true }));
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await page.setContent(svg, { waitUntil: "load" });
    await page.locator("svg").screenshot({ path: thumbnailPath });
    await browser.close();
  } catch (error) {
    await copyFile(fallbackPath, thumbnailPath);
    console.warn(`Thumbnail fallback used: ${path.relative(ROOT, fallbackPath)} (${error.message})`);
  }
  return path.relative(ROOT, thumbnailPath);
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
  const articleTitle = noteTitle(article.title);
  const practical = pickSection(article, /実戦|使い方|ポイント|注意/i, 2);
  const mistakes = pickSection(article, /失敗|注意|危険|おすすめしない/i, 3);
  const conclusion = pickSection(article, /結論|学べること|とは/i, 0);
  const practicalPoints = sectionPoints(practical, 4);
  const mistakePoints = sectionPoints(mistakes, 4);
  const title = `限定QUEST: ${articleTitle}を実戦で使う3つの確認ポイント`;
  const key = `article:${article.category}/${article.slug}:premium-checkpoints`;
  const fileSlug = `${today}-${slugify(article.slug)}-premium-${index + 1}`;

  const body = `# ${title}

この記事は、FX Quest Guild本編の「${articleTitle}」を読んだあとに進めるメンバー限定ワークです。
今回は、知識として読んだ内容を「実際のチャートでどう確認するか」からさらに進めて、「資金を守りながら伸ばす運用設計」まで落とし込みます。
ここでは一般的な初心者向け説明ではなく、長く生き残るための実務目線を優先します。

元QUEST:
[${articleTitle}](${article.url})

## 今日のゴール

知識として覚えるだけでなく、実際のドル円チャートを見ながら「どこを確認すればよいか」「どこでは使わないか」「資金をどう配分すれば壊れにくいか」まで言語化できるようにします。

${sectionSummary(conclusion, 4)}

## 先に押さえたい前提

${articleTitle}は、単独でエントリーを決めるための魔法の答えではありません。
実戦では、時間足、値動きの方向、直前の高値安値、損失を許容できる幅とセットで扱います。
この前提を飛ばすと、正しい知識でも使い方が雑になりやすいため、毎回最初に思い出してください。

${renderPremiumFrameworks(articleTitle)}

## 実戦チェック1: まず相場の状態を一文で書く

本編の「${practical.heading}」を、ドル円チャートで確認します。

${joinBulletList(practicalPoints)}

${renderDeepDive(practicalPoints, articleTitle)}

大事なのは当てることではなく、なぜそう見たのかを短く書くことです。判断前に言葉にできないものは、実戦でも再現しにくいと考えてください。

## 実戦チェック2: 入る場所より、入らない場所を決める

初心者ほど「どこで入るか」を急ぎます。
でも最初に決めるべきなのは、無理に入らない条件です。本編では特に「${mistakes.heading}」を確認してください。

${joinBulletList(mistakePoints)}

${renderMistakeFixes(mistakePoints, articleTitle)}

${renderPremiumRiskModels(articleTitle)}

## 実戦チェック3: 1回の判断を記録する

以下のテンプレートを使い、1回分だけでよいので記録を残してください。短くても構いません。大切なのは、判断の根拠を毎回同じ順番で言葉にすることです。

- 見た通貨ペア: USD/JPY
- 見た時間足:
- 相場認識:
- 根拠:
- 見送る条件:
- もし入るなら損切り位置:
- 見送り後に確認したいQUEST:

## 今日の練習メニュー

${renderPracticeMenu(practicalPoints, articleTitle)}

${renderPremiumExperiments(articleTitle)}

## 上位層が実務で外さない運用ルール

本気で資金を守る人ほど、手法の細部より運用ルールの一貫性を重視します。
特に外しにくいのは次の5点です。

- 理解が浅い場面でロットを上げない
- 連敗時の縮小条件を先に決める
- 経済指標や高ボラ日の例外ルールを持つ
- 週単位で資産曲線を点検する
- 新しいアイデアは本番資金へ直接混ぜない

このあたりは派手さがありませんが、長く残る人ほど徹底しています。

## 資金管理の設計例

たとえば学習中の段階なら、次のような階段設計が現実的です。

1. まずは固定ロットで判断の質だけをそろえる
2. 次に固定比率へ移り、1回の損失上限を口座全体で管理する
3. 慣れてきたらATRや損切り幅に応じてサイズを微調整する
4. 連敗時は自動的にサイズを落とす
5. 月次で資産曲線と日記の質を合わせて見直す

この順番を飛ばしていきなり攻めると、理解不足のままサイズだけ大きくなりやすいです。

## 無料記事から先へ進む意味

無料記事で土台を作り、メンバー記事で運用設計へ踏み込む理由は明確です。
無料側では「何を見るか」「どこで誤解しやすいか」を整え、有料側では「どう資金を置くか」「どう止まるか」「どう改善サイクルを回すか」まで詰めます。
知識を読むだけの状態から、資金曲線を守る実務へ進みたい人には、この差が大きく効きます。

## 仕上げチェック

${renderChecklist([
  `${articleTitle}を確認する理由`,
  "見送る条件",
  "損切りを置く前提",
  "判断後に残す記録",
  "連敗時のロット調整方針",
  "停止条件と再開条件",
])}

## 次にやること

本編で基礎を確認し、限定ワークで実戦の見方を増やしていきましょう。1回で完璧に当てようとせず、同じテンプレートで3回続けて記録できる状態を目標にすると、学習の密度が一気に上がります。

${renderPremiumMonetizationBridge(articleTitle)}

${renderClosingLinks()}

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
  const articleTitle = noteTitle(article.title);
  const conclusion = pickSection(article, /結論|学べること|とは/i, 0);
  const practical = pickSection(article, /ポイント|使い方|実戦/i, 2);
  const mistakes = pickSection(article, /失敗|注意|危険|おすすめしない/i, 3);
  const conclusionPoints = sectionPoints(conclusion, 4);
  const practicalPoints = sectionPoints(practical, 4);
  const mistakePoints = sectionPoints(mistakes, 4);
  const title = `無料公開: ${articleTitle}でつまずく前に確認したいこと`;
  const key = `public:${article.category}/${article.slug}:membership-teaser`;
  const fileSlug = `${today}-${slugify(article.slug)}-public-${index + 1}`;

  const body = `# ${title}

FXを学び始めた人が「${articleTitle}」でつまずく前に、まず確認したいポイントを整理します。
単語の意味だけを覚えて終わるのではなく、「どんな場面で役立つのか」「どこで誤解しやすいのか」まで含めて、最初の土台を固めるための記事です。
短い言葉ほど軽く見えますが、基礎ほど後から何度も使います。だからこそ、最初の理解を雑にしないことが重要です。

本編QUEST:
[${articleTitle}](${article.url})

## ${conclusion.heading}

${sectionSummary(conclusion, 4)}

${renderDeepDive(conclusionPoints, articleTitle)}

## なぜ最初にここを理解した方がいいのか

${articleTitle}は、利益を増やすテクニックというより、無駄なミスを減らすための基礎知識です。
初心者は「エントリーの形」や「勝ちやすい手法」に意識が向きがちですが、その前に必要なのは、注文や値動きの見方を取り違えないことです。
ここが曖昧なままでは、たまたま当たったトレードと再現できる判断の区別がつきません。
逆に、基礎の理解が安定すると、あとから学ぶ環境認識、損切り、利確、ロット管理もつながりやすくなります。

## ${practical.heading}

${joinBulletList(practicalPoints)}

${renderDeepDive(practicalPoints, articleTitle)}

## ドル円チャートで見るときの使い方

最初は難しく考えすぎず、ドル円の1時間足か5分足で十分です。
大切なのは、「今すぐ入る理由」を探すことではなく、「いま見ている動きに対して${articleTitle}をどう使うのか」を短く説明できるかどうかです。
もし説明できないなら、その時点では無理に判断しない方が学習としては正解です。
勝っている人ほど、わからない場面を飛ばす力を大事にしています。

## ${mistakes.heading}

${joinBulletList(mistakePoints)}

${renderMistakeFixes(mistakePoints, articleTitle)}

${renderPublicAdvancedAngles(articleTitle)}

## 今日からできる練習メニュー

${renderPracticeMenu(practicalPoints, articleTitle)}

${renderPublicExperiments(articleTitle)}

## 学習チェックリスト

${renderChecklist([
  `${articleTitle}の役割`,
  "どこで使うか",
  "どこで使わないか",
  "見送る条件",
  "記録に残す内容",
  "時間軸ごとの差",
  "ロットを落とすべき場面",
])}

## よくある疑問

${renderFaq(articleTitle)}

${renderPublicMemberBridge(articleTitle)}

## 次にやること

無料の本編QUESTで基礎を確認し、メンバーシップではドル円チャートを使って「どこで使うか」「どこで使わないか」「どう記録して再現するか」まで練習します。
知識を読む段階から、判断の型を作る段階へ進みたい方は、ここから先の実戦パートが役立ちます。

${renderClosingLinks()}

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

function buildPublicPractice(article, index) {
  const articleTitle = noteTitle(article.title);
  const practical = pickSection(article, /ポイント|使い方|実戦/i, 2);
  const mistakes = pickSection(article, /失敗|注意|危険|おすすめしない/i, 3);
  const practicalPoints = sectionPoints(practical, 4);
  const mistakePoints = sectionPoints(mistakes, 3);
  const title = `無料公開: ${articleTitle}をドル円で練習する3ステップ`;
  const key = `public:${article.category}/${article.slug}:usdjpy-practice`;
  const fileSlug = `${today}-${slugify(article.slug)}-public-practice-${index + 1}`;

  const body = `# ${title}

FXの知識は、読んだだけでは判断力に変わりません。
今回は「${articleTitle}」を、ドル円チャートを見ながら短時間で練習するための手順に落とし込みます。
難しい分析を増やすより、見る順番を固定して、毎回同じ言葉で記録することを優先します。

本編QUEST:
[${articleTitle}](${article.url})

## 今日の練習テーマ

${articleTitle}を使う目的は、エントリー理由を増やすことではなく、入ってよい場面と見送る場面を分けることです。
まずはドル円の5分足か1時間足を開き、次の3ステップだけ確認してください。

## ステップ1: いま見ている時間足を決める

最初に時間足を1つに固定します。
5分足なら短期の動き、1時間足なら流れの確認と割り切ります。
ここを曖昧にしたまま見ると、同じチャートでも都合のよい情報だけ拾いやすくなります。

${joinBulletList(practicalPoints)}

## ステップ2: 入る理由より見送る理由を先に書く

初心者が伸びる近道は、勝てそうな形を探すことより、危ない場面を言語化することです。
「説明できない」「時間足で判断が割れる」「損切り幅が広すぎる」と感じたら、その時点で見送り候補にします。

${renderMistakeFixes(mistakePoints, articleTitle)}

## ステップ3: 30秒で記録する

判断したあとに、次の3行だけ残します。

1. 見た時間足
2. ${articleTitle}をどう使ったか
3. 入らない理由、または次に確認する条件

記録は長くなくて構いません。
同じ型で残すほど、あとから自分の判断ミスを見つけやすくなります。

## 失敗を減らすチェックリスト

${renderChecklist([
  "時間足を先に決めたか",
  `${articleTitle}を使う理由を一文で説明したか`,
  "見送る条件を書いたか",
  "損切り幅とロットを確認したか",
  "結果ではなく判断の質を記録したか",
])}

## 次にやること

本編QUESTで基礎を確認したら、次は同じ手順を3回だけ繰り返してください。
勝ち負けよりも、同じ順番で判断できたかを見ます。
メンバーシップでは、この記録をドル円チャートの具体例に当てはめて、再現しやすい判断の型にしていきます。

${renderClosingLinks()}

※本記事は学習目的です。売買指示や利益保証ではありません。投資判断は必ずご自身で行ってください。
`;

  return {
    type: "public_practice",
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
  const articleTitle = noteTitle(article.title);
  const practical = pickSection(article, /ポイント|使い方|実戦/i, 2);
  const mistakes = pickSection(article, /失敗|注意|危険|おすすめしない/i, 3);
  const practicalPoints = sectionPoints(practical, 3);
  const mistakePoints = sectionPoints(mistakes, 3);
  const title = `掲示板テーマ: ${articleTitle}をドル円チャートで確認しよう`;
  const key = `board:${article.category}/${article.slug}:usdjpy-check`;
  const fileSlug = `${today}-${slugify(article.slug)}-board-${index + 1}`;

  const body = `# ${title}

今週の掲示板テーマです。

元QUEST:
[${articleTitle}](${article.url})

## 投稿テーマ

ドル円チャートを見て、「今の相場をどう読むか」を短く投稿してください。
今回は正解探しではなく、${articleTitle}をどう使って相場を見るかを言葉にする練習です。
次の視点を1つ以上入れると、投稿の質が上がります。

${joinBulletList(practicalPoints)}

避けたいミスも先に共有しておきます。

${joinBulletList(mistakePoints)}

## 投稿テンプレート

- 見ている時間足:
- 今の相場認識:
- 根拠:
- 迷っている点:
- 次に確認したいQUEST:

## コメントのルール

正解探しではなく、根拠を言語化する練習として使いましょう。
他の人の投稿には、否定ではなく「どの根拠を見たか」を返してください。
相手の結論よりも、どの情報を拾ってその判断になったかを見ると学びやすくなります。

${renderClosingLinks()}

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
  let selectedTopicCount = 0;

  for (const article of preferred) {
    const buildersByType = {
      any: [buildPublicTeaser, buildPremiumArticle, buildBoardPost],
      public: [buildPublicTeaser, buildPublicPractice],
      member: [buildPremiumArticle],
      board: [buildBoardPost],
      paired: [buildPublicTeaser, buildPremiumArticle],
    };
    const builders = buildersByType[typeFilter] || buildersByType.any;
    const articleDrafts = [];
    for (const builder of builders) {
      const draft = builder(article, drafts.length + articleDrafts.length);
      if (usedKeys.has(draft.key)) continue;
      articleDrafts.push(draft);
      if (typeFilter === "public") break;
    }

    if (typeFilter === "paired" && articleDrafts.length < 2) continue;

    for (const draft of articleDrafts) {
      drafts.push(draft);
      usedKeys.add(draft.key);
    }

    selectedTopicCount += 1;
    if (selectedTopicCount >= count) return drafts;
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
    const thumbnail = await writeThumbnail(draft);
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
      thumbnail,
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
