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

module.exports = createCoreController("api::ipk.ipk", ({ strapi }) => ({
  async views(ctx) {
    const id = Number(ctx.params.id);
    if (!id) return ctx.badRequest("Invalid id");

    try {
      const row = await strapi.db
        .connection("ipks")
        .where({ id })
        .increment("views", 1)
        .returning(["id", "views"]);
      const updated = row?.[0];
      if (!updated) return ctx.notFound("IPK not found");
      ctx.body = { id: updated.id, views: updated.views };
    } catch (e) {
      const entity = await strapi.entityService.findOne("api::ipk.ipk", id, {
        fields: ["views"],
        status: "any",
      });
      if (!entity) return ctx.notFound("IPK not found");
      const nextViews = (entity.views || 0) + 1;
      const updated = await strapi.entityService.update("api::ipk.ipk", id, {
        data: { views: nextViews },
      });
      ctx.body = { id, views: updated.views };
    }
  },

  async search(ctx) {
    const {
      q = "",
      topics,
      page = 1,
      pageSize = 10,
      from,
      to,
    } = ctx.request.query;

    const pageNum = Number(page) || 1;
    const limit = Number(pageSize) || 10;
    const offset = (pageNum - 1) * limit;

    const meiliClient = getMeiliClient(strapi);
    const index = meiliClient.index("ipk");

    // 🔹 масив id з query (?topics=74 => [74])
    const topicDpsFilter = topics
      ? String(topics)
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n))
      : [];

    // 🔹 Meili НЕ фільтрує по topicDpsId — тільки q, limit, offset
    const searchOptions = {
      limit,
      offset,
    };

    const result = await index.search(q, searchOptions);
    const hits = (result.hits || []).slice();

    let filteredHits = hits;

    // 1) фільтр по topic_dps (topicDpsId з Meili-документа)
    if (topicDpsFilter.length) {
      filteredHits = filteredHits.filter((hit) => {
        const dpsId = Number(hit.topicDpsId);
        if (!Number.isFinite(dpsId)) return false;
        return topicDpsFilter.includes(dpsId);
      });
    }

    // 2) фільтр по діапазону дат (from / to)
    if (from || to) {
      const fromTs = from ? Date.parse(from) : null;
      const toTs = to ? Date.parse(to) : null;

      filteredHits = filteredHits.filter((hit) => {
        if (!hit.ipk_date) return false;
        const ts = Date.parse(hit.ipk_date);
        if (!Number.isFinite(ts)) return false;

        if (fromTs !== null && ts < fromTs) return false;
        if (toTs !== null && ts > toTs) return false;
        return true;
      });
    }

    // 3) сортування по даті (ipk_date / publishedAt)
    filteredHits.sort((a, b) => {
      const da = a.ipk_date
        ? new Date(a.ipk_date).getTime()
        : a.publishedAt
          ? new Date(a.publishedAt).getTime()
          : 0;

      const db = b.ipk_date
        ? new Date(b.ipk_date).getTime()
        : b.publishedAt
          ? new Date(b.publishedAt).getTime()
          : 0;

      return db - da;
    });

    const total = filteredHits.length;
    const pageCount = total > 0 ? Math.ceil(total / limit) : 0;

    const start = offset;
    const end = offset + limit;
    const pageHits = filteredHits.slice(start, end);

    const normalizedIpks = pageHits.map((hit) => ({
      id: hit.id,
      slug: hit.slug,
      ipk_title: hit.ipk_title,
      description: hit.description,
      ipk_date: hit.ipk_date,
      publishedAt: hit.publishedAt,
      views: hit.views ?? 0,
      documentId: hit.documentId,
      topic: Array.isArray(hit.topic) ? hit.topic : [],
      author: hit.author ?? null,
      subscription_type: hit.subscription_type ?? null,
      topic_dps: hit.topic_dps ?? null,
      ipk_file: hit.ipk_file ?? null,
    }));

    ctx.body = {
      data: normalizedIpks,
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
}));
