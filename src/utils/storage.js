const STORAGE_KEY =
  "fx-quest-guild-save";

const defaultSaveData = {
  totalExp: 0,
  currentLevel: 1,
  learnedArticles: [],
  completedQuests: [],
  dailyStreak: 0,
  lastLoginDate: null,
};

export function loadSaveData() {

  if (
    typeof localStorage ===
    "undefined"
  ) {
    return defaultSaveData;
  }

  const raw =
    localStorage.getItem(
      STORAGE_KEY
    );

  if (!raw) {
    return defaultSaveData;
  }

  try {

    return {
      ...defaultSaveData,
      ...JSON.parse(raw),
    };

  } catch {

    return defaultSaveData;
  }
}

export function saveData(data) {

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(data)
  );

  window.dispatchEvent(
    new Event("fxquest-update")
  );

  window.dispatchEvent(
    new Event("fxquest-save")
  );
}

export function addExp(amount) {

  const data =
    loadSaveData();

  data.totalExp += amount;

  saveData(data);

  return data;
}

export function markArticleLearned(slug) {

  const data =
    loadSaveData();

  if (
    data.learnedArticles.includes(slug)
  ) {

    return false;
  }

  data.learnedArticles.push(slug);

  saveData(data);

  return true;
}

export function resetSaveData() {

  localStorage.removeItem(
    STORAGE_KEY
  );

  window.dispatchEvent(
    new Event("fxquest-update")
  );

  window.dispatchEvent(
    new Event("fxquest-save")
  );
}
