import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const BASE = path.join(ROOT, "content/note-monetization-lab");
const DRAFTS = path.join(BASE, "drafts");
const LEDGER = path.join(BASE, "posted-ledger.json");
const LATEST = path.join(BASE, "latest.json");

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = true] = arg.replace(/^--/, "").split("=");
  return [key, value];
}));
const mode = args.get("type") || "paired";
const today = new Date().toISOString().slice(0, 10);

const topics = [
  {
    slug: "note-title-thumbnail",
    subject: "noteを書いているのに記事が開かれない",
    cause: "本文より前に読者が判断するタイトルと1枚目画像の役割を分けていないこと",
    solution: "対象読者・悩み・変化をタイトルに置き、画像には短い判断材料だけを置くこと",
    template: "タイトルと1枚目画像を同時に改善するチェックシート",
  },
  {
    slug: "paid-note-value",
    subject: "有料noteを作っても購入されない",
    cause: "無料部分と有料部分の役割が曖昧で、購入後に残る成果物を示せていないこと",
    solution: "無料部分で問題を整理し、有料部分で手順・テンプレート・記録方法を渡すこと",
    template: "有料ライン設計テンプレート",
  },
];

function id(key) { return crypto.createHash("sha1").update(key).digest("hex").slice(0, 10); }
async function writeThumbnail(draft) {
  const dir = path.join(BASE, "thumbnails");
  await mkdir(dir, { recursive: true });
  const label = draft.type === "paid_how_to" ? "有料記事の設計" : "無料記事の入口";
  const shortTitle = draft.title.replace(/^(無料公開:|実践手順:)\s*/, "").slice(0, 22);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="670" viewBox="0 0 1280 670"><rect width="1280" height="670" fill="#f4efe6"/><rect x="70" y="70" width="1140" height="530" rx="28" fill="#173f4a"/><path d="M70 520h1140v80H70z" fill="#e2a84b"/><text x="125" y="165" fill="#e2a84b" font-size="28" font-family="sans-serif" font-weight="700">NOTE MONETIZATION LAB / ${label}</text><text x="125" y="285" fill="#fffaf0" font-size="58" font-family="sans-serif" font-weight="700">${shortTitle.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text><text x="125" y="370" fill="#d5e0dc" font-size="30" font-family="sans-serif">タイトル・画像・有料ラインを実務で改善する</text><text x="125" y="555" fill="#173f4a" font-size="26" font-family="sans-serif" font-weight="700">読者の悩みを、次の行動へ。</text></svg>`;
  const file = `${today}-${draft.key.split(":")[2]}-${draft.type}.svg`;
  await writeFile(path.join(dir, file), svg, "utf8");
  return path.relative(ROOT, path.join(dir, file));
}
function publicDraft(topic) {
  const title = `無料公開: ${topic.subject}を最初に改善する3つの確認点`;
  return {
    key: `lab:public:${topic.slug}`,
    type: "public_teaser",
    visibility: "public",
    title,
    tags: ["note収益化", "コンテンツ販売", "文章術"],
    body: `# ${title}\n\n## この記事を届けたい人\n\n${topic.subject}と感じている人向けです。\n\n## 先に結論\n\n${topic.cause}が起きている可能性があります。この記事では、公開前に確認できる3つのポイントを整理します。\n\n## なぜ開かれないのか\n\n読者は本文を読む前に、タイトルと1枚目画像だけで「自分向けか」「読む価値があるか」を判断します。ここで情報が足りないと、内容が良くても本文まで届きません。\n\n## 最初に確認する3つ\n\n- 誰の悩みを解決する記事か、タイトルだけで分かるか\n- 読後に何ができるか、タイトルに変化があるか\n- 1枚目画像がタイトルの繰り返しではなく、判断材料になっているか\n\n## 今日できる改善\n\nタイトルを「対象者 + 悩み + 得られる変化」に書き換え、画像には短い言葉で「何を直す記事か」を置きます。\n\n## 有料版で扱うこと\n\n有料版では、${topic.template}と具体例を使って、自分の記事をその場で修正できる手順にします。\n\n## 次の一歩\n\nこの記事を保存し、次に記事を公開するときに3項目を確認してください。\n`,
  };
}
function paidDraft(topic) {
  const title = `実践手順: ${topic.subject}を改善するテンプレート`;
  return {
    key: `lab:paid:${topic.slug}`,
    type: "paid_how_to",
    visibility: "paid",
    price: 980,
    title,
    tags: ["note収益化", "コンテンツ販売", "テンプレート"],
    body: `# ${title}\n\n## 無料部分\n\nこの記事は、${topic.subject}人向けです。\n\n原因は、${topic.cause}です。解決策は、${topic.solution}です。\n\n無料部分では考え方を整理し、有料部分では実際に使える${topic.template}を提供します。\n\n---\n\n## 有料ラインの先で完成するもの\n\n- 自分の記事に合うペルソナ\n- 読者の悩みを一文で表した課題\n- 原因と解決策をつないだ導入文\n- タイトル案3本\n- 1枚目画像に入れる短文\n- 公開前チェックリスト\n\n## 手順1: ペルソナを1人に絞る\n\n「noteを始めて1〜6か月」「記事は書けるが開かれない」「タイトルと画像に自信がない」のように、経験・状態・悩みを具体化します。\n\n## 手順2: 悩みを検索される言葉にする\n\n「売れない」ではなく、「記事が開かれない」「有料部分まで読まれない」のように、読者が自分で言える言葉へ変換します。\n\n## 手順3: タイトルを3案作る\n\n1. ${topic.subject}人が最初に直す3つの場所\n2. ${topic.subject}原因と今日できる改善手順\n3. ${topic.subject}人向けの公開前チェックリスト\n\n## 手順4: 1枚目画像を作る\n\n画像にはタイトル全文を載せず、「開かれない記事の修正点3つ」のような短い判断材料だけを置きます。\n\n## 手順5: 公開前に確認する\n\n- 誰向けか3秒で分かる\n- 悩みが具体的である\n- 読後の変化がある\n- 有料部分に成果物がある\n- 誇張や成果保証がない\n\n## 7日間の実践\n\n1日目にペルソナ、2日目にタイトル、3日目に画像、4日目に無料部分、5日目に有料手順、6日目に第三者視点の確認、7日目に公開後の記録を行います。\n\n## 記録欄\n\n- 表示数:\n- 記事クリック数:\n- 読了・スキ数:\n- 保存数:\n- 購入数:\n- 次回直す点:\n`,
  };
}

