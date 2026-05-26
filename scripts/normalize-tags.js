import fs from "fs";
import path from "path";

const contentDir = "./src/content";

const tagMap = {
  "Bid/Ask": "Bid-Ask",
  "bid": "Bid-Ask",
  "ask": "Bid-Ask",

  "high": "高値・安値",
  "low": "高値・安値",

  "n": "N字",
  "pattern": "N字",

  "channel": "チャネルライン",
  "line": "チャネルライン",

  "volatility": "ボラティリティ",

  "auto": "自動売買",
  "trading": "自動売買",

  "backtest": "バックテスト",

  "risk": "リスク管理",
  "management": "リスク管理",

  "position": "ポジション管理",
  "diversification": "分散",

  "bankruptcy": "破産確率",
  "probability": "破産確率",
};

function walk(dir) {

  const files = fs.readdirSync(dir);

  for (const file of files) {

    const fullPath = path.join(dir, file);

    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {

      walk(fullPath);

    } else if (file.endsWith(".md")) {

      normalizeTags(fullPath);

    }

  }

}

function normalizeTags(filePath) {

  let content =
    fs.readFileSync(filePath, "utf-8");

  for (const [from, to] of Object.entries(tagMap)) {

    const regex =
      new RegExp(`- "${from}"`, "g");

    content =
      content.replace(regex, `- "${to}"`);

  }

  fs.writeFileSync(filePath, content);

  console.log(`Normalized: ${filePath}`);

}

walk(contentDir);

console.log("Tag normalization complete.");
