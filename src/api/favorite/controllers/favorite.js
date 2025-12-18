"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::favorite.favorite",
  ({ strapi }) => ({
    /**
     * GET /favorites/article/ids
     */
    async articleIds(ctx) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized();

      const rows = await strapi.entityService.findMany(
        "api::favorite.favorite",
        {
          filters: { user: userId, type: "article" },
          fields: ["itemDocumentId"],
          pagination: { page: 1, pageSize: 1000 },
        }
      );

      ctx.body = {
        ids: (rows ?? [])
          .map((r) => r?.itemDocumentId)
          .filter((x) => typeof x === "string" && x.length > 0),
      };
    },

    /**
     * POST /favorites/toggle
     * body: { type: "article", itemDocumentId: "..." }
     */
    async toggle(ctx) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized();

      const { type, itemDocumentId } = ctx.request.body || {};
      if (!type || !itemDocumentId) {
        return ctx.badRequest("type and itemDocumentId are required");
      }

      if (type !== "article") {
        return ctx.badRequest("Only type=article is supported for now");
      }

      const existing = await strapi.entityService.findMany(
        "api::favorite.favorite",
        {
          filters: { user: userId, type, itemDocumentId },
          fields: ["id"],
          pagination: { page: 1, pageSize: 1 },
        }
      );

      const first = Array.isArray(existing) ? existing[0] : null;

      if (first?.id) {
        await strapi.entityService.delete("api::favorite.favorite", first.id);
        ctx.body = { ok: true, favorited: false };
        return;
      }

      await strapi.entityService.create("api::favorite.favorite", {
        data: { user: userId, type, itemDocumentId },
      });

      ctx.body = { ok: true, favorited: true };
    },
  })
);
