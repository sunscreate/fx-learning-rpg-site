import fs from "fs";
import path from "path";
import { articleTopics } from "./generated-massive-topics.js";

function extractKeyword(title) {
  return title
    .replace("とは？", "")
    .replace("初心者向け解説", "")
    .replace("使い方", "")
    .replace("見方", "")
    .replace("注意点", "")
    .replace("失敗例", "")
    .replace("勝てない原因", "")
    .replace("実戦での使い方", "")
    .replace("おすすめしない場面", "")
    .replace("FX初心者が最初に覚えるべき理由", "")
    .replace("よくある勘違い", "")
    .replace("環境認識との関係", "")
    .replace("損切りとの関係", "")
    .replace("勝ってる人の考え方", "")
    .replace("負ける人の特徴", "");
}

function buildArticle(category, slug, title, level) {
  const keyword = extractKeyword(title);

  return `---
title: "${title}"
description: "${title}をFX初心者向けにわかりやすく解説。${keyword}の基本、注意点、実戦での使い方まで整理します。"
level: ${level}
category: "${category}"
tags:
  - "${keyword}"
  - "FX初心者"
  - "SEO記事"
---

# ${title}

## このQUESTで学べること

この記事では、**${keyword}**について初心者向けに解説します。

FXでは、知識をただ覚えるだけでは不十分です。

大事なのは、

- どんな場面で使うのか
- どんな失敗が起きやすいのか
- 実戦でどう判断するのか

まで理解することです。

---

## RPGで例えると？

${keyword}は、RPGでいうと「装備やスキルの効果説明」に近いです。

効果を知らずに装備しても、  
どの場面で強いのか、どの場面で危ないのかがわかりません。

FXでも同じです。

知識は、  
「覚える」よりも  
「使いどころを知る」  
ことが重要です。

---

## ${keyword}の基本

${keyword}は、FX学習において重要な知識のひとつです。

特に初心者は、  
言葉だけを覚えて満足してしまうことがあります。

しかし実戦では、  
その知識が相場のどの場面で役立つのかを理解していないと、判断ミスにつながります。

---

## 初心者がやりがちな失敗

${keyword}で初心者がやりがちな失敗は次の通りです。

- 意味だけ覚えて実戦で使えない
- 単独の根拠として使ってしまう
- 損切りを考えずに判断する
- 検証せずに本番で使う
- 勝てるサインだと思い込む

FXで大事なのは、  
「これが出たら勝ち」ではありません。

複数の根拠を組み合わせて、  
負ける可能性を減らすことです。

---

## 実戦での使い方

実戦では、${keyword}だけで判断しません。

必ず次の流れで確認します。

1. 上位足の方向を見る
2. 現在の相場がトレンドかレンジか確認する
3. 損切り位置を先に決める
4. リスクリワードを確認する
5. エントリー根拠を複数そろえる

この流れを守ることで、  
感覚だけのトレードを減らせます。

---

## 注意点

${keyword}は便利な知識ですが、万能ではありません。

特に注意すべき場面は次の通りです。

- 経済指標の直前直後
- 急騰急落の直後
- 根拠が1つしかない場面
- 損切り幅が広すぎる場面
- 焦って入りたくなっている場面

相場では、  
「使える場面」よりも  
「使わない方がいい場面」  
を知ることが重要です。

---

## まとめ

${keyword}は、FX学習において重要な知識です。

ただし、単独で使うのではなく、

- 環境認識
- 損切り
- 資金管理
- リスクリワード
- 検証

とセットで考える必要があります。

次のQUESTでは、関連する知識もあわせて確認していきましょう。
`;
}

for (const topic of articleTopics) {
  const [category, slug, title, level] = topic;

  const dir = `src/content/${category}`;
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${slug}.md`);

  fs.writeFileSync(
    filePath,
    buildArticle(category, slug, title, level)
  );

  console.log(`Generated: ${filePath}`);
}

console.log("Massive SEO articles generated.");
