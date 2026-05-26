import { useEffect, useState } from "react";

import {
  loadSaveData,
} from "../../utils/storage";

import {
  updateDailyStreak,
} from "../../utils/dailyStreak";

import {
  getLevelProgress,
  getNextLevelExp,
  getCurrentLevel,
} from "../../utils/levelCalc";

import LevelUpModal
  from "../LevelUpModal";

import SaveToast
  from "../SaveToast";

export default function DashboardClient() {

  const [saveData, setSaveData] =
    useState(null);

  const [levelUpOpen, setLevelUpOpen] =
    useState(false);

  const [saveOpen, setSaveOpen] =
    useState(false);

  useEffect(() => {

    updateDailyStreak();

    const data = loadSaveData();

    const prevLevel =
      Number(
        localStorage.getItem(
          "prevLevel"
        ) || 1
      );

    const currentLevel =
      getCurrentLevel(
        data.totalExp
      );

    if (currentLevel > prevLevel) {

      setLevelUpOpen(true);

      localStorage.setItem(
        "prevLevel",
        currentLevel
      );
    }

    setSaveOpen(true);

    setTimeout(() => {

      setSaveOpen(false);

    }, 2500);

    setSaveData(data);

  }, []);

  if (!saveData) {
    return null;
  }

  const progress =
    getLevelProgress(
      saveData.totalExp
    );

  const nextExp =
    getNextLevelExp(
      saveData.currentLevel
    );

  return (

    <>

      <LevelUpModal
        open={levelUpOpen}
        level={saveData.currentLevel}
        onClose={() =>
          setLevelUpOpen(false)
        }
      />

      <SaveToast
        open={saveOpen}
      />

      <section className="dashboard-panel">

        <h2>
          Guild Status
        </h2>

        <div className="dashboard-box">

          <div className="dashboard-top">

            <div>
              <span>LEVEL</span>

              <strong>
                LV {saveData.currentLevel}
              </strong>
            </div>

            <div>
              <span>TOTAL EXP</span>

              <strong>
                {saveData.totalExp}
              </strong>
            </div>

            <div>
              <span>LEARNED</span>

              <strong>
                {saveData.learnedArticles.length}
              </strong>
            </div>

            <div>
              <span>QUEST</span>

              <strong>
                {saveData.completedQuests.length}
              </strong>
            </div>

            <div>
              <span>STREAK</span>

              <strong>
                🔥 {saveData.dailyStreak}
              </strong>
            </div>

          </div>

          <div className="exp-wrapper">

            <div className="exp-info">

              EXP :
              {" "}
              {saveData.totalExp}
              {" / "}
              {nextExp}

            </div>

            <div className="exp-bar">

              <div
                className="exp-fill"
                style={{
                  width: `${progress}%`,
                }}
              />

            </div>

          </div>

        </div>

      </section>

      <style jsx>{`

        .save-toast {
          position: fixed;

          top: 24px;
          right: 24px;

          width: 280px;

          background:
            linear-gradient(
              180deg,
              #0f172a,
              #020617
            );

          border:
            1px solid #22c55e;

          border-radius: 18px;

          padding: 1rem 1.2rem;

          overflow: hidden;

          z-index: 9999;

          box-shadow:
            0 0 30px
            rgba(34,197,94,.25);

          animation:
            toastIn .35s ease;
        }

        .save-light {
          position: absolute;

          inset: -100px;

          background:
            radial-gradient(
              circle,
              rgba(34,197,94,.18),
              transparent 70%
            );

          animation:
            pulse 2s infinite;
        }

        .save-toast strong {
          position: relative;

          display: block;

          color: #4ade80;

          margin-bottom: .4rem;
        }

        .save-toast p {
          position: relative;

          color: #cbd5e1;

          font-size: .9rem;
        }

        .levelup-overlay {
          position: fixed;
          inset: 0;

          background:
            rgba(0,0,0,.75);

          display: flex;

          align-items: center;
          justify-content: center;

          z-index: 9998;
        }

        @keyframes toastIn {
          from {
            opacity: 0;
            transform:
              translateY(-20px);
          }

          to {
            opacity: 1;
            transform:
              translateY(0);
          }
        }

        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: .6;
          }

          50% {
            transform: scale(1.1);
            opacity: 1;
          }

          100% {
            transform: scale(1);
            opacity: .6;
          }
        }

      `}</style>

    </>
  );
}
