const fs = require("fs");
const path = require("path");

const directory = path.resolve(__dirname, "..", "..", "dist", "esm");
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, "package.json"), '{"type":"module"}\n');
