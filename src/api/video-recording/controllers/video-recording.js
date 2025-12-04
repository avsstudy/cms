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
  "api::video-recording.video-recording",
  ({ strapi }) => ({
    async search(ctx) {
      const {
        q = "",
        topics,
        videoTypes,
        excludeTypes,
        page = 1,
        pageSize = 12,
      } = ctx.request.query;

      const pageNum = Number(page) || 1;
      const limit = Number(pageSize) || 12;
      const offset = (pageNum - 1) * limit;

      const meiliClient = getMeiliClient(strapi);
      const index = meiliClient.index("video_recording");

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

      if (videoTypes) {
        const types = String(videoTypes)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (types.length) {
          const quoted = types.map((t) => `"${t}"`).join(", ");
          filters.push(`video_type IN [${quoted}]`);
        }
      }

      if (excludeTypes) {
        const types = String(excludeTypes)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (types.length) {
          const quoted = types.map((t) => `"${t}"`).join(", ");
          filters.push(`video_type NOT IN [${quoted}]`);
        }
      }

      const searchOptions = {
        limit,
        offset,
        sort: ["top:desc", "stream_date:desc", "publishedAt:desc"],
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
        video_type: hit.video_type,
        stream_date: hit.stream_date,
        publishedAt: hit.publishedAt,
        documentId: hit.documentId,
        top: hit.top ?? false,

        card_cover: hit.card_cover
          ? {
              url: hit.card_cover.url,
              alternativeText: hit.card_cover.alternativeText,
            }
          : null,

        topic: Array.isArray(hit.topic) ? hit.topic : [],
        speaker: Array.isArray(hit.speaker) ? hit.speaker : [],
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
