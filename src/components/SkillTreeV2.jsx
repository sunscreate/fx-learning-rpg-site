import {
  useEffect,
  useState,
} from "react";

import {
  loadSaveData,
} from "../utils/storage";

const skills = [
  {
    title: "FXとは？",
    slug: "what-is-fx",
  },
  {
    title: "通貨ペアとは？",
    slug: "what-is-currency-pair",
  },
  {
    title: "円高・円安とは？",
    slug: "what-is-yen-weak-strong",
  },
  {
    title: "レバレッジとは？",
    slug: "what-is-leverage",
  },
  {
    title: "証拠金とは？",
    slug: "what-is-margin",
  },
  {
    title: "ロットとは？",
    slug: "what-is-lot",
  },
  {
    title: "pipsとは？",
    slug: "what-is-pips",
  },
  {
    title: "スプレッドとは？",
    slug: "what-is-spread",
  },
  {
    title: "注文方法とは？",
    slug: "order-types",
  },
  {
    title: "取引時間とは？",
    slug: "trading-session",
  },
];

export default function SkillTreeV2() {

  const [learned, setLearned] =
    useState([]);

  useEffect(() => {

    const sync = () => {

      const data =
        loadSaveData();

      setLearned([
        ...(data.learnedArticles || []),
        ...(data.completedQuests || []),
      ]);
    };

    sync();

    window.addEventListener(
      "fxquest-update",
      sync
    );

    window.addEventListener(
      "storage",
      sync
    );

    return () => {

      window.removeEventListener(
        "fxquest-update",
        sync
      );

      window.removeEventListener(
        "storage",
        sync
      );
    };

  }, []);

  const completed =
    skills.filter((skill) =>
      learned.includes(skill.slug)
    ).length;

  const progress =
    Math.round(
      (completed / skills.length) * 100
    );

  return (

    <section className="skilltree-v2">

      <div className="skilltree-header">
        <div>
          <p className="skilltree-label">
            MAIN QUEST TREE
          </p>

          <h2>
            LEVEL1 スキルツリー
          </h2>
        </div>

        <strong>
          {progress}%
        </strong>
      </div>

      <div className="tree-line" />

      {
        skills.map((skill) => {

          const done =
            learned.includes(
              skill.slug
            );

          return (

            <div
              key={skill.slug}
              className={
                done
                  ? "tree-node done"
                  : "tree-node"
              }
            >

              <div className="node-circle">

                {
                  done
                    ? "✓"
                    : ""
                }

              </div>

              <span>
                {skill.title}
              </span>

            </div>

          );
        })
      }

    </section>
  );
}
