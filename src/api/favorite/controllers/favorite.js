"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

const UID = "api::favorite.favorite";

const ALLOWED_TYPES = new Set(["article", "news-article", "video-recording"]);

function normalizeId(v) {
  return String(v ?? "").trim();
}

async function getIds(strapi, userId, type) {
  const rows = await strapi.entityService.findMany(UID, {
    filters: { user: userId, type },
    fields: ["itemDocumentId"],
    pagination: { page: 1, pageSize: 1000 },
    sort: ["createdAt:desc"],
  });

  return {
    ids: (rows ?? [])
      .map((r) => r?.itemDocumentId)
      .filter((x) => typeof x === "string" && x.length > 0),
  };
}

async function findExisting(strapi, userId, type, itemDocumentId) {
  const rows = await strapi.entityService.findMany(UID, {
    filters: { user: userId, type, itemDocumentId },
    fields: ["id"],
    pagination: { page: 1, pageSize: 1 },
  });
  return Array.isArray(rows) ? rows[0] : null;
}

module.exports = createCoreController(UID, ({ strapi }) => ({
  async articleIds(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized();

    ctx.body = await getIds(strapi, userId, "article");
  },

  async newsArticleIds(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized();

    ctx.body = await getIds(strapi, userId, "news-article");
  },

  async videoRecordingIds(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized();

    ctx.body = await getIds(strapi, userId, "video-recording");
  },

  // ===== unified toggle =====
  async toggle(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized();

    const { type, itemDocumentId } = ctx.request.body || {};
    const t = String(type ?? "").trim();
    const docId = normalizeId(itemDocumentId);

    if (!t || !docId) {
      return ctx.badRequest("type and itemDocumentId are required");
    }

    if (!ALLOWED_TYPES.has(t)) {
      return ctx.badRequest(
        "Unsupported type. Allowed: article, news-article, video-recording"
      );
    }

    const existing = await findExisting(strapi, userId, t, docId);

    if (existing?.id) {
      await strapi.entityService.delete(UID, existing.id);
      ctx.body = { ok: true, favorited: false };
      return;
    }

    await strapi.entityService.create(UID, {
      data: { user: userId, type: t, itemDocumentId: docId },
      fields: ["id"],
    });

    ctx.body = { ok: true, favorited: true };
  },
}));
