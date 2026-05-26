export function detectTemplateType(title, category, searchIntent) {

  const lower =
    title.toLowerCase();

  if (
    searchIntent === "problem"
  ) {
    return "problem-template";
  }

  if (
    searchIntent === "warning"
  ) {
    return "warning-template";
  }

  if (
    searchIntent === "recommend"
  ) {
    return "recommend-template";
  }

  if (
    category === "ea" ||
    lower.includes("ea") ||
    lower.includes("mql") ||
    lower.includes("自動売買")
  ) {
    return "ea-template";
  }

  if (
    lower.includes("比較") ||
    lower.includes("違い") ||
    lower.includes("vs")
  ) {
    return "comparison-template";
  }

  if (
    lower.includes("faq") ||
    lower.includes("よくある質問")
  ) {
    return "faq-template";
  }

  if (
    lower.includes("メンタル") ||
    lower.includes("心理") ||
    lower.includes("感情") ||
    category === "mental"
  ) {
    return "psychology-template";
  }

  if (
    lower.includes("実戦") ||
    lower.includes("使い方") ||
    lower.includes("手法")
  ) {
    return "practical-template";
  }

  return "beginner-template";
}
