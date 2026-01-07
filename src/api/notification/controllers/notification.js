"use strict";

/**
 * notification controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::notification.notification",
  ({ strapi }) => ({
    async findMine(ctx) {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized();

      const page = Number(ctx.query.page || 1);
      const pageSize = Math.min(Number(ctx.query.pageSize || 10), 50);
      const start = (page - 1) * pageSize;

      const [results, total] = await Promise.all([
        strapi.entityService.findMany("api::notification.notification", {
          filters: { user: user.id },
          sort: { createdAt: "desc" },
          start,
          limit: pageSize,
          fields: [
            "code",
            "title",
            "notification_text",
            "ctaLabel",
            "ctaUrl",
            "readAt",
            "createdAt",
          ],
        }),
        strapi.entityService.count("api::notification.notification", {
          filters: { user: user.id },
        }),
      ]);

      const pageCount = Math.max(1, Math.ceil(total / pageSize));

      ctx.body = {
        results,
        pagination: { page, pageSize, pageCount, total },
      };
    },

    async unreadCount(ctx) {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized();

      const count = await strapi.entityService.count(
        "api::notification.notification",
        {
          filters: { user: user.id, readAt: null },
        }
      );

      ctx.body = { count };
    },

    async markRead(ctx) {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized();

      const id = ctx.params.id;

      const notif = await strapi.entityService.findOne(
        "api::notification.notification",
        id,
        {
          populate: { user: true },
        }
      );

      if (!notif) return ctx.notFound();
      if (notif.user?.id !== user.id) return ctx.forbidden();

      const updated = await strapi.entityService.update(
        "api::notification.notification",
        id,
        {
          data: { readAt: new Date() },
          fields: ["readAt"],
        }
      );

      ctx.body = updated;
    },
  })
);
