"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

const MEDIA_FIELDS = [
  "large_936px",
  "large_736px",
  "large_343px",
  "small_936px",
  "small_736px",
  "small_343px",
];

const PLACEMENTS = [
  "article_list",
  "news_list",
  "ipk_list",
  "expertqa_list",
  "video_list",
  "document_list",
  "handbook_list",
  "article_page",
  "news_page",
  "ipk_page",
  "expertqa_page",
  "document_page",
  "handbook_page",
];

module.exports = createCoreController(
  "api::inner-banner.inner-banner",
  ({ strapi }) => ({
    async byPlacement(ctx) {
      const { placement } = ctx.params;

      if (!PLACEMENTS.includes(placement)) {
        return ctx.badRequest(
          `Invalid placement. Allowed: ${PLACEMENTS.join(", ")}`
        );
      }

      const limit = ctx.query.limit ? Number(ctx.query.limit) : undefined;
      if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
        return ctx.badRequest("limit must be a positive number");
      }

      const populate = MEDIA_FIELDS.reduce((acc, field) => {
        acc[field] = true;
        return acc;
      }, {});

      const filters = {
        banner_status: "active",
        publishedAt: { $notNull: true },
        [placement]: true,
      };

      const entities = await strapi.entityService.findMany(
        "api::inner-banner.inner-banner",
        {
          filters,
          populate,
          sort: ["priority:asc", "createdAt:desc"],
          ...(limit ? { limit } : {}),
        }
      );

      ctx.body = {
        data: entities,
        meta: {
          placement,
          count: entities.length,
        },
      };
    },
  })
);
