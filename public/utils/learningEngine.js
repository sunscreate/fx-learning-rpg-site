const STORAGE_KEY =
  "fxqg_learning_data";

export function getLearningData() {

  if (typeof localStorage === "undefined") {
    return null;
  }

  const raw =
    localStorage.getItem(STORAGE_KEY);

  if (!raw) {

    return {
      completed: [],
      viewed: [],
      tags: {},
      levels: {},
    };

  }

  try {

    return JSON.parse(raw);

  } catch {

    return {
      completed: [],
      viewed: [],
      tags: {},
      levels: {},
    };

  }

}

export function saveLearningData(data) {

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(data)
  );

}

export function markArticleViewed({
  slug,
  level,
  tags = [],
}) {

  const data =
    getLearningData();

  if (
    !data.viewed.includes(slug)
  ) {
    data.viewed.push(slug);
  }

  data.levels[level] =
    (data.levels[level] || 0) + 1;

  tags.forEach((tag) => {

    data.tags[tag] =
      (data.tags[tag] || 0) + 1;

  });

  saveLearningData(data);

}

export function markArticleCompleted(
  slug
) {

  const data =
    getLearningData();

  if (
    !data.completed.includes(slug)
  ) {
    data.completed.push(slug);
  }

  saveLearningData(data);

}

export function getWeakTags() {

  const data =
    getLearningData();

  const entries =
    Object.entries(data.tags);

  return entries
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5)
    .map(([tag]) => tag);

}

export function getStrongLevels() {

  const data =
    getLearningData();

  return Object.entries(data.levels)
    .sort((a, b) => b[1] - a[1]);
}
