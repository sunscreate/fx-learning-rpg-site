import fs from "fs";
import path from "path";

const contentDir = "./src/content";

function getAllMarkdownFiles(dir) {
  let results = [];

  const list = fs.readdirSync(dir);

  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      results = results.concat(getAllMarkdownFiles(filePath));
    } else if (file.endsWith(".md")) {
      results.push(filePath);
    }
  }

  return results;
}

function extractTitle(content) {
  const match = content.match(/title:\s*"(.+)"/);

  return match ? match[1] : "Untitled";
}

function extractCategory(filePath) {
  const parts = filePath.split(path.sep);

  return parts[parts.length - 2];
}

function extractSlug(filePath) {
  return path.basename(filePath, ".md");
}

const files = getAllMarkdownFiles(contentDir);

const articleMap = files.map((file) => {
  const content = fs.readFileSync(file, "utf-8");

  return {
    file,
    title: extractTitle(content),
    category: extractCategory(file),
    slug: extractSlug(file),
  };
});

for (const article of articleMap) {
  const related = articleMap
    .filter(
      (a) =>
        a.category === article.category &&
        a.slug !== article.slug
    )
    .slice(0, 3);

  let content = fs.readFileSync(article.file, "utf-8");

  if (content.includes("## 関連QUEST")) {
    continue;
  }

  const relatedBlock = `
---

## 関連QUEST

${related
  .map(
    (r) =>
      `- [${r.title}](/fx-learning-rpg-site/category/${r.category}/${r.slug}/)`
  )
  .join("\n")}

`;

  content += relatedBlock;

  fs.writeFileSync(article.file, content);

  console.log(`Related added: ${article.slug}`);
}

console.log("Automatic related article generation complete.");
