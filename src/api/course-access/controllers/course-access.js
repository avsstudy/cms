"use strict";

/**
 * course-access controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::course-access.course-access",
  ({ strapi }) => ({
    async grantForCourse(ctx) {
      const userId = ctx.state.user?.id;
      const { courseId } = ctx.request.body;

      if (!userId) {
        return ctx.unauthorized("User not authenticated");
      }

      if (!courseId) {
        return ctx.badRequest("courseId is required");
      }

      const course = await strapi.entityService.findOne(
        "api::course.course",
        courseId,
        {
          fields: ["id", "title"],
          populate: {
            subscription_type: true,
          },
        }
      );

      if (!course) {
        return ctx.notFound("Course not found");
      }

      const existing = await strapi.entityService.findMany(
        "api::course-access.course-access",
        {
          filters: {
            user: userId,
            course: courseId,
          },
        }
      );

      if (existing.length > 0) {
        ctx.body = existing[0];
        return;
      }

      const created = await strapi.entityService.create(
        "api::course-access.course-access",
        {
          data: {
            user: userId,
            course: courseId,
            has_accepted_rules: false,
          },
        }
      );

      ctx.body = created;
    },

    async grantForSubscription(ctx) {
      const authUserId = ctx.state.user?.id;
      const { userId: bodyUserId, subscriptionTypeId } = ctx.request.body;

      const userId = bodyUserId || authUserId;

      if (!userId) {
        return ctx.unauthorized("User not authenticated");
      }

      if (!subscriptionTypeId) {
        return ctx.badRequest("subscriptionTypeId is required");
      }

      const courses = await strapi.entityService.findMany(
        "api::course.course",
        {
          filters: {
            subscription_type: {
              id: subscriptionTypeId,
            },
          },
          fields: ["id", "title"],
        }
      );

      if (!courses || courses.length === 0) {
        ctx.body = {
          created: [],
          count: 0,
          message: "No courses found for this subscription type",
        };
        return;
      }

      const createdAccesses = [];

      for (const course of courses) {
        const existing = await strapi.entityService.findMany(
          "api::course-access.course-access",
          {
            filters: {
              user: userId,
              course: course.id,
            },
          }
        );

        if (existing.length === 0) {
          const created = await strapi.entityService.create(
            "api::course-access.course-access",
            {
              data: {
                user: userId,
                course: course.id,
                has_accepted_rules: false,
              },
            }
          );

          createdAccesses.push(created);
        }
      }

      ctx.body = {
        created: createdAccesses,
        count: createdAccesses.length,
      };
    },

    async acceptRules(ctx) {
      const userId = ctx.state.user?.id;
      const { courseId } = ctx.request.body;

      if (!userId) {
        return ctx.unauthorized("User not authenticated");
      }

      if (!courseId) {
        return ctx.badRequest("courseId is required");
      }

      const [access] = await strapi.entityService.findMany(
        "api::course-access.course-access",
        {
          filters: {
            user: userId,
            course: courseId,
          },
        }
      );

      if (!access) {
        return ctx.forbidden("No course access found for this user");
      }

      const updated = await strapi.entityService.update(
        "api::course-access.course-access",
        access.id,
        {
          data: {
            has_accepted_rules: true,
          },
        }
      );

      ctx.body = updated;
    },
  })
);
