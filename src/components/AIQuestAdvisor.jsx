import {
  useEffect,
  useState,
} from "react";

import {
  loadSaveData,
} from "../utils/storage";

export default function AIQuestAdvisor() {

  const [message, setMessage] =
    useState("");

  useEffect(() => {

    const data =
      loadSaveData();

    const learned =
      data.learnedArticles || [];

    if (
      learned.length <= 1
    ) {

      setMessage(
        "まずはFX基礎QUESTを進めましょう。"
      );

      return;
    }

    if (
      learned.includes(
        "what-is-fx"
      ) &&
      !learned.includes(
        "what-is-currency-pair"
      )
    ) {

      setMessage(
        "次は通貨ペアQUESTがおすすめです。"
      );

      return;
    }

    if (
      learned.length < 5
    ) {

      setMessage(
        "LEVEL2のチャートQUEST解放を目指しましょう。"
      );

      return;
    }

    if (
      learned.length < 10
    ) {

      setMessage(
        "テクニカル分析QUESTへ進むタイミングです。"
      );

      return;
    }

    setMessage(
      "現在の学習進行は非常に良好です。"
    );

  }, []);

  return (

    <section className="advisor-box">

      <h2>
        AI Guild Advisor
      </h2>

      <p>
        {message}
      </p>

    </section>
  );
}
