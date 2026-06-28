import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  // cli.ts has no shebang in source; add it to the built binary.
  banner: { js: "#!/usr/bin/env node" },
});
