import {
  useEffect,
} from "react";

export default function LevelUpModal({
  open = false,
  level = 1,
  onClose,
}) {

  useEffect(() => {

    if (!open) {
      return;
    }

    const timer =
      setTimeout(() => {

        onClose?.();

      }, 4000);

    return () =>
      clearTimeout(timer);

  }, [open, onClose]);

  if (!open) return null;

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
