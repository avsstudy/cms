"use strict";

const { createCoreController } = require("@strapi/strapi").factories;
const { MeiliSearch } = require("meilisearch");

const getMeiliClient = (strapi) => {
  const pluginConfig = strapi.config.get("plugin.meilisearch") || {};
  const fromPlugin = pluginConfig.config || {};

  const host = fromPlugin.host || process.env.MEILISEARCH_HOST;
  const apiKey = fromPlugin.apiKey || process.env.MEILISEARCH_ADMIN_API_KEY;

  if (!host) {
    strapi.log.error(
      "[meilisearch] host не налаштований (plugin.meilisearch.config.host або MEILISEARCH_HOST)"
    );
  }
  if (!apiKey) {
    strapi.log.error(
      "[meilisearch] apiKey не налаштований (plugin.meilisearch.config.apiKey або MEILISEARCH_ADMIN_API_KEY)"
    );
  }

  return new MeiliSearch({ host, apiKey });
};

module.exports = createCoreController(
  "api::handbook.handbook",
  ({ strapi }) => ({
    async views(ctx) {
      const id = Number(ctx.params.id);
      if (!id) return ctx.badRequest("Invalid id");

      try {
        const row = await strapi.db
          .connection("handbooks")
          .where({ id })
          .increment("views", 1)
          .returning(["id", "views"]);
        const updated = row?.[0];
        if (!updated) return ctx.notFound("Handbook not found");
        ctx.body = { id: updated.id, views: updated.views };
      } catch (e) {
        const entity = await strapi.entityService.findOne(
          "api::handbook.handbook",
          id,
          { fields: ["views"], status: "any" }
        );
        if (!entity) return ctx.notFound("Handbook not found");
        const nextViews = (entity.views || 0) + 1;
        const updated = await strapi.entityService.update(
          "api::handbook.handbook",
          id,
          { data: { views: nextViews } }
        );
        ctx.body = { id, views: updated.views };
      }
    },
    async search(ctx) {
      const { q = "", topics, page = 1, pageSize = 10 } = ctx.request.query;

      const pageNum = Number(page) || 1;
      const limit = Number(pageSize) || 10;
      const offset = (pageNum - 1) * limit;

      const meiliClient = getMeiliClient(strapi);
      const index = meiliClient.index("handbook");

      const filters = [];

      if (topics) {
        const ids = String(topics)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        if (ids.length) {
          filters.push(`topicIds IN [${ids.join(", ")}]`);
        }
      }

      const searchOptions = {
        limit,
        offset,
        sort: ["publishedAt:desc"],
      };

      if (filters.length) {
        searchOptions.filter = filters.join(" AND ");
      }

      const result = await index.search(q, searchOptions);
      const hits = result.hits || [];

      const total = result.estimatedTotalHits ?? result.nbHits ?? hits.length;
      const pageCount = total > 0 ? Math.ceil(total / limit) : 0;

      const normalized = hits.map((hit) => ({
        id: hit.id,
        slug: hit.slug,
        title: hit.title,
        description: hit.description,
        publishedAt: hit.publishedAt || null,
        views: hit.views ?? 0,
        pinned: hit.pinned ?? false,
        documentId: hit.documentId,

        subscription_type: hit.subscription_type ?? null,
        topic: Array.isArray(hit.topic) ? hit.topic : [],
        authors: Array.isArray(hit.authors) ? hit.authors : [],
      }));

      ctx.body = {
        data: normalized,
        meta: {
          pagination: {
            page: pageNum,
            pageSize: limit,
            total,
            pageCount,
          },
        },
      };
    },
  })
);
