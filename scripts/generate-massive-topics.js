import fs from "fs";

const patterns = [
  "とは？",
  "初心者向け解説",
  "使い方",
  "見方",
  "注意点",
  "失敗例",
  "勝てない原因",
  "実戦での使い方",
  "おすすめしない場面",
  "FX初心者が最初に覚えるべき理由",
  "よくある勘違い",
  "環境認識との関係",
  "損切りとの関係",
  "勝ってる人の考え方",
  "負ける人の特徴",
];

const categories = {
  basic: [
    ["spread", "スプレッド"],
    ["slippage", "スリッページ"],
    ["swap", "スワップポイント"],
    ["lot", "ロット"],
    ["leverage", "レバレッジ"],
    ["margin", "証拠金"],
    ["stop-out", "ストップアウト"],
    ["bid-ask", "Bid/Ask"],
    ["currency-pair", "通貨ペア"],
    ["pips", "pips"],
  ],

  chart: [
    ["trend-line", "トレンドライン"],
    ["channel-line", "チャネルライン"],
    ["support-resistance", "サポートライン"],
    ["dow-theory", "ダウ理論"],
    ["timeframe", "時間足"],
    ["volatility", "ボラティリティ"],
    ["market-structure", "市場構造"],
    ["high-low", "高値・安値"],
    ["range-market", "レンジ相場"],
    ["breakout", "ブレイクアウト"],
  ],

  entry: [
    ["pullback", "押し目買い"],
    ["retest", "リテスト"],
    ["breakout-entry", "ブレイクアウトエントリー"],
    ["trend-follow", "順張り"],
    ["double-top", "ダブルトップ"],
    ["double-bottom", "ダブルボトム"],
    ["flag", "フラッグ"],
    ["pennant", "ペナント"],
    ["price-action", "プライスアクション"],
    ["n-pattern", "N字"],
  ],
};

let output = `export const articleTopics = [\n`;

for (const [category, keywords] of Object.entries(categories)) {
  for (const [slugBase, keywordJP] of keywords) {
    patterns.forEach((pattern, index) => {
      const slug =
        `what-is-${slugBase}-${index + 1}`;

      const title =
        `${keywordJP}${pattern}`;

      output +=
        `  ["${category}", "${slug}", "${title}", 1],\n`;
    });
  }
}

output += `];\n`;

fs.writeFileSync(
  "./scripts/generated-massive-topics.js",
  output
);

console.log("Japanese SEO massive topics generated.");
