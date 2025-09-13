"use strict";

module.exports = ({ env }) => {
  const url = env("DATABASE_URL") || process.env.DATABASE_URL;
  if (!url) {
    // Явно впадемо з читабельним меседжем, а не з "charAt"
    throw new Error(
      "DATABASE_URL is missing at build time. " +
        "On DigitalOcean ensure scope = RUN_AND_BUILD_TIME for THIS service and no empty duplicate at service level."
    );
  }

  return {
    connection: {
      client: "postgres",
      connection: {
        // Knex/pg самі розберуть рядок підключення
        connectionString: url,
        // DO зазвичай вимагає SSL; залишай false лише якщо точно не треба
        ssl: env.bool("DATABASE_SSL", true)
          ? { rejectUnauthorized: false }
          : false,
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
