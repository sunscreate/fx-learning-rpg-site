import fs from "fs";
import path from "path";
import { articleTopics } from "./article-topics.js";

function slugToTags(slug) {
  return slug
    .replace("what-is-", "")
    .split("-")
    .filter(Boolean);
}

function buildArticle(category, slug, title, level) {
  const tags = slugToTags(slug);

  return `---
title: "${title}"
description: "${title}をFX初心者向けにわかりやすく解説"
level: ${level}
category: "${category}"
tags:
${tags.map((tag) => `  - "${tag}"`).join("\n")}
---

# ${title}

## このQUESTで学べること

この記事では「${title}」について初心者向けに解説します。

FXでは、知識不足よりも、
「理解したつもり」
が危険です。

このQUESTでは、
実戦で使える形まで整理します。

---

## RPGで例えると？

${title}は、
RPGでいうと「装備効果の理解」に近いです。

理解せずに進むと、
相場ダンジョンで無駄なダメージを受けやすくなります。

---

## ${title}とは？

${title}とは、
FXにおいて重要な基礎知識のひとつです。

初心者はまず：

- なぜ必要なのか
- どこで使うのか
- 何に注意するのか

を理解する必要があります。

---

## 初心者がやりがちな失敗

- 単独で判断する
- 検証しない
- 雰囲気で使う
- 資金管理を無視する

FXでは、
知識を「使う場所」が重要です。

---

## 実戦での使い方

実戦では：

1. 環境認識
2. 相場状況
3. 損切り位置
4. リスクリワード

をセットで考えます。

---

## 注意点

${title}は万能ではありません。

特に：

- 経済指標前
- ボラ急増時
- 感情トレード時

は注意が必要です。

---

## まとめ

${title}は、
FX学習で重要な基礎スキルです。

まずは、
「理解」
↓
「検証」
↓
「実戦」

の順で進めましょう。
`;
}

for (const topic of articleTopics) {
  const [category, slug, title, level] = topic;

  const dir = `src/content/${category}`;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `${slug}.md`);

  fs.writeFileSync(
    filePath,
    buildArticle(category, slug, title, level)
  );

  console.log(`Generated: ${filePath}`);
}

console.log("Bulk SEO article generation complete.");
