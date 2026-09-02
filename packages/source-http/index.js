"use strict";

const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const { Readable } = require("node:stream");

function sources() {
  try { return require("@zabarov/mirai/sources"); }
  catch (error) {
    if (error && error.code !== "MODULE_NOT_FOUND") throw error;
    return require("../../dist/cjs/sources/index.js");
  }
}

function pinnedFetcher(input, init, context) {
  const url = new URL(input);
  const addresses = Array.isArray(context && context.approved_addresses) ? context.approved_addresses : [];
  if (!addresses.length || context.hostname !== url.hostname) return Promise.reject(new Error("http_pinned_addresses_required"));
  const approved = addresses.map((address) => ({ address, family: net.isIP(address) }));
  if (approved.some((entry) => !entry.family)) return Promise.reject(new Error("http_pinned_address_invalid"));
  const lookup = (_hostname, options, callback) => {
    if (options && options.all) callback(null, approved);
    else callback(null, approved[0].address, approved[0].family);
  };
  const headers = Object.fromEntries(new Headers(init.headers || {}).entries());
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request(url, {
      method: init.method || "GET",
      headers,
      lookup,
      agent: false,
      signal: init.signal
    }, (response) => {
      const responseHeaders = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (Array.isArray(value)) value.forEach((item) => responseHeaders.append(name, item));
        else if (value !== undefined) responseHeaders.set(name, String(value));
      }
      const status = response.statusCode || 500;
      const body = status === 204 || status === 205 || status === 304 ? null : Readable.toWeb(response);
      resolve(new Response(body, { status, statusText: response.statusMessage, headers: responseHeaders }));
    });
    request.once("error", reject);
    request.end();
  });
}

function createHttpSourceProvider(options = {}) {
  return sources().createHttpSourceProvider({
    ...options,
    fetcher: options.fetcher || pinnedFetcher
  });
}

module.exports = { createHttpSourceProvider, pinnedFetcher };
