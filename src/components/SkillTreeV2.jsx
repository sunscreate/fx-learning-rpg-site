import {
  useEffect,
  useState,
} from "react";

import {
  loadSaveData,
} from "../utils/storage";

import {
  mainQuestList,
} from "../data/mainQuestList";

import {
  mainQuestTitles,
} from "../data/mainQuestTitles";

export default function SkillTreeV2() {

  const [saveData, setSaveData] =
    useState(loadSaveData());

  useEffect(() => {

    const sync = () => {
      setSaveData(loadSaveData());
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

  const currentLevel =
    saveData.currentLevel || 1;

  const learned = [
    ...(saveData.learnedArticles || []),
    ...(saveData.completedQuests || []),
  ];

  const slugs =
    mainQuestList[currentLevel] || [];

  const skills =
    slugs.map((slug) => ({
      slug,
      title:
        mainQuestTitles[slug] ||
        slug,
    }));

  const completed =
    skills.filter((skill) =>
      learned.includes(skill.slug)
    ).length;

  const progress =
    skills.length
      ? Math.round(
          (completed / skills.length) * 100
        )
      : 0;

  return (

    <section className="skilltree-v2">

      <div className="skilltree-header">
        <div>
          <p className="skilltree-label">
            MAIN QUEST TREE
          </p>

          <h2>
            LEVEL {currentLevel} スキルツリー
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
