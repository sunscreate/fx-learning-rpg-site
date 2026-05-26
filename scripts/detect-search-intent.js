export function detectSearchIntent(title) {

  const lower =
    title.toLowerCase();

  if (
    lower.includes("とは")
  ) {
    return "definition";
  }

  if (
    lower.includes("初心者")
  ) {
    return "beginner";
  }

  if (
    lower.includes("使い方") ||
    lower.includes("実戦")
  ) {
    return "practical";
  }

  if (
    lower.includes("注意点") ||
    lower.includes("危険")
  ) {
    return "warning";
  }

  if (
    lower.includes("失敗")
  ) {
    return "mistake";
  }

  if (
    lower.includes("勝てない")
  ) {
    return "problem";
  }

  if (
    lower.includes("おすすめ")
  ) {
    return "recommend";
  }

  if (
    lower.includes("比較") ||
    lower.includes("違い")
  ) {
    return "comparison";
  }

  return "general";
}
