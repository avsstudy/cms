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
  "api::video-recording.video-recording",
  ({ strapi }) => ({
    async search(ctx) {
      const {
        q = "",
        topics,
        speakers,
        page = 1,
        pageSize = 10,
        videoTypes,
        excludeTypes,
      } = ctx.request.query;

      const pageNum = Number(page) || 1;
      const limit = Number(pageSize) || 10;
      const offset = (pageNum - 1) * limit;

      const meiliClient = getMeiliClient(strapi);
      const index = meiliClient.index("video-recording");

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

      if (videoTypes) {
        const types = String(videoTypes)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        if (types.length) {
          filters.push(
            `video_type IN [${types.map((t) => `"${t}"`).join(", ")}]`
          );
        }
      }

      if (excludeTypes) {
        const types = String(excludeTypes)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        if (types.length) {
          filters.push(
            `NOT video_type IN [${types.map((t) => `"${t}"`).join(", ")}]`
          );
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
        publishedAt: hit.publishedAt,
        video_type: hit.video_type,
        stream_date: hit.stream_date,
        top: hit.top ?? false,
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
              package: { fields: ["id", "title"] },
            },
          }
        );

        const activeUntil = fullUser?.packageActiveUntil
          ? new Date(fullUser.packageActiveUntil).getTime()
          : null;

        const isActive = activeUntil ? activeUntil > Date.now() : false;
        const packageId = fullUser?.package?.id ?? null;

        if (isActive && packageId) {
          const TIER_MIN = 2;
          const TIER_MAX = 5;

          if (packageId >= TIER_MIN) {
            const maxTier = Math.min(packageId, TIER_MAX);

            const packages = await strapi.entityService.findMany(
              "api::package.package",
              {
                filters: {
                  id: { $gte: TIER_MIN, $lte: maxTier },
                },
                fields: ["id"],
                populate: {
                  subscriptions: { fields: ["id"] },
                },
                limit: 100,
              }
            );

            const tierSubIds = (packages || [])
              .flatMap((p) => (p?.subscriptions || []).map((s) => s.id))
              .filter(Boolean);

            allowedSubscriptionIds = Array.from(
              new Set([freeSubId, ...tierSubIds])
            );
          } else {
            allowedSubscriptionIds = [freeSubId];
          }
        }
      }

      const {
        topics,
        speakers,
        q,
        page = "1",
        pageSize = "10",
        videoTypes,
        slug,
      } = ctx.query;

      const topicIds = topics
        ? String(topics).split(",").map(Number).filter(Boolean)
        : [];

      const speakerIds = speakers
        ? String(speakers).split(",").map(Number).filter(Boolean)
        : [];

      const types = videoTypes
        ? String(videoTypes)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const filters = {
        publishedAt: { $notNull: true },
      };

      if (slug && String(slug).trim()) {
        filters.slug = { $eq: String(slug).trim() };
      }

      if (types.length) filters.video_type = { $in: types };
      if (topicIds.length) filters.topic = { id: { $in: topicIds } };
      if (speakerIds.length) filters.speaker = { id: { $in: speakerIds } };

      if (q && String(q).trim()) {
        const qq = String(q).trim();
        filters.$or = [
          { title: { $containsi: qq } },
          { description: { $containsi: qq } },
        ];
      }

      const result = await strapi.entityService.findPage(
        "api::video-recording.video-recording",
        {
          sort: ["publishedAt:desc"],
          locale: "all",
          fields: [
            "id",
            "documentId",
            "slug",
            "title",
            "publishedAt",
            "video_type",
            "stream_date",
            "top",
          ],
          populate: {
            card_cover: { fields: ["url", "alternativeText"] },
            speaker: { populate: "*" },
            general_content: { populate: "*" },
            subscriptions: { fields: ["id", "title", "documentId"] },
          },
          filters,
          pagination: { page: Number(page), pageSize: Number(pageSize) },
        }
      );

      const allowedSet = new Set(allowedSubscriptionIds);

      const withAccess = (result.results || []).map((item) => {
        const subs = Array.isArray(item.subscriptions)
          ? item.subscriptions
          : [];
        const subIds = subs.map((s) => s.id).filter(Boolean);
        const canWatch = subIds.some((id) => allowedSet.has(id));

        return {
          ...item,
          access: {
            canWatch,
            requiredSubscriptionIds: subIds,
          },
        };
      });

      ctx.body = {
        data: withAccess,
        meta: { pagination: result.pagination },
        access: { allowedSubscriptionIds },
      };
    },
  })
);
