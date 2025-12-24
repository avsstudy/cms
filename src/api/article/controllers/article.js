"use strict";

const { createCoreController } = require("@strapi/strapi").factories;
const { MeiliSearch } = require("meilisearch");

const meiliClient = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST,
  apiKey: process.env.MEILISEARCH_ADMIN_API_KEY,
});

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

  async search(ctx) {
    const { q = "", topics, page = 1, pageSize = 10 } = ctx.request.query;

    const pageNum = Number(page) || 1;
    const limit = Number(pageSize) || 10;
    const offset = (pageNum - 1) * limit;

    const meiliClient = getMeiliClient(strapi);
    const index = meiliClient.index("article");

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
      sort: ["article_date:desc"],
    };

    if (filters.length) {
      searchOptions.filter = filters.join(" AND ");
    }

    const result = await index.search(q, searchOptions);
    const hits = result.hits || [];

    const total = result.estimatedTotalHits ?? result.nbHits ?? hits.length;
    const pageCount = total > 0 ? Math.ceil(total / limit) : 0;

    const normalizedArticles = hits.map((hit) => ({
      id: hit.id,
      slug: hit.slug,
      title: hit.title,
      publishedAt: hit.publishedAt || hit.article_date || null,
      views: hit.views ?? 0,

      cover: hit.cover
        ? {
            url: hit.cover.url,
          }
        : undefined,

      category: Array.isArray(hit.category) ? hit.category : [],
      topic: Array.isArray(hit.topic) ? hit.topic : [],

      description: hit.description,
      article_date: hit.article_date,
      subscription_type: hit.subscription_type,
      pinned: hit.pinned,
      documentId: hit.documentId,
      author: hit.author ?? null,
    }));

    ctx.body = {
      data: normalizedArticles,
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

  async accessible(ctx) {
    const FREE_SUB_DOCUMENT_ID =
      process.env.FREE_SUBSCRIPTION_DOCUMENT_ID || "eah7di4oabhot416js8ab6mj";

    const user = ctx.state.user || null;
    const { topics, categories, q, page = "1", pageSize = "10" } = ctx.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const sizeNum = Math.max(1, Number(pageSize) || 10);

    const topicIds = topics
      ? String(topics).split(",").map(Number).filter(Boolean)
      : [];

    const categoryIds = categories
      ? String(categories).split(",").map(Number).filter(Boolean)
      : [];

    const freeSubs = await strapi.entityService.findMany(
      "api::subscription.subscription",
      {
        filters: { documentId: FREE_SUB_DOCUMENT_ID },
        fields: ["id", "documentId"],
        populate: {
          articles: { fields: ["id", "documentId"] },
        },
        limit: 1,
      }
    );

    const freeSubscription = freeSubs?.[0] || null;
    const freeSubId = freeSubscription?.id || null;

    if (!freeSubId) {
      ctx.throw(
        500,
        `Free subscription not found by documentId=${FREE_SUB_DOCUMENT_ID}`
      );
    }

    let packageSubIds = [];

    if (user) {
      const fullUser = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        user.id,
        {
          fields: ["id", "packageActiveUntil"],
          populate: {
            package: {
              fields: ["id"],
              populate: {
                subscriptions: { fields: ["id"] },
              },
            },
          },
        }
      );

      const activeUntil = fullUser?.packageActiveUntil
        ? new Date(fullUser.packageActiveUntil).getTime()
        : null;

      const isActive = activeUntil ? activeUntil > Date.now() : false;

      if (isActive && fullUser?.package?.subscriptions?.length) {
        packageSubIds = fullUser.package.subscriptions
          .map((s) => s.id)
          .filter((id) => id && id !== freeSubId);
      }
    }

    const freeArticleRefs = Array.isArray(freeSubscription?.articles)
      ? freeSubscription.articles
      : [];

    let packageArticleRefs = [];

    if (packageSubIds.length) {
      const subs = await strapi.entityService.findMany(
        "api::subscription.subscription",
        {
          filters: { id: { $in: packageSubIds } },
          fields: ["id"],
          populate: {
            articles: { fields: ["id", "documentId"] },
          },
          limit: -1,
        }
      );

      for (const s of subs || []) {
        if (Array.isArray(s?.articles) && s.articles.length) {
          packageArticleRefs.push(...s.articles);
        }
      }
    }

    const seenDoc = new Set();
    const orderedIds = [];

    for (const a of freeArticleRefs) {
      const key = a?.documentId || `id:${a?.id}`;
      if (!seenDoc.has(key) && a?.id) {
        seenDoc.add(key);
        orderedIds.push(a.id);
      }
    }

    for (const a of packageArticleRefs) {
      const key = a?.documentId || `id:${a?.id}`;
      if (!seenDoc.has(key) && a?.id) {
        seenDoc.add(key);
        orderedIds.push(a.id);
      }
    }

    if (!orderedIds.length) {
      ctx.body = {
        data: [],
        meta: {
          pagination: {
            page: pageNum,
            pageSize: sizeNum,
            pageCount: 1,
            total: 0,
          },
        },
        access: { freeSubId, packageSubIds },
      };
      return;
    }

    const articleFilters = {
      publishedAt: { $notNull: true },
      id: { $in: orderedIds },
    };

    if (topicIds.length) articleFilters.topic = { id: { $in: topicIds } };
    if (categoryIds.length)
      articleFilters.category = { id: { $in: categoryIds } };

    if (q && String(q).trim()) {
      const qq = String(q).trim();
      articleFilters.$or = [
        { title: { $containsi: qq } },
        { description: { $containsi: qq } },
      ];
    }

    const fields = [
      "title",
      "slug",
      "description",
      "publishedAt",
      "documentId",
      "views",
      "article_date",
    ];

    const populate = {
      category: { fields: ["title", "id"] },
      cover: { fields: ["url", "alternativeText"] },
      author: { fields: ["name"] },
      topic: { fields: ["title", "id"] },
      subscriptions: { fields: ["id", "title", "documentId"] },
    };

    const found = await strapi.entityService.findMany("api::article.article", {
      locale: "all",
      fields,
      populate,
      filters: articleFilters,
      limit: -1,
    });

    const byId = new Map();
    for (const a of found || []) byId.set(a.id, a);

    const merged = [];
    for (const id of orderedIds) {
      const a = byId.get(id);
      if (a) merged.push(a);
    }

    const total = merged.length;
    const pageCount = Math.max(1, Math.ceil(total / sizeNum));
    const start = (pageNum - 1) * sizeNum;
    const end = start + sizeNum;

    ctx.body = {
      data: merged.slice(start, end),
      meta: {
        pagination: {
          page: pageNum,
          pageSize: sizeNum,
          pageCount,
          total,
        },
      },
      access: { freeSubId, packageSubIds },
    };
  },
}));
