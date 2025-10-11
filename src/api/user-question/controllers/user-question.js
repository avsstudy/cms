"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::user-question.user-question",
  ({ strapi }) => ({
    async create(ctx) {
      const authUser = ctx.state.user;
      if (!authUser) return ctx.unauthorized("Authentication required");

      const d = (ctx.request.body && ctx.request.body.data) || {};
      const user_question = d.user_question;

      // приймаємо і число, і масив -> нормалізуємо в масив чисел
      const raw = d.user_topic;
      const topicIds = Array.isArray(raw)
        ? raw.map((x) => Number(x)).filter(Boolean)
        : raw != null
          ? [Number(raw)].filter(Boolean)
          : [];

      if (!user_question || typeof user_question !== "string") {
        return ctx.badRequest("user_question is required");
      }
      if (topicIds.length === 0) {
        return ctx.badRequest("user_topic is required");
      }

      // перевіримо, що топіки існують (і за потреби — опубліковані)
      const topicsFound = await strapi.entityService.findMany(
        "api::topic.topic",
        {
          filters: { id: { $in: topicIds } },
          fields: ["id"],
          limit: topicIds.length,
          // якщо хочеш вимагати саме live-записи:
          // publicationState: 'live',
        }
      );

      const found = new Set((topicsFound || []).map((t) => Number(t.id)));
      const missing = topicIds.filter((id) => !found.has(id));
      if (missing.length) {
        return ctx.badRequest(`Topic(s) not found: ${missing.join(", ")}`);
      }

      try {
        // v5: одразу ставимо і автора (M2O), і топіки (M2M) через connect
        const created = await strapi.entityService.create(
          "api::user-question.user-question",
          {
            data: {
              user_question,
              user: { connect: authUser.id }, // M2O
              user_topic: { connect: topicIds }, // M2M
            },
            populate: ["user", "user_topic"],
          }
        );

        ctx.status = 201;
        return { data: created };
      } catch (err) {
        strapi.log.error("Create user-question failed:", err);
        return ctx.badRequest(err?.message || "Validation error");
      }
    },
  })
);
