import {
  isLevelUnlocked,
  getRequiredCount,
} from "../utils/unlockSystem";

import {
  loadSaveData,
} from "../utils/storage";

import {
  mainQuestList,
} from "../data/mainQuestList";

export default function LevelCard({
  level,
}) {

  const saveData =
    loadSaveData();

  const completed =
    saveData.completedQuests || [];

  const mainQuests =
    mainQuestList[level.id] || [];

  const completedCount =
    mainQuests.filter((slug) =>
      completed.includes(slug)
    ).length;

  const isComplete =
    mainQuests.length > 0 &&
    completedCount >= mainQuests.length;

  const unlocked =
    isLevelUnlocked(level.id);

  const currentLevel =
    saveData.currentLevel || 1;

  const isNext =
    unlocked &&
    !isComplete &&
    level.id === currentLevel;

  let statusLabel =
    "LOCKED";

  if (isComplete) {
    statusLabel = "COMPLETE";
  } else if (isNext) {
    statusLabel = "NEXT QUEST";
  } else if (unlocked) {
    statusLabel = "OPEN";
  }

  return (

    <div
      className={
        unlocked
          ? "level-card"
          : "level-card locked"
      }
    >

      <div className="level-card-top">

        <span>
          LEVEL {level.id}
        </span>

        <strong
          className={
            isComplete
              ? "level-status complete"
              : isNext
              ? "level-status next"
              : unlocked
              ? "level-status open"
              : "level-status locked"
          }
        >
          {statusLabel}
        </strong>

      </div>

      <h3>
        {level.title}
      </h3>

      <p>
        {level.description}
      </p>

      {
        unlocked ? (

          <a
            className="quest-start-btn"
            href={`/fx-learning-rpg-site/level/${level.id}`}
          >
            {isComplete ? "復習する →" : "QUEST開始 →"}
          </a>

        ) : (

          <div className="lock-box">

            🔒 LOCKED

            <small>
              学習記事
              {" "}
              {getRequiredCount(level.id)}
              {" "}
              件で解放
            </small>

          </div>

        )
      }

    </div>
  );
}
