"use strict";
const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::user-question.user-question",
  ({ strapi }) => ({
    // === ВЖЕ БУВШИЙ create (без змін) ===
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

    // === НОВЕ: список моїх питань ===
    async my(ctx) {
      const user = ctx.state.user;
      if (!user?.email) return ctx.unauthorized("No email in token");

      const page = Math.max(1, Number(ctx.query.page ?? 1));
      const pageSize = Math.min(
        100,
        Math.max(1, Number(ctx.query.pageSize ?? 20))
      );
      const start = (page - 1) * pageSize;
      const status = ctx.query.status;

      const filters = {
        user: { email: { $eq: user.email } },
        ...(status ? { status_question: { $eq: status } } : {}),
      };

      const [data, total] = await Promise.all([
        strapi.entityService.findMany("api::user-question.user-question", {
          filters,
          sort: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          fields: [
            "id",
            "documentId",
            "user_question",
            "status_question",
            "reviewed_by_user",
            "reviewed_by_expert",
            "createdAt",
            "updatedAt",
            "publishedAt",
          ],
          populate: {
            user_topic: { fields: ["id", "title"] },
            expert_answer: {
              fields: [
                "id",
                "documentId",
                "slug",
                "question_title",
                "publishedAt",
              ],
              populate: { author: { fields: ["name"] } },
            },
          },
          start,
          limit: pageSize,
        }),
        strapi
          .query("api::user-question.user-question")
          .count({ where: filters }),
      ]);

      const pageCount = Math.max(1, Math.ceil(total / pageSize));

      ctx.body = {
        data,
        meta: { pagination: { page, pageSize, pageCount, total } },
      };
    },

    // === НОВЕ: конкретне питання за documentId (тільки своє) ===
    async myByDocumentId(ctx) {
      const user = ctx.state.user;
      if (!user?.email) return ctx.unauthorized("No email in token");

      const { documentId } = ctx.params;

      const rows = await strapi.entityService.findMany(
        "api::user-question.user-question",
        {
          filters: {
            documentId: { $eq: documentId },
            user: { email: { $eq: user.email } },
          },
          fields: [
            "id",
            "documentId",
            "user_question",
            "status_question",
            "reviewed_by_user",
            "reviewed_by_expert",
            "user_comment",
            "expert_comment",
            "createdAt",
            "updatedAt",
            "publishedAt",
          ],
          populate: {
            user_topic: { fields: ["id", "title"] },
            expert_answer: {
              fields: [
                "id",
                "documentId",
                "slug",
                "question_title",
                "publishedAt",
                "views",
              ],
              populate: {
                author: { fields: ["name"] },
                topic: { fields: ["id", "title"] },
                general_content: { populate: "*" },
              },
            },
          },
          limit: 1,
        }
      );

      if (!rows?.length) return ctx.notFound("Question not found");
      ctx.body = rows[0];
    },

    async updateUserComment(ctx) {
      const user = ctx.state.user;
      if (!user?.email) return ctx.unauthorized("No email in token");

      const { documentId } = ctx.params;
      const body = ctx.request.body || {};
      // допускаємо як {"data": { user_comment }} так і { user_comment }
      const user_comment = body?.data?.user_comment ?? body?.user_comment ?? "";

      if (typeof user_comment !== "string")
        return ctx.badRequest("user_comment must be a string");
      if (user_comment.length > 800)
        return ctx.badRequest("user_comment must be <= 800 chars");

      // знайти саме моє питання
      const rows = await strapi.entityService.findMany(
        "api::user-question.user-question",
        {
          filters: {
            documentId: { $eq: documentId },
            user: { email: { $eq: user.email } },
          },
          fields: ["id"],
          limit: 1,
        }
      );
      if (!rows?.length) return ctx.notFound("Question not found");
      const qid = rows[0].id;

      // оновити коментар (і за бажанням позначити reviewed_by_user = true)
      const updated = await strapi.entityService.update(
        "api::user-question.user-question",
        qid,
        {
          data: {
            user_comment,
            reviewed_by_user: true,
            reviewed_by_expert: false,
          },
          populate: {
            user_topic: { fields: ["id", "title"] },
          },
        }
      );

      // віддай у звичному REST-форматі
      const sanitized = await this.sanitizeOutput(updated, ctx);
      return this.transformResponse(sanitized);
    },
  })
);
