"use strict";

const path = require("path");
const { parse } = require("pg-connection-string");

module.exports = ({ env }) => {
  const isProd = env("NODE_ENV") === "production";

  // У проді примусово використовуємо Postgres, щоб ніколи не впасти на SQLite
  const client = isProd ? "postgres" : env("DATABASE_CLIENT", "sqlite");

  // Безпечник: у проді обовʼязково потрібен DATABASE_URL
  if (isProd && !env("DATABASE_URL")) {
    throw new Error("DATABASE_URL is required in production");
  }

  const mysql = {
    connection: {
      host: env("DATABASE_HOST", "localhost"),
      port: env.int("DATABASE_PORT", 3306),
      database: env("DATABASE_NAME", "strapi"),
      user: env("DATABASE_USERNAME", "strapi"),
      password: env("DATABASE_PASSWORD", "strapi"),
      ssl: env.bool("DATABASE_SSL", false) && {
        key: env("DATABASE_SSL_KEY", undefined),
        cert: env("DATABASE_SSL_CERT", undefined),
        ca: env("DATABASE_SSL_CA", undefined),
        capath: env("DATABASE_SSL_CAPATH", undefined),
        cipher: env("DATABASE_SSL_CIPHER", undefined),
        rejectUnauthorized: env.bool("DATABASE_SSL_REJECT_UNAUTHORIZED", true),
      },
    },
    pool: {
      min: env.int("DATABASE_POOL_MIN", 2),
      max: env.int("DATABASE_POOL_MAX", 10),
    },
  };

  // Postgres: у проді розбираємо DATABASE_URL (DigitalOcean), у деві дозволяємо як URL, так і параметри
  const postgres = (() => {
    const base = {
      pool: {
        min: env.int("DATABASE_POOL_MIN", 2),
        max: env.int("DATABASE_POOL_MAX", 10),
      },
    };

    if (isProd) {
      const { host, port, database, user, password } = parse(
        env("DATABASE_URL")
      );
      return {
        connection: {
          host,
          port,
          database,
          user,
          password,
          // DO часто вимагає SSL; за замовчуванням вмикаємо, з можливістю вимкнути перевірку сертифіката
          ssl: env.bool("DATABASE_SSL", true)
            ? {
                rejectUnauthorized: env.bool(
                  "DATABASE_SSL_REJECT_UNAUTHORIZED",
                  false
                ),
              }
            : false,
          schema: env("DATABASE_SCHEMA", "public"),
        },
        ...base,
      };
    }

    // non-prod
    return {
      connection: {
        connectionString: env("DATABASE_URL"),
        host: env("DATABASE_HOST", "localhost"),
        port: env.int("DATABASE_PORT", 5432),
        database: env("DATABASE_NAME", "strapi"),
        user: env("DATABASE_USERNAME", "strapi"),
        password: env("DATABASE_PASSWORD", "strapi"),
        ssl: env.bool("DATABASE_SSL", false) && {
          key: env("DATABASE_SSL_KEY", undefined),
          cert: env("DATABASE_SSL_CERT", undefined),
          ca: env("DATABASE_SSL_CA", undefined),
          capath: env("DATABASE_SSL_CAPATH", undefined),
          cipher: env("DATABASE_SSL_CIPHER", undefined),
          rejectUnauthorized: env.bool(
            "DATABASE_SSL_REJECT_UNAUTHORIZED",
            true
          ),
        },
        schema: env("DATABASE_SCHEMA", "public"),
      },
      ...base,
    };
  })();

  const sqlite = {
    connection: {
      filename: path.join(
        __dirname,
        "..",
        env("DATABASE_FILENAME", ".tmp/data.db")
      ),
    },
    useNullAsDefault: true,
  };

  const connections = {
    mysql,
    postgres,
    sqlite,
  };

  return {
    connection: {
      client,
      ...connections[client],
      acquireConnectionTimeout: env.int("DATABASE_CONNECTION_TIMEOUT", 60000),
    },
  };
};
