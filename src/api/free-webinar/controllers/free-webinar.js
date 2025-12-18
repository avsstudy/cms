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

      const topicIdsFilter = topics
        ? String(topics)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => Number(s))
            .filter((n) => Number.isFinite(n))
        : [];

      const speakerIdsFilter = speakers
        ? String(speakers)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => Number(s))
            .filter((n) => Number.isFinite(n))
        : [];

      const meiliClient = getMeiliClient(strapi);
      const index = meiliClient.index("free-webinar");

      const searchOptions = {
        limit: 1000,
      };

      const result = await index.search(q, searchOptions);
      const hitsAll = result.hits || [];

      const filtered = hitsAll.filter((hit) => {
        const topicIds = Array.isArray(hit.topicIds) ? hit.topicIds : [];
        const speakerIds = Array.isArray(hit.speakerIds) ? hit.speakerIds : [];

        const topicPass =
          !topicIdsFilter.length ||
          topicIds.some((id) => topicIdsFilter.includes(id));

        const speakerPass =
          !speakerIdsFilter.length ||
          speakerIds.some((id) => speakerIdsFilter.includes(id));

        return topicPass && speakerPass;
      });

      const sorted = filtered.slice().sort((a, b) => {
        const tA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const tB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return tB - tA;
      });

      const total = sorted.length;
      const pageCount = total > 0 ? Math.ceil(total / limit) : 0;

      const start = (pageNum - 1) * limit;
      const end = start + limit;
      const pageItems = sorted.slice(start, end);

      const normalized = pageItems.map((hit) => ({
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
