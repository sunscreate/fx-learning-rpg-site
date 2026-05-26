import {
  useEffect,
  useState,
} from "react";

export default function SaveToast() {

  const [show, setShow] =
    useState(false);

  useEffect(() => {

    const showToast = () => {

      setShow(true);

      setTimeout(() => {

        setShow(false);

      }, 2500);
    };

    window.addEventListener(
      "fxquest-save",
      showToast
    );

    return () => {

      window.removeEventListener(
        "fxquest-save",
        showToast
      );
    };

  }, []);

  if (!show) return null;

  return (

    <div className="save-toast">

      💾 SAVE COMPLETE

    </div>
  );
}
