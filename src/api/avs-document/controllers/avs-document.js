"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::avs-document.avs-document",
  ({ strapi }) => ({
    async views(ctx) {
      const id = Number(ctx.params.id);
      if (!id) return ctx.badRequest("Invalid id");

      try {
        const row = await strapi.db
          .connection("avs_documents")
          .where({ id })
          .increment("views", 1)
          .returning(["id", "views"]);
        const updated = row?.[0];
        if (!updated) return ctx.notFound("AVS document not found");
        ctx.body = { id: updated.id, views: updated.views };
      } catch (e) {
        const entity = await strapi.entityService.findOne(
          "api::avs-document.avs-document",
          id,
          { fields: ["views"], status: "any" }
        );
        if (!entity) return ctx.notFound("AVS document not found");
        const nextViews = (entity.views || 0) + 1;
        const updated = await strapi.entityService.update(
          "api::avs-document.avs-document",
          id,
          { data: { views: nextViews } }
        );
        ctx.body = { id, views: updated.views };
      }
    },
  })
);
