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

function pad2(n) {
  return String(n).padStart(2, "0");
}

function kyivTodayAndThreshold(now = new Date(), backHours = 2) {
  const tz = "Europe/Kyiv";

  const dateFmt = new Intl.DateTimeFormat("uk-UA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const timeFmt = new Intl.DateTimeFormat("uk-UA", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const dp = dateFmt.formatToParts(now);
  const tp = timeFmt.formatToParts(now);

  const y = Number(dp.find((p) => p.type === "year")?.value);
  const m = Number(dp.find((p) => p.type === "month")?.value);
  const d = Number(dp.find((p) => p.type === "day")?.value);

  const hh = Number(tp.find((p) => p.type === "hour")?.value);
  const mm = Number(tp.find((p) => p.type === "minute")?.value);
  const ss = Number(tp.find((p) => p.type === "second")?.value);

  const raw = hh - backHours;
  const thresholdTime =
    raw >= 0 ? `${pad2(raw)}:${pad2(mm)}:${pad2(ss)}` : "00:00:00";

  const today = `${y}-${pad2(m)}-${pad2(d)}`;

  return { today, thresholdTime };
}

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

      const { topics, q, page = "1", pageSize = "10" } = ctx.query;

      const topicIds = topics
        ? String(topics).split(",").map(Number).filter(Boolean)
        : [];

      const filters = {
        publishedAt: { $notNull: true },
        subscriptions: { id: { $in: allowedSubscriptionIds } },
      };

      if (topicIds.length) {
        filters.topic = { id: { $in: topicIds } };
      }

      if (q && String(q).trim()) {
        const qq = String(q).trim();
        filters.$or = [
          { title: { $containsi: qq } },
          { description: { $containsi: qq } },
        ];
      }

      const { today, thresholdTime } = kyivTodayAndThreshold(new Date(), 2);

      const futureFilter = {
        $or: [
          { date_1: { $gt: today } },
          { date_2: { $gt: today } },
          { date_3: { $gt: today } },
          {
            $and: [
              { date_1: { $eq: today } },
              { time: { $gte: thresholdTime } },
            ],
          },
          {
            $and: [
              { date_2: { $eq: today } },
              { time: { $gte: thresholdTime } },
            ],
          },
          {
            $and: [
              { date_3: { $eq: today } },
              { time: { $gte: thresholdTime } },
            ],
          },
        ],
      };

      const finalFilters = { $and: [filters, futureFilter] };

      const result = await strapi.entityService.findPage(
        "api::free-webinar.free-webinar",
        {
          sort: ["pinned:desc", "date_1:asc", "publishedAt:desc"],
          locale: "all",
          fields: [
            "title",
            "slug",
            "description",
            "publishedAt",
            "documentId",
            "webinar_type",
            "date_1",
            "date_2",
            "date_3",
            "time",
            "stream_url",
            "pinned",
          ],
          populate: {
            card_cover: { fields: ["url", "alternativeText"] },
            speaker: { populate: "*" },
            topic: { fields: ["id", "title"] },
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
