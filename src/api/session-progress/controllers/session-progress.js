"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::session-progress.session-progress",
  ({ strapi }) => ({
    async startSession(ctx) {
      const userId = ctx.state.user?.id;
      const { sessionDocumentId } = ctx.request.body;

      if (!userId) {
        return ctx.unauthorized("User not authenticated");
      }

      if (!sessionDocumentId) {
        return ctx.badRequest("sessionDocumentId is required");
      }

      const [session] = await strapi.entityService.findMany(
        "api::study-session.study-session",
        {
          filters: { documentId: sessionDocumentId },
          fields: ["id", "title", "documentId"],
        }
      );

      if (!session) {
        return ctx.notFound("Session not found by documentId");
      }

      const [existing] = await strapi.entityService.findMany(
        "api::session-progress.session-progress",
        {
          filters: {
            user: userId,
            session: session.id,
          },
        }
      );

      if (existing) {
        const updated = await strapi.entityService.update(
          "api::session-progress.session-progress",
          existing.id,
          {
            data: {
              status: "in_progress",
              publishedAt: existing.publishedAt || new Date().toISOString(),
            },
          }
        );

        ctx.body = updated;
        return;
      }

      const created = await strapi.entityService.create(
        "api::session-progress.session-progress",
        {
          data: {
            user: userId,
            session: session.id,
            status: "in_progress",
            publishedAt: new Date().toISOString(),
          },
        }
      );

      ctx.body = created;
    },

    async completeSession(ctx) {
      const userId = ctx.state.user?.id;
      const { sessionDocumentId } = ctx.request.body;

      if (!userId) {
        return ctx.unauthorized("User not authenticated");
      }

      if (!sessionDocumentId) {
        return ctx.badRequest("sessionDocumentId is required");
      }

      const [session] = await strapi.entityService.findMany(
        "api::study-session.study-session",
        {
          filters: { documentId: sessionDocumentId },
          fields: ["id", "title", "documentId"],
        }
      );

      if (!session) {
        return ctx.notFound("Session not found by documentId");
      }

      const [existing] = await strapi.entityService.findMany(
        "api::session-progress.session-progress",
        {
          filters: {
            user: userId,
            session: session.id,
          },
        }
      );

      if (existing) {
        const updated = await strapi.entityService.update(
          "api::session-progress.session-progress",
          existing.id,
          {
            data: {
              status: "completed",
              publishedAt: existing.publishedAt || new Date().toISOString(),
            },
          }
        );

        ctx.body = updated;
        return;
      }

      const created = await strapi.entityService.create(
        "api::session-progress.session-progress",
        {
          data: {
            user: userId,
            session: session.id,
            status: "completed",
            publishedAt: new Date().toISOString(),
          },
        }
      );

      ctx.body = created;
    },
  })
);
