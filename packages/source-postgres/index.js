"use strict";

function sources() {
  try { return require("@zabarov/mirai/sources"); }
  catch (error) {
    if (error && error.code !== "MODULE_NOT_FOUND") throw error;
    return require("../../dist/cjs/sources/index.js");
  }
}

module.exports = { createPostgresSourceProvider: (client, templates) => sources().createSqlSourceProvider("postgres", client, templates) };
