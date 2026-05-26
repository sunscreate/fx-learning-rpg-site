import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const lessonSchema = z.object({
  title: z.string(),
  description: z.string(),
  level: z.number(),
  category: z.string(),
  tags: z.array(z.string()).default([]),
  order: z.number().default(1),
});

const createLessonCollection = (base: string) =>
  defineCollection({
    loader: glob({ pattern: "**/*.md", base }),
    schema: lessonSchema,
  });

export const collections = {
  basic: createLessonCollection("./src/content/basic"),
  chart: createLessonCollection("./src/content/chart"),
  entry: createLessonCollection("./src/content/entry"),
  technical: createLessonCollection("./src/content/technical"),
  risk: createLessonCollection("./src/content/risk"),
  mental: createLessonCollection("./src/content/mental"),
  market: createLessonCollection("./src/content/market"),
  fundamental: createLessonCollection("./src/content/fundamental"),
  analysis: createLessonCollection("./src/content/analysis"),
  style: createLessonCollection("./src/content/style"),
  advanced: createLessonCollection("./src/content/advanced"),
  operation: createLessonCollection("./src/content/operation"),
  ea: createLessonCollection("./src/content/ea"),
  glossary: createLessonCollection("./src/content/glossary"),
};
