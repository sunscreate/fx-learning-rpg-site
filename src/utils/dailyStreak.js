import {
  loadSaveData,
  saveData,
} from "./storage";

export function updateDailyStreak() {

  const data = loadSaveData();

  const today =
    new Date()
      .toISOString()
      .split("T")[0];

  const last =
    data.lastLoginDate;

  if (!last) {

    data.dailyStreak = 1;

    data.lastLoginDate = today;

    saveData(data);

    return data;
  }

  const todayDate =
    new Date(today);

  const lastDate =
    new Date(last);

  const diff =
    Math.floor(
      (
        todayDate - lastDate
      ) /
      (1000 * 60 * 60 * 24)
    );

  if (diff === 1) {

    data.dailyStreak += 1;

  } else if (diff > 1) {

    data.dailyStreak = 1;
  }

  data.lastLoginDate = today;

  saveData(data);

  return data;
}
