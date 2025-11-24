"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::homework-progress.homework-progress",
  ({ strapi }) => ({
    async getHomeworkForCurrentUser(ctx) {
      const userId = ctx.state.user?.id;
      const { slug, sessionSlug, homeworkId } = ctx.params;

      if (!userId) {
        return ctx.unauthorized("User not authenticated");
      }

      if (!slug || !sessionSlug || !homeworkId) {
        return ctx.badRequest("slug, sessionSlug and homeworkId are required");
      }

      const [course] = await strapi.entityService.findMany(
        "api::course.course",
        {
          filters: { slug },
          fields: ["id", "title", "slug", "documentId"],
          populate: {
            study_session: {
              fields: ["id", "title", "slug", "session_number"],
              populate: {
                homework_content: {
                  fields: [
                    "id",
                    "documentId",
                    "title",
                    "homework_description",
                    "homework_solution",
                    "homework_guide",
                  ],
                  populate: {
                    homework_materials: {
                      fields: ["id"],
                      populate: {
                        materials: {
                          fields: [
                            "id",
                            "url",
                            "name",
                            "mime",
                            "size",
                            "publishedAt",
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }
      );

      if (!course) return ctx.notFound("Course not found");

      const [courseAccess] = await strapi.entityService.findMany(
        "api::course-access.course-access",
        {
          filters: { user: userId, course: course.id },
          fields: ["id", "has_accepted_rules", "course_status"],
        }
      );

      if (!courseAccess) {
        return ctx.forbidden("No access to this course for current user");
      }
      if (!courseAccess.has_accepted_rules) {
        return ctx.forbidden("Course rules are not accepted");
      }

      const session = (course.study_session || []).find(
        (s) => s.slug === sessionSlug
      );
      if (!session) return ctx.notFound("Session not found for this course");

      const hwIdNum = Number(homeworkId);
      const homework = (session.homework_content || []).find(
        (hw) => hw.id === hwIdNum
      );

      if (!homework) {
        return ctx.notFound("Homework not found for this session");
      }

      const [existing] = await strapi.entityService.findMany(
        "api::homework-progress.homework-progress",
        {
          filters: {
            user: userId,
            homework: homework.id,
          },
          fields: ["id", "homework_status"],
        }
      );

      let progress = existing;

      if (!progress) {
        progress = await strapi.entityService.create(
          "api::homework-progress.homework-progress",
          {
            data: {
              user: userId,
              homework: homework.id,
              homework_status: "in_progress",
            },
          }
        );
      }

      ctx.body = {
        course,
        session,
        homework,
        progress,
      };
    },

    async completeHomework(ctx) {
      const userId = ctx.state.user?.id;
      const { homeworkId } = ctx.params;

      if (!userId) {
        return ctx.unauthorized("User not authenticated");
      }
      if (!homeworkId) {
        return ctx.badRequest("homeworkId is required");
      }

      const [existing] = await strapi.entityService.findMany(
        "api::homework-progress.homework-progress",
        {
          filters: {
            user: userId,
            homework: Number(homeworkId),
          },
          fields: ["id", "homework_status"],
        }
      );

      if (!existing) {
        return ctx.notFound("Homework progress not found");
      }

      const updated = await strapi.entityService.update(
        "api::homework-progress.homework-progress",
        existing.id,
        {
          data: {
            homework_status: "completed",
          },
        }
      );

      ctx.body = updated;
    },
  })
);
