import {
  useEffect,
  useState,
} from "react";

import {
  loadSaveData,
} from "../utils/storage";

export default function LevelUpModal() {

  const [show, setShow] =
    useState(false);

  const [level, setLevel] =
    useState(1);

  useEffect(() => {

    const checkLevel = () => {

      const data =
        loadSaveData();

      const nextLevel =
        Math.floor(
          data.totalExp / 100
        ) + 1;

      const savedLevel =
        Number(
          localStorage.getItem(
            "fx-last-level"
          ) || 1
        );

      if (
        nextLevel > savedLevel
      ) {

        setLevel(nextLevel);

        setShow(true);

        localStorage.setItem(
          "fx-last-level",
          nextLevel
        );

        setTimeout(() => {

          setShow(false);

        }, 4000);
      }
    };

    checkLevel();

    window.addEventListener(
      "fxquest-update",
      checkLevel
    );

    return () => {

      window.removeEventListener(
        "fxquest-update",
        checkLevel
      );
    };

  }, []);

  if (!show) return null;

  return (

    <div className="levelup-overlay">

      <div className="levelup-modal">

        <h2>
          LEVEL UP！
        </h2>

        <p>
          LV {level}
          {" "}
          に到達しました
        </p>

      </div>

    </div>
  );
}
