"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::session-progress.session-progress",
  ({ strapi }) => ({
    /**
     * Почати сесію (або відмітити, що вона в процесі)
     * POST /session-progress/start
     * body: { sessionDocumentId: string }
     */
    async startSession(ctx) {
      const userId = ctx.state.user?.id;
      const { sessionDocumentId } = ctx.request.body;

      if (!userId) {
        return ctx.unauthorized("User not authenticated");
      }

      if (!sessionDocumentId) {
        return ctx.badRequest("sessionDocumentId is required");
      }

      // 1. Знаходимо session по її documentId
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

      // 2. Шукаємо існуючий прогрес
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
        // якщо вже є – просто оновлюємо статус на in_progress (на всяк випадок)
        const updated = await strapi.entityService.update(
          "api::session-progress.session-progress",
          existing.id,
          {
            data: {
              status: "in_progress",
            },
          }
        );

        ctx.body = updated;
        return;
      }

      // 3. Створюємо новий прогрес
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

    /**
     * Завершити сесію
     * POST /session-progress/complete
     * body: { sessionDocumentId: string }
     */
    async completeSession(ctx) {
      const userId = ctx.state.user?.id;
      const { sessionDocumentId } = ctx.request.body;

      if (!userId) {
        return ctx.unauthorized("User not authenticated");
      }

      if (!sessionDocumentId) {
        return ctx.badRequest("sessionDocumentId is required");
      }

      // 1. Знаходимо session по documentId
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

      // 2. Шукаємо існуючий прогрес
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
            },
          }
        );

        ctx.body = updated;
        return;
      }

      // Якщо прогресу ще не було – створюємо одразу як completed
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
