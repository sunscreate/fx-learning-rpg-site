const STORAGE_KEY =
  "fx-quest-guild-save";

const defaultSaveData = {
  totalExp: 0,
  learnedArticles: [],
  completedQuests: [],
  dailyStreak: 0,
  lastLoginDate: null,
};

function normalizeSaveData(data = {}) {
  return {
    totalExp:
      Number(data.totalExp || 0),
    learnedArticles:
      Array.isArray(data.learnedArticles)
        ? data.learnedArticles
        : [],
    completedQuests:
      Array.isArray(data.completedQuests)
        ? data.completedQuests
        : [],
    dailyStreak:
      Number(data.dailyStreak || 0),
    lastLoginDate:
      data.lastLoginDate || null,
  };
}

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

    const parsed = {
      ...defaultSaveData,
      ...JSON.parse(raw),
    };

    const data =
      normalizeSaveData(parsed);

    if ("currentLevel" in parsed) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
      );
    }

    return data;

  } catch {

    return normalizeSaveData(
      defaultSaveData
    );
  }
}

export function saveData(data) {

  const saveData =
    normalizeSaveData(data);

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(saveData)
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

  return saveData;
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
