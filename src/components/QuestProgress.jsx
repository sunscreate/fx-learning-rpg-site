import {
  useEffect,
  useState,
} from "react";

import {
  loadSaveData,
} from "../utils/storage";

const quests = {
  1: [
    {
      slug: "what-is-fx",
      title: "FXとは？",
    },
    {
      slug: "currency-pair",
      title: "通貨ペアとは？",
    },
    {
      slug: "what-is-leverage",
      title: "レバレッジとは？",
    },
    {
      slug: "spread",
      title: "スプレッドとは？",
    },
  ],
};

export default function QuestProgress() {

  const [saveData, setSaveData] =
    useState(
      loadSaveData()
    );

  useEffect(() => {

    const sync = () => {

      setSaveData(
        loadSaveData()
      );
    };

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

  const currentLevel =
    saveData.currentLevel;

  const currentQuests =
    quests[currentLevel] || [];

  const completed =
    currentQuests.filter(
      (quest) =>
        saveData.learnedArticles.includes(
          quest.slug
        )
    ).length;

  const progress =
    currentQuests.length
      ? Math.floor(
          (
            completed /
            currentQuests.length
          ) * 100
        )
      : 0;

  return (

    <section className="quest-progress">

      <h2>
        LEVEL {currentLevel} QUEST
      </h2>

      <div className="quest-box">

        {
          currentQuests.map((quest) => {

            const learned =
              saveData.learnedArticles.includes(
                quest.slug
              );

            return (

              <div
                key={quest.slug}
                className={
                  learned
                    ? "quest-item learned"
                    : "quest-item"
                }
              >

                <span>
                  {learned ? "✅" : "⬜"}
                </span>

                <p>
                  {quest.title}
                </p>

              </div>

            );
          })
        }

        <div className="quest-percent">

          QUEST Progress
          {" "}
          {progress}%

        </div>

      </div>

    </section>
  );
}
