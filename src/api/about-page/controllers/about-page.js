"use strict";

/**
 * about-page controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

const ALLOWED_TYPES = [
  "privacy_policy",
  "public_offer",
  "returns_policy",
  "partial_purchase",
];

module.exports = createCoreController(
  "api::about-page.about-page",
  ({ strapi }) => ({
    async findByType(ctx) {
      const page_type = String(ctx.params.page_type || "");

      if (!ALLOWED_TYPES.includes(page_type)) {
        return ctx.badRequest("Invalid page_type");
      }

      const results = await strapi.entityService.findMany(
        "api::about-page.about-page",
        {
          filters: { page_type },
          limit: 1,
          populate: {
            content: true,
          },
        }
      );

      const page = Array.isArray(results) ? results[0] : results;

      if (!page) {
        return ctx.notFound("Page not found");
      }

      return page;
    },
  })
);
