"use strict";

const { Pool } = require("pg");

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

function createPostgresReadClient(options = {}) {
  const externalPool = options.pool;
  const pool = externalPool || new Pool(
    typeof options === "string"
      ? { connectionString: options }
      : {
          ...(options.connectionString ? { connectionString: options.connectionString } : {}),
          ...(options.poolConfig || {}),
          max: Math.max(1, Math.min(Number(options.maxConnections || 4), 16))
        }
  );

  return {
    read_only: true,
    async query(statement, params, limits) {
      const maxRows = Math.max(1, Math.floor(limits.max_rows));
      const timeoutMs = Math.max(1, Math.floor(limits.timeout_ms));
      const connection = await pool.connect();
      try {
        await connection.query("BEGIN READ ONLY");
        await connection.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
        const result = await connection.query({
          text: `SELECT * FROM (${normalizeStatement(statement)}) AS mirai_source LIMIT ${maxRows}`,
          values: params
        });
        await connection.query("COMMIT");
        return result.rows;
      } catch (error) {
        try { await connection.query("ROLLBACK"); } catch (_rollbackError) { /* original error remains authoritative */ }
        throw error;
      } finally {
        connection.release();
      }
    },
    async close() {
      if (!externalPool) await pool.end();
    }
  };
}

function createPostgresSourceProvider(clientOrOptions, templates) {
  const client = clientOrOptions && clientOrOptions.read_only === true && typeof clientOrOptions.query === "function"
    ? clientOrOptions
    : createPostgresReadClient(clientOrOptions);
  const provider = sources().createSqlSourceProvider("postgres", client, templates);
  return Object.assign(provider, {
    close: async () => { if (typeof client.close === "function") await client.close(); }
  });
}

module.exports = { createPostgresReadClient, createPostgresSourceProvider };
