"use strict";

module.exports = {
  subscriptionNotifications: {
    task: async ({ strapi }) => {
      const nService = strapi.service("api::notification.notification");
      const now = new Date();

      const MS_DAY = 24 * 60 * 60 * 1000;

      const from = new Date(now.getTime() + 3 * MS_DAY);
      const to = new Date(now.getTime() + 4 * MS_DAY);

      const pageSize = 200;

      try {
        let page = 1;
        while (true) {
          const users = await strapi.entityService.findMany(
            "plugin::users-permissions.user",
            {
              filters: {
                packageActiveUntil: { $gte: from, $lt: to },
                package: { id: { $notNull: true } },
              },
              fields: ["id", "packageActiveUntil"],
              populate: { package: { fields: ["id"] } },
              sort: { id: "asc" },
              limit: pageSize,
              start: (page - 1) * pageSize,
            }
          );

          if (!users?.length) break;

          for (const u of users) {
            const untilIso = new Date(u.packageActiveUntil).toISOString();

            await nService.createNotification({
              userId: u.id,
              code: "SUBSCRIPTION_EXPIRING_3D",
              uniqueKey: `SUBSCRIPTION_EXPIRING_3D:${u.id}:${untilIso}`,
              meta_data: {
                source: "cron",
                packageId: u.package?.id ?? null,
                packageActiveUntil: untilIso,
              },
            });
          }

          if (users.length < pageSize) break;
          page++;
        }
      } catch (e) {
        strapi.log.error("[cron] EXPIRING_3D failed: " + (e?.message || e));
      }

      try {
        let page = 1;
        while (true) {
          const users = await strapi.entityService.findMany(
            "plugin::users-permissions.user",
            {
              filters: {
                packageActiveUntil: { $lt: now },
                package: { id: { $notNull: true } },
              },
              fields: ["id", "packageActiveUntil"],
              populate: { package: { fields: ["id"] } },
              sort: { id: "asc" },
              limit: pageSize,
              start: (page - 1) * pageSize,
            }
          );

          if (!users?.length) break;

          for (const u of users) {
            const untilIso = new Date(u.packageActiveUntil).toISOString();

            await nService.createNotification({
              userId: u.id,
              code: "SUBSCRIPTION_EXPIRED",
              uniqueKey: `SUBSCRIPTION_EXPIRED:${u.id}:${untilIso}`,
              meta_data: {
                source: "cron",
                packageId: u.package?.id ?? null,
                packageActiveUntil: untilIso,
              },
            });
          }

          if (users.length < pageSize) break;
          page++;
        }
      } catch (e) {
        strapi.log.error("[cron] EXPIRED failed: " + (e?.message || e));
      }

      strapi.log.info(
        `[cron] subscriptionNotifications done. expiring window: ${from.toISOString()}..${to.toISOString()}`
      );
    },

    options: {
      rule: "*/30 * * * * *",
      tz: "Europe/Kyiv",
    },
  },
};
