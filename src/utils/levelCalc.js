import { expTable } from "../data/expTable";

export function getCurrentLevel(exp) {
  let level = 1;

  for (let i = 0; i < expTable.length; i++) {
    if (exp >= expTable[i]) {
      level = i + 1;
    }
  }

  return level;
}

export function getNextLevelExp(level) {
  return expTable[level] || expTable[expTable.length - 1];
}

export function getLevelProgress(exp) {
  const level = getCurrentLevel(exp);

  const currentLevelExp = expTable[level - 1] || 0;

  const nextLevelExp =
    expTable[level] || expTable[expTable.length - 1];

  const progress =
    ((exp - currentLevelExp) /
      (nextLevelExp - currentLevelExp)) *
    100;

  return Math.min(progress, 100);
}
