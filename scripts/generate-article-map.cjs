const fs = require("fs");

const categories = {
  basic: [
    "FXとは",
    "通貨ペアとは",
    "lotとは",
  ],

  technical: [
    "RSIとは",
    "MACDとは",
    "移動平均線とは",
  ],

  risk: [
    "損切りとは",
    "資金管理とは",
  ],

  mental: [
    "ポジポジ病とは",
    "FOMOとは",
  ],
};

const result = [];

Object.entries(categories).forEach(
  ([category, articles]) => {

    articles.forEach((article) => {

      result.push({
        category,
        article,
      });

    });

  }
);

fs.writeFileSync(
  "article-map.json",
  JSON.stringify(result, null, 2)
);

console.log("article-map.json generated");
