import { useEffect, useState } from "react";

import {
  loadSaveData,
} from "../utils/storage";

import LearnedBadge
  from "./LearnedBadge";

export default function ArticleExpTracker({
  slug,
}) {

  const [learned, setLearned] =
    useState(false);

  useEffect(() => {

    const data =
      loadSaveData();

    setLearned(
      data.learnedArticles.includes(slug)
    );

  }, [slug]);

  return (
    <LearnedBadge learned={learned} />
  );
}
