import { defineConfig } from "astro/config";

import react from "@astrojs/react";

export default defineConfig({
  site: "https://sunscreate.github.io",
  base: "/fx-learning-rpg-site",
  output: "static",
  integrations: [react()],
});
