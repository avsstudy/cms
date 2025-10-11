"use strict";
const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::user-question.user-question",
  ({ strapi }) => ({
    async create(ctx) {
      strapi.log.info("[user-question] >>> custom create HIT");

      const authUser = ctx.state.user;
      if (!authUser) return ctx.unauthorized("Authentication required");

      const d = (ctx.request.body && ctx.request.body.data) || {};
      const user_question = d.user_question;

      const rawDoc = d.topicDocumentId;
      const docIds = Array.isArray(rawDoc)
        ? rawDoc.map(String).filter(Boolean)
        : rawDoc != null
          ? [String(rawDoc)]
          : [];

      const rawIds = d.user_topic;
      let topicIds = Array.isArray(rawIds)
        ? rawIds.map((n) => Number(n)).filter(Boolean)
        : rawIds != null
          ? [Number(rawIds)].filter(Boolean)
          : [];

      if (!user_question || typeof user_question !== "string") {
        return ctx.badRequest("user_question is required");
      }

      if (docIds.length) {
        const rows = await strapi.entityService.findMany("api::topic.topic", {
          filters: { documentId: { $in: docIds } },
          fields: ["id", "documentId"],
          locale: "all",
          // publicationState: 'live',
          limit: docIds.length * 10,
        });
        const byDoc = new Map(
          (rows || []).map((t) => [String(t.documentId), Number(t.id)])
        );
        topicIds.push(...docIds.map((doc) => byDoc.get(doc)).filter(Boolean));
      }

      topicIds = Array.from(new Set(topicIds)).filter(Boolean);

      if (!topicIds.length) {
        return ctx.badRequest("Provide topicDocumentId or valid user_topic");
      }

      try {
        const created = await strapi.entityService.create(
          "api::user-question.user-question",
          {
            data: {
              user_question,
              user: { connect: authUser.id },
              user_topic: { connect: topicIds },
            },
            populate: ["user", "user_topic"],
          }
        );

        ctx.status = 201;
        return { data: created };
      } catch (err) {
        strapi.log.error("[user-question] create failed:", err);
        return ctx.badRequest(err?.message || "Validation error");
      }
    },
  })
);
