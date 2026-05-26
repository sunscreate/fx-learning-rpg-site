import {
  loadSaveData,
} from "./storage";

const unlockRequirements = {
  2: 3,
  3: 6,
  4: 10,
  5: 15,
  6: 20,
  7: 28,
  8: 36,
  9: 45,
  10: 55,
  11: 65,
  12: 75,
};

export function isLevelUnlocked(
  level
) {

  if (level === 1) {
    return true;
  }

  const data =
    loadSaveData();

  const learned =
    data.learnedArticles.length;

  const required =
    unlockRequirements[level] || 999;

  return learned >= required;
}

export function getRequiredCount(
  level
) {

  return (
    unlockRequirements[level] || 0
  );
}
