"use strict";

module.exports = {
  /**
   * Щодня о 03:15 (час сервера) "15 3 * * *".
   */
  "* * * * *": async ({ strapi }) => {
    const now = new Date();
    strapi.log.info(`[CRON] expire packages start ${now.toISOString()}`);

    const batchSize = 200;
    let start = 0;
    let total = 0;

    while (true) {
      const users = await strapi.entityService.findMany(
        "plugin::users-permissions.user",
        {
          filters: {
            package: { id: { $notNull: true } },
            packageActiveUntil: { $notNull: true, $lte: now },
          },
          fields: ["id", "packageActiveUntil"],
          populate: { package: { fields: ["id"] } },
          sort: { id: "asc" },
          start,
          limit: batchSize,
        }
      );

      if (!users?.length) break;

      for (const u of users) {
        await strapi.entityService.update(
          "plugin::users-permissions.user",
          u.id,
          { data: { package: null } }
        );
        total += 1;
      }

      start += users.length;
      if (users.length < batchSize) break;
    }

    strapi.log.info(`[CRON] expire packages done; cleared=${total}`);
  },
};
