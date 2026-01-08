"use strict";

const { DateTime } = require("luxon");

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

      try {
        const nowKyiv = DateTime.now().setZone("Europe/Kyiv");

        const upcomingFrom = nowKyiv.plus({ hours: 24 });
        const upcomingTo = upcomingFrom.plus({ minutes: 2 });

        const startedFrom = nowKyiv.minus({ minutes: 5 });
        const startedTo = nowKyiv;

        const webinars = await strapi.entityService.findMany(
          "api::free-webinar.free-webinar",
          {
            filters: {
              $or: [
                { date_1: { $notNull: true } },
                { date_2: { $notNull: true } },
                { date_3: { $notNull: true } },
              ],
            },
            fields: [
              "id",
              "title",
              "slug",
              "date_1",
              "date_2",
              "date_3",
              "time",
              "stream_url",
            ],
            limit: 1000,
          }
        );

        const makeStart = (dateStr, timeStr) => {
          if (!dateStr || !timeStr) return null;
          const t = String(timeStr).slice(0, 5); // HH:mm
          return DateTime.fromISO(`${dateStr}T${t}`, { zone: "Europe/Kyiv" });
        };

        const upcomingStarts = [];
        const startedStarts = [];

        for (const w of webinars) {
          const dates = [w.date_1, w.date_2, w.date_3].filter(Boolean);

          for (const d of dates) {
            const start = makeStart(d, w.time);
            if (!start || !start.isValid) continue;

            if (start >= upcomingFrom && start < upcomingTo) {
              upcomingStarts.push({ webinar: w, start });
            }

            if (start > startedFrom && start <= startedTo) {
              startedStarts.push({ webinar: w, start });
            }
          }
        }

        if (upcomingStarts.length || startedStarts.length) {
          strapi.log.info(
            `[cron] webinars matched: upcoming=${upcomingStarts.length}, started=${startedStarts.length} kyivNow=${nowKyiv.toISO()}`
          );
        }

        const userPageSize = 300;
        let startIndex = 0;

        while (true) {
          const users = await strapi.entityService.findMany(
            "plugin::users-permissions.user",
            {
              fields: ["id"],
              sort: { id: "asc" },
              limit: userPageSize,
              start: startIndex,
            }
          );

          if (!users?.length) break;

          for (const { webinar, start } of upcomingStarts) {
            const startIso = start.toUTC().toISO();
            for (const u of users) {
              await nService.createNotification({
                userId: u.id,
                code: "WEBINAR_UPCOMING_24H",
                uniqueKey: `WEBINAR_UPCOMING_24H:${u.id}:${webinar.id}:${startIso}`,
                meta_data: {
                  source: "cron",
                  webinarId: webinar.id,
                  free_webinar_title: webinar.title,
                  webinarStartKyiv: start.toISO(),
                  webinarStreamUrl: webinar.stream_url,
                },
                override: {
                  ctaUrl: webinar.stream_url,
                },
              });
            }
          }

          for (const { webinar, start } of startedStarts) {
            const startIso = start.toUTC().toISO();
            for (const u of users) {
              await nService.createNotification({
                userId: u.id,
                code: "WEBINAR_STARTED",
                uniqueKey: `WEBINAR_STARTED:${u.id}:${webinar.id}:${startIso}`,
                meta_data: {
                  source: "cron",
                  webinarId: webinar.id,
                  free_webinar_title: webinar.title,
                  webinarStartKyiv: start.toISO(),
                  webinarStreamUrl: webinar.stream_url,
                },
                override: {
                  ctaUrl: webinar.stream_url,
                },
              });
            }
          }

          if (users.length < userPageSize) break;
          startIndex += userPageSize;
        }
      } catch (e) {
        strapi.log.error("[cron] WEBINARS failed: " + (e?.message || e));
      }

      strapi.log.info(
        `[cron] subscriptionNotifications done. expiring window: ${from.toISOString()}..${to.toISOString()}`
      );
    },

    options: {
      rule: "*/30 * * * * *", // 0 */1 * * * * (раз на хв)
      tz: "Europe/Kyiv",
    },
  },
};
