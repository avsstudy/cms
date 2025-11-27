"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::session-question.session-question",
  ({ strapi }) => ({
    async create(ctx) {
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized("You must be authenticated to ask a question");
      }

      const { question, sessionId } = ctx.request.body;

      if (!question || !sessionId) {
        return ctx.badRequest("question and sessionId are required");
      }

      const session = await strapi.entityService.findOne(
        "api::study-session.study-session",
        sessionId
      );

      if (!session) {
        return ctx.notFound("Study session not found");
      }

      const created = await strapi.entityService.create(
        "api::session-question.session-question",
        {
          data: {
            question,
            users_permissions_user: user.id,
            study_session: sessionId,
          },
        }
      );

      const sanitized = await this.sanitizeOutput(created, ctx);
      return this.transformResponse(sanitized);
    },
  })
);
