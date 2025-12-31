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

    const topicDpsFilter = topics
      ? String(topics)
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n))
      : [];

    const searchOptions = {
      limit,
      offset,
    };

    const result = await index.search(q, searchOptions);
    const hits = (result.hits || []).slice();

    let filteredHits = hits;

    if (topicDpsFilter.length) {
      filteredHits = filteredHits.filter((hit) => {
        const rawId =
          hit.topicDpsId != null
            ? hit.topicDpsId
            : hit.topic_dps && hit.topic_dps.id;

        const dpsId = Number(rawId);
        if (!Number.isFinite(dpsId)) return false;

        return topicDpsFilter.includes(dpsId);
      });
    }

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

    let user = ctx.state?.user || null;
    if (!user) user = await getUserFromAuthHeader(ctx);

    let allowedSubscriptionIds = [freeSubId];

    if (user?.id) {
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

      if (
        isActive &&
        fullUser?.package?.subscriptions &&
        Array.isArray(fullUser.package.subscriptions) &&
        fullUser.package.subscriptions.length
      ) {
        const packageSubIds = fullUser.package.subscriptions.map((s) => s.id);
        allowedSubscriptionIds = Array.from(
          new Set([freeSubId, ...packageSubIds])
        );
      }
    }

    const { topics, q } = ctx.query;
    const pageRaw = ctx.query.page ?? "1";
    const pageSizeRaw = ctx.query.pageSize ?? "10";

    const page = Math.max(1, Number(pageRaw) || 1);
    const pageSize = Math.max(1, Number(pageSizeRaw) || 10);
    const offset = (page - 1) * pageSize;

    const from = ctx.query.from;
    const to = ctx.query.to;

    const topicIds = topics
      ? String(topics)
          .split(",")
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n) && n > 0)
      : [];

    const where = {
      publishedAt: { $notNull: true },
      $or: [
        { subscriptions: { $in: allowedSubscriptionIds } },
        { subscriptions: { $null: true } },
      ],
    };

    if (topicIds.length) {
      where.topic_dps = { $in: topicIds };
    }

    if (from || to) {
      where.ipk_date = {};
      if (from) where.ipk_date.$gte = String(from);
      if (to) where.ipk_date.$lte = String(to);
    }

    if (q && String(q).trim()) {
      const qq = String(q).trim();
      where.$and = [
        {
          $or: [
            { ipk_title: { $containsi: qq } },
            { description: { $containsi: qq } },
          ],
        },
      ];
    }

    const [entries, total] = await strapi.db
      .query("api::ipk.ipk")
      .findWithCount({
        where,
        orderBy: [{ publishedAt: "desc" }],
        offset,
        limit: pageSize,
        select: [
          "id",
          "documentId",
          "ipk_title",
          "slug",
          "ipk_date",
          "views",
          "publishedAt",
          "description",
        ],
        populate: {
          topic: { select: ["id", "title"] },
          author: true,
          topic_dps: true,
          ipk_file: true,
          subscriptions: { select: ["id", "title", "documentId"] },
        },
      });

    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    ctx.body = {
      data: entries,
      meta: {
        pagination: { page, pageSize, pageCount, total },
      },
      access: { allowedSubscriptionIds },
    };
  },
}));
