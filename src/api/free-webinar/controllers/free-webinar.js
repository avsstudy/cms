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
    async accessible(ctx) {
      const FREE_SUB_DOCUMENT_ID =
        process.env.FREE_SUBSCRIPTION_DOCUMENT_ID || "eah7di4oabhot416js8ab6mj";

      // free subscription
      const freeSubs = await strapi.entityService.findMany(
        "api::subscription.subscription",
        {
          filters: { documentId: FREE_SUB_DOCUMENT_ID },
          fields: ["id", "documentId"],
          limit: 1,
        }
      );

      const freeSubId = freeSubs && freeSubs[0] && freeSubs[0].id;

      if (!freeSubId) {
        ctx.throw(
          500,
          `Free subscription not found by documentId=${FREE_SUB_DOCUMENT_ID}`
        );
      }

      let user = (ctx.state && ctx.state.user) || null;
      if (!user) user = await getUserFromAuthHeader(ctx);

      let allowedSubscriptionIds = [freeSubId];

      if (user && user.id) {
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

        const activeUntil =
          fullUser && fullUser.packageActiveUntil
            ? new Date(fullUser.packageActiveUntil).getTime()
            : null;

        const isActive = activeUntil ? activeUntil > Date.now() : false;

        if (
          isActive &&
          fullUser &&
          fullUser.package &&
          Array.isArray(fullUser.package.subscriptions) &&
          fullUser.package.subscriptions.length
        ) {
          const packageSubIds = fullUser.package.subscriptions.map((s) => s.id);
          allowedSubscriptionIds = Array.from(
            new Set([freeSubId].concat(packageSubIds))
          );
        }
      }

      const query = ctx.query || {};
      const topics = query.topics;
      const q = query.q;
      const page = query.page || "1";
      const pageSize = query.pageSize || "10";

      const topicIds = topics
        ? String(topics)
            .split(",")
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n) && n > 0)
        : [];

      const accessFilter = {
        publishedAt: { $notNull: true },
        subscriptions: { id: { $in: allowedSubscriptionIds } },
      };

      const incomingFilters = query.filters || null;

      const filters = incomingFilters
        ? { $and: [incomingFilters, accessFilter] }
        : accessFilter;

      const andParts = [];

      if (topicIds.length) andParts.push({ topic: { id: { $in: topicIds } } });

      if (q && String(q).trim()) {
        const qq = String(q).trim();
        andParts.push({
          $or: [
            { title: { $containsi: qq } },
            { description: { $containsi: qq } },
          ],
        });
      }

      const finalFilters =
        andParts.length > 0 ? { $and: [filters].concat(andParts) } : filters;

      const result = await strapi.entityService.findPage(
        "api::free-webinar.free-webinar",
        {
          sort: ["pinned:desc", "publishedAt:desc"],
          locale: "all",
          fields: [
            "id",
            "documentId",
            "publishedAt",
            "title",
            "slug",
            "webinar_type",
            "date_1",
            "date_2",
            "date_3",
            "time",
            "stream_url",
            "pinned",
            "description",
          ],
          populate: {
            topic: { fields: ["title", "id"] },
            card_cover: { fields: ["url", "alternativeText"] },
            speaker: { populate: "*" },
            subscriptions: { fields: ["id", "title", "documentId"] },
          },
          filters: finalFilters,
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
