const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const targets = [
  "install.html",
  "install.js",
  "remove-installer.js",
  "remove-installer.ps1",
];

for (const target of targets) {
  const resolved = path.resolve(root, target);
  const insideRoot = resolved === root || resolved.startsWith(root + path.sep);

  if (!insideRoot) {
    throw new Error(`Refusing to remove path outside project: ${resolved}`);
  }

  if (fs.existsSync(resolved)) {
    fs.rmSync(resolved, { force: true });
    console.log(`removed ${target}`);
  }
}

console.log("Installer files removed. Keep index.html, app.js, styles.css, config.js, assets, supabase, and proxy files as needed.");
