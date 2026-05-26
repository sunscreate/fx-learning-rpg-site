import fs from "fs";
import path from "path";

import { articleTopics }
from "./generated-massive-topics.js";

import { detectTemplateType }
from "./template-router.js";

import { detectSearchIntent }
from "./detect-search-intent.js";

function loadTemplate(name) {

  return fs.readFileSync(
    `src/templates/article-types/${name}.md`,
    "utf-8"
  );

}

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
    .replace("負ける人の特徴", "")
    .trim();

}

function applyTemplate(template, data) {

  let result = template;

  for (const [key, value] of Object.entries(data)) {

    const regex =
      new RegExp(`{{${key}}}`, "g");

    result =
      result.replace(regex, value);

  }

  return result;

}

for (const topic of articleTopics) {

  const [
    category,
    slug,
    title,
    level,
  ] = topic;

  const searchIntent =
    detectSearchIntent(title);

  const templateType =
    detectTemplateType(
      title,
      category,
      searchIntent
    );

  const template =
    loadTemplate(templateType);

  const keyword =
    extractKeyword(title);

  const content =
    applyTemplate(template, {
      title,
      description:
        `${title}をFX初心者向けにわかりやすく解説。`,
      level: String(level),
      category,
      searchIntent,
      mainKeyword: keyword,
      keywordA: keyword,
      keywordB: "環境認識",
      tag1: keyword,
      tag2: "FX初心者",
      tag3: category,
    });

  const dir =
    `src/content/${category}`;

  fs.mkdirSync(dir, {
    recursive: true,
  });

  const filePath =
    path.join(dir, `${slug}.md`);

  fs.writeFileSync(
    filePath,
    content
  );

  console.log(
    `Generated (${templateType}): ${filePath}`
  );

}

console.log(
  "Smart AI article generation complete."
);
