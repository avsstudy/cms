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
const getUserFromAuthHeader = async (ctx) => {
  const authHeader = ctx.request.header.authorization || "";
  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) return null;

  try {
    const payload = await strapi
      .plugin("users-permissions")
      .service("jwt")
      .verify(token);

    if (!payload?.id) return null;

    const user = await strapi
      .plugin("users-permissions")
      .service("user")
      .fetchAuthenticatedUser(payload.id);

    return user || null;
  } catch (e) {
    return null;
  }
};

module.exports = createCoreController(
  "api::news-article.news-article",
  ({ strapi }) => ({
    async views(ctx) {
      const id = Number(ctx.params.id);
      if (!id) return ctx.badRequest("Invalid id");

      try {
        const row = await strapi.db
          .connection("news_articles")
          .where({ id })
          .increment("views", 1)
          .returning(["id", "views"]);
        const updated = row?.[0];
        if (!updated) return ctx.notFound("News article not found");
        ctx.body = { id: updated.id, views: updated.views };
      } catch (e) {
        const entity = await strapi.entityService.findOne(
          "api::news-article.news-article",
          id,
          { fields: ["views"], status: "any" }
        );
        if (!entity) return ctx.notFound("News article not found");
        const nextViews = (entity.views || 0) + 1;
        const updated = await strapi.entityService.update(
          "api::news-article.news-article",
          id,
          { data: { views: nextViews } }
        );
        ctx.body = { id, views: updated.views };
      }
    },

    async search(ctx) {
      const {
        q = "",
        topics,
        categories,
        page = 1,
        pageSize = 10,
      } = ctx.request.query;

      const pageNum = Number(page) || 1;
      const limit = Number(pageSize) || 10;
      const offset = (pageNum - 1) * limit;

      const meiliClient = getMeiliClient(strapi);
      const index = meiliClient.index("news-article");

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

      if (categories) {
        const ids = String(categories)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        if (ids.length) {
          filters.push(`categoryIds IN [${ids.join(", ")}]`);
        }
      }

      const searchOptions = {
        limit,
        offset,
      };

      if (filters.length) {
        searchOptions.filter = filters.join(" AND ");
      }

      const result = await index.search(q, searchOptions);
      const hits = (result.hits || []).slice();

      hits.sort((a, b) => {
        const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return db - da;
      });

      const total = result.estimatedTotalHits ?? result.nbHits ?? hits.length;
      const pageCount = total > 0 ? Math.ceil(total / limit) : 0;

      const normalizedNews = hits.map((hit) => ({
        id: hit.id,
        slug: hit.slug,
        title: hit.title,
        description: hit.description,
        views: hit.views ?? 0,
        comments_enabled: !!hit.comments_enabled,
        pinned: !!hit.pinned,
        publishedAt: hit.publishedAt || null,
        documentId: hit.documentId,

        cover: hit.cover
          ? {
              url: hit.cover.url,
              alternativeText: hit.cover.alternativeText,
            }
          : undefined,

        topic: Array.isArray(hit.topic) ? hit.topic : [],
        category: Array.isArray(hit.category) ? hit.category : [],
      }));

      ctx.body = {
        data: normalizedNews,
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

      const freeSubs = await strapi.entityService.findMany(
        "api::subscription.subscription",
        {
          filters: { documentId: FREE_SUB_DOCUMENT_ID },
          fields: ["id", "documentId"],
          limit: 1,
        }
      );

      const freeSubId = freeSubs?.[0]?.id;

      if (!freeSubId) {
        ctx.throw(
          500,
          `Free subscription not found by documentId=${FREE_SUB_DOCUMENT_ID}`
        );
      }

      let user = ctx.state.user || null;
      if (!user) user = await getUserFromAuthHeader(ctx);

      let allowedSubscriptionIds = [freeSubId];

      if (user) {
        const fullUser = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          user.id,
          {
            fields: ["id", "packageActiveUntil"],
            populate: {
              package: {
                fields: ["id", "title"],
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
          const packageSubIds = fullUser.package.subscriptions.map((s) => s.id);
          allowedSubscriptionIds = Array.from(
            new Set([freeSubId, ...packageSubIds])
          );
        }
      }

      const { topics, categories, q, page = "1", pageSize = "10" } = ctx.query;

      const topicIds = topics
        ? String(topics).split(",").map(Number).filter(Boolean)
        : [];

      const categoryIds = categories
        ? String(categories).split(",").map(Number).filter(Boolean)
        : [];

      const filters = {
        publishedAt: { $notNull: true },
        subscriptions: { id: { $in: allowedSubscriptionIds } },
      };

      if (topicIds.length) filters.topic = { id: { $in: topicIds } };
      if (categoryIds.length) filters.category = { id: { $in: categoryIds } };

      if (q && String(q).trim()) {
        const qq = String(q).trim();
        filters.$or = [
          { title: { $containsi: qq } },
          { description: { $containsi: qq } },
        ];
      }

      // 7) fetch
      const result = await strapi.entityService.findPage(
        "api::news-article.news-article",
        {
          sort: ["pinned:desc", "publishedAt:desc"],
          locale: "all",
          fields: [
            "title",
            "slug",
            "description",
            "publishedAt",
            "documentId",
            "views",
            "pinned",
            "comments_enabled",
          ],
          populate: {
            category: { fields: ["title", "id"] },
            cover: { fields: ["url", "alternativeText"] },
            topic: { fields: ["title", "id"] },
            subscriptions: { fields: ["id", "title", "documentId"] },
          },
          filters,
          pagination: { page: Number(page), pageSize: Number(pageSize) },
        }
      );

      ctx.body = {
        data: result.results,
        meta: { pagination: result.pagination },
        access: { allowedSubscriptionIds },
      };
    },
  })
);
