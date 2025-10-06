"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::article.article", ({ strapi }) => ({
  async views(ctx) {
    const id = Number(ctx.params.id);
    if (!id) return ctx.badRequest("Invalid id");

    try {
      const row = await strapi.db
        .connection("articles")
        .where({ id })
        .increment("views", 1)
        .returning(["id", "views"]);
      const updated = row?.[0];
      if (!updated) return ctx.notFound("Article not found");
      ctx.body = { id: updated.id, views: updated.views };
    } catch (e) {
      const entity = await strapi.entityService.findOne(
        "api::article.article",
        id,
        { fields: ["views"], status: "any" }
      );
      if (!entity) return ctx.notFound("Article not found");
      const nextViews = (entity.views || 0) + 1;
      const updated = await strapi.entityService.update(
        "api::article.article",
        id,
        { data: { views: nextViews } }
      );
      ctx.body = { id, views: updated.views };
    }
  },
}));
