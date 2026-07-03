import { defineConfig } from "deepsec/config";

export default defineConfig({
  projects: [
    { id: "Genesis", root: ".." },
    // <deepsec:projects-insert-above>
  ],
});
