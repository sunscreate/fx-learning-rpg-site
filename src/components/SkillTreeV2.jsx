import {
  useEffect,
  useState,
} from "react";

import {
  loadSaveData,
} from "../utils/storage";

export default function SkillTreeV2() {

  const [learned, setLearned] =
    useState([]);

  useEffect(() => {

    const sync = () => {

      const data =
        loadSaveData();

      setLearned(
        data.learnedArticles || []
      );
    };

    sync();

    window.addEventListener(
      "fxquest-update",
      sync
    );

    return () => {

      window.removeEventListener(
        "fxquest-update",
        sync
      );
    };

  }, []);

  const skills = [
    {
      title: "FXとは？",
      slug: "what-is-fx",
    },
    {
      title: "通貨ペアとは？",
      slug: "currency-pair",
    },
    {
      title: "レバレッジとは？",
      slug: "what-is-leverage",
    },
    {
      title: "スプレッドとは？",
      slug: "spread",
    },
  ];

  return (

    <section className="skilltree-v2">

      <h2>
        SKILL TREE
      </h2>

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
