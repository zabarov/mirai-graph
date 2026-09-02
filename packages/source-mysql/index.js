"use strict";

const mysql = require("mysql2/promise");

function sources() {
  try { return require("@zabarov/mirai/sources"); }
  catch (error) {
    if (error && error.code !== "MODULE_NOT_FOUND") throw error;
    return require("../../dist/cjs/sources/index.js");
  }
}

function normalizeStatement(statement) {
  return String(statement).trim().replace(/;\s*$/, "");
}

function createMysqlReadClient(options = {}) {
  const externalPool = options.pool;
  const pool = externalPool || mysql.createPool(
    typeof options === "string"
      ? options
      : options.connectionUri || {
          ...(options.poolConfig || {}),
          waitForConnections: true,
          connectionLimit: Math.max(1, Math.min(Number(options.maxConnections || 4), 16)),
          multipleStatements: false
        }
  );

  return {
    read_only: true,
    async query(statement, params, limits) {
      const maxRows = Math.max(1, Math.floor(limits.max_rows));
      const timeoutMs = Math.max(1, Math.floor(limits.timeout_ms));
      const connection = await pool.getConnection();
      let destroyed = false;
      const abort = () => {
        if (destroyed) return;
        destroyed = true;
        connection.destroy();
      };
      if (limits.signal && limits.signal.aborted) abort();
      else if (limits.signal) limits.signal.addEventListener("abort", abort, { once: true });
      try {
        if (destroyed) throw new Error("mysql_source_query_aborted");
        await connection.query(`SET SESSION MAX_EXECUTION_TIME = ${timeoutMs}`);
        await connection.query("START TRANSACTION READ ONLY");
        const [rows] = await connection.query(
          `SELECT * FROM (${normalizeStatement(statement)}) AS mirai_source LIMIT ?`,
          [...params, maxRows]
        );
        await connection.query("COMMIT");
        if (!Array.isArray(rows)) throw new Error("mysql_read_rows_required");
        return rows;
      } catch (error) {
        try { await connection.query("ROLLBACK"); } catch (_rollbackError) { /* original error remains authoritative */ }
        throw error;
      } finally {
        if (limits.signal) limits.signal.removeEventListener("abort", abort);
        if (!destroyed) connection.release();
      }
    },
    async close() {
      if (!externalPool) await pool.end();
    }
  };
}

function createMysqlSourceProvider(clientOrOptions, templates) {
  const client = clientOrOptions && clientOrOptions.read_only === true && typeof clientOrOptions.query === "function"
    ? clientOrOptions
    : createMysqlReadClient(clientOrOptions);
  const provider = sources().createSqlSourceProvider("mysql", client, templates);
  return Object.assign(provider, {
    close: async () => { if (typeof client.close === "function") await client.close(); }
  });
}

module.exports = { createMysqlReadClient, createMysqlSourceProvider };
