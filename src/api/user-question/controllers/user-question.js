"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::user-question.user-question",
  ({ strapi }) => ({
    async create(ctx) {
      const authUser = ctx.state.user; // user з JWT (users-permissions)
      if (!authUser) {
        return ctx.unauthorized("Authentication required");
      }

      // гарантуємо наявність data
      ctx.request.body = ctx.request.body || {};
      ctx.request.body.data = ctx.request.body.data || {};
      const data = ctx.request.body.data;

      // автор проставляється на бекенді
      data.user = authUser.id;

      // (опційно) простенька валідація
      if (!data.user_question || typeof data.user_question !== "string") {
        return ctx.badRequest("user_question is required");
      }
      if (!Array.isArray(data.user_topic)) {
        data.user_topic = [];
      }

      // викликаємо базову реалізацію
      const response = await super.create(ctx);
      return response;
    },
  })
);
