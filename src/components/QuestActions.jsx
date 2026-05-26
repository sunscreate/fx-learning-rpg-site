import {
  addExp,
  markArticleLearned,
} from "../utils/storage";

export default function QuestActions({
  slug,
}) {

  function completeQuest() {

    const success =
      markArticleLearned(slug);

    if (success) {
      addExp(50);
      alert("QUEST CLEAR！ +50 EXP");
    } else {
      alert("このQUESTはクリア済みです");
    }

    window.location.href =
      "/fx-learning-rpg-site/";
  }

  return (
    <div className="quest-actions">
      <button
        className="quest-clear-btn"
        onClick={completeQuest}
      >
        このQUESTを理解した
      </button>
    </div>
  );
}
