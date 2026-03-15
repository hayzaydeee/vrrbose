// Polyfill for import.meta.url in esbuild CJS bundles.
// This file is injected at bundle time; its exports become available as globals.
var __import_meta_url = require("url").pathToFileURL(__filename).href;
module.exports = { __import_meta_url };
