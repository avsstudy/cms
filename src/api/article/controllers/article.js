"use strict";

const { createCoreController } = require("@strapi/strapi").factories;
const { MeiliSearch } = require("meilisearch");

const meiliClient = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST,
  apiKey: process.env.MEILISEARCH_ADMIN_API_KEY,
});

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
    const { q = "", topics, page = 1, pageSize = 20 } = ctx.request.query;

    const pageNum = Number(page) || 1;
    const limit = Number(pageSize) || 20;
    const offset = (pageNum - 1) * limit;

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

    const index = meiliClient.index("articles");

    const searchOptions = {
      limit,
      offset,
    };

    if (filters.length) {
      searchOptions.filter = filters.join(" AND ");
    }

    const result = await index.search(q, searchOptions);
    const hits = result.hits || [];

    const hitIds = hits.map((h) => h.id).filter(Boolean);

    if (!hitIds.length) {
      ctx.body = {
        data: [],
        meta: {
          pagination: {
            page: pageNum,
            pageSize: limit,
            total: 0,
            pageCount: 0,
          },
        },
      };
      return;
    }

    const articles = await strapi.entityService.findMany(
      "api::article.article",
      {
        filters: { id: { $in: hitIds } },
        sort: ["article_date:desc"],
        fields: [
          "title",
          "slug",
          "description",
          "publishedAt",
          "documentId",
          "views",
          "article_date",
        ],
        populate: {
          category: { fields: ["title", "id"] },
          cover: { fields: ["url", "alternativeText"] },
          author: { fields: ["name"] },
          topic: { fields: ["title", "id"] },
        },
      }
    );

    const mapById = new Map(articles.map((a) => [a.id, a]));
    const sortedArticles = hitIds.map((id) => mapById.get(id)).filter(Boolean);

    const total =
      result.estimatedTotalHits ?? result.nbHits ?? sortedArticles.length;

    const pageCount = Math.max(1, Math.ceil(total / limit));

    ctx.body = {
      data: sortedArticles.map((article) => ({
        id: article.id,
        attributes: article,
      })),
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
