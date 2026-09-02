"use strict";

function sources() {
  try { return require("@zabarov/mirai/sources"); }
  catch (error) {
    if (error && error.code !== "MODULE_NOT_FOUND") throw error;
    return require("../../dist/cjs/sources/index.js");
  }
}

module.exports = { createMysqlSourceProvider: (client, templates) => sources().createSqlSourceProvider("mysql", client, templates) };
