import {
  isLevelUnlocked,
  getRequiredCount,
} from "../utils/unlockSystem";

export default function LevelCard({
  level,
}) {

  const unlocked =
    isLevelUnlocked(level.id);

  return (

    <div
      className={
        unlocked
          ? "level-card"
          : "level-card locked"
      }
    >

      <span>
        LEVEL {level.id}
      </span>

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
            QUEST開始 →
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
