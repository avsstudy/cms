"use strict";

const { createCoreController } = require("@strapi/strapi").factories;
const { MeiliSearch } = require("meilisearch");

const getMeiliClient = (strapi) => {
  const pluginConfig = strapi.config.get("plugin.meilisearch") || {};
  const fromPlugin = pluginConfig.config || {};

  const host = fromPlugin.host || process.env.MEILISEARCH_HOST;
  const apiKey = fromPlugin.apiKey || process.env.MEILISEARCH_ADMIN_API_KEY;

  return new MeiliSearch({ host, apiKey });
};

module.exports = createCoreController(
  "api::free-webinar.free-webinar",
  ({ strapi }) => ({
    async search(ctx) {
      const {
        q = "",
        topics,
        speakers,
        page = 1,
        pageSize = 10,
      } = ctx.request.query;

      const pageNum = Number(page) || 1;
      const limit = Number(pageSize) || 10;
      const offset = (pageNum - 1) * limit;

      const meiliClient = getMeiliClient(strapi);
      const index = meiliClient.index("free-webinar");

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

      if (speakers) {
        const ids = String(speakers)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        if (ids.length) {
          filters.push(`speakerIds IN [${ids.join(", ")}]`);
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
        webinar_type: hit.webinar_type,
        date_1: hit.date_1,
        date_2: hit.date_2,
        date_3: hit.date_3,
        time: hit.time,
        stream_url: hit.stream_url,
        pinned: hit.pinned ?? false,
        card_cover: hit.card_cover ?? null,
        speaker: hit.speaker ?? [],
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
