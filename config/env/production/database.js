"use strict";

module.exports = ({ env }) => {
  const url = env("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL is missing at build time.");

  const ca = env("DATABASE_CA"); // багаторядковий вміст CA
  const wantSSL = env.bool("DATABASE_SSL", true);

  const ssl = wantSSL
    ? ca
      ? { ca, rejectUnauthorized: true }
      : { rejectUnauthorized: false }
    : false;

  return {
    connection: {
      client: "postgres",
      connection: {
        connectionString: url,
        ssl,
        schema: env("DATABASE_SCHEMA", "public"),
      },
      pool: {
        min: env.int("DATABASE_POOL_MIN", 2),
        max: env.int("DATABASE_POOL_MAX", 10),
      },
      acquireConnectionTimeout: env.int("DATABASE_CONNECTION_TIMEOUT", 60000),
    },
  };
};