async function main() {
  await mkdir(DRAFTS, { recursive: true });
  const ledger = JSON.parse(await readFile(LEDGER, "utf8"));
  const used = new Set([...(ledger.generated || []), ...(ledger.posted || [])].map((x) => x.key));
  const drafts = [];
  for (const topic of topics) {
    const candidates = mode === "public" ? [publicDraft(topic)] : mode === "paid" ? [paidDraft(topic)] : [publicDraft(topic), paidDraft(topic)];
    for (const draft of candidates) {
      if (used.has(draft.key)) continue;
      const file = `${today}-${topic.slug}-${draft.type}.md`;
      await writeFile(path.join(DRAFTS, file), `${draft.body}\n`, "utf8");
      const thumbnail = await writeThumbnail(draft);
      const entry = { ...draft, id: id(`${draft.key}:${today}`), file: path.relative(ROOT, path.join(DRAFTS, file)), thumbnail, generatedAt: new Date().toISOString() };
      delete entry.body;
      drafts.push(entry);
      used.add(draft.key);
    }
  }
  const next = { generated: [...(ledger.generated || []), ...drafts], posted: ledger.posted || [] };
  await writeFile(LEDGER, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await writeFile(LATEST, `${JSON.stringify(drafts, null, 2)}\n`, "utf8");
  console.log(drafts.length ? `Generated ${drafts.length} monetization-lab draft(s).` : "No new monetization-lab drafts.");
  for (const draft of drafts) console.log(`- ${draft.file} (${draft.price ? `${draft.price} yen` : "free"})`);
}
main().catch((error) => { console.error(error); process.exit(1); });
