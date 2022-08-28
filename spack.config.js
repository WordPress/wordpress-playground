const { config } = require("@swc/core/spack");

module.exports = config({
  entry: {
    web: __dirname + "/src/index.js",
  },
  output: {
    path: __dirname + "/public",
    name: "app.js"
  },
});
