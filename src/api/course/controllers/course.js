"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::course.course", ({ strapi }) => ({
  async getCoursesForCurrentUser(ctx) {
    const userId = ctx.state.user?.id;

    if (!userId) {
      return ctx.unauthorized("User not authenticated");
    }

    const rawPagination = ctx.query.pagination || {};
    const page = Number(rawPagination.page) || 1;
    const pageSize = Number(rawPagination.pageSize) || 20;

    const coursesResult = await strapi.entityService.findMany(
      "api::course.course",
      {
        filters: {},
        populate: {
          subscription_type: {
            fields: ["title", "documentId"],
          },
        },
        fields: ["title", "slug", "documentId", "course_type", "category"],
        pagination: { page, pageSize },
      }
    );

    const courses = coursesResult;
    const courseIds = courses.map((c) => c.id);

    let accesses = [];

    if (courseIds.length > 0) {
      accesses = await strapi.entityService.findMany(
        "api::course-access.course-access",
        {
          filters: {
            user: userId,
            course: {
              id: { $in: courseIds },
            },
          },
          fields: ["id", "has_accepted_rules", "publishedAt"],
          populate: {
            course: {
              fields: ["id", "documentId", "slug"],
            },
          },
        }
      );
    }

    const accessByCourseId = new Map();
    for (const acc of accesses) {
      const cid = acc.course?.id || acc.course;
      if (cid) accessByCourseId.set(cid, acc);
    }

    ctx.body = {
      data: courses.map((course) => ({
        course,
        access: accessByCourseId.get(course.id) || null,
      })),
      meta: {
        pagination: {
          page,
          pageSize,
        },
      },
    };
  },

  async getCourseForCurrentUser(ctx) {
    const userId = ctx.state.user?.id;
    const { slug } = ctx.params;

    if (!userId) {
      return ctx.unauthorized("User not authenticated");
    }

    if (!slug) {
      return ctx.badRequest("slug is required");
    }

    const [course] = await strapi.entityService.findMany("api::course.course", {
      filters: { slug },
      populate: {
        study_session: {
          fields: ["id", "title", "slug", "session_number", "documentId"],
          sort: ["session_number:asc"],
        },
      },
    });

    if (!course) {
      return ctx.notFound("Course not found");
    }

    const [courseAccess] = await strapi.entityService.findMany(
      "api::course-access.course-access",
      {
        filters: {
          user: userId,
          course: course.id,
        },
        fields: ["id", "has_accepted_rules", "publishedAt"],
      }
    );

    const sessionIds = (course.study_session || []).map((s) => s.id);

    let sessionProgresses = [];

    if (sessionIds.length > 0) {
      sessionProgresses = await strapi.entityService.findMany(
        "api::session-progress.session-progress",
        {
          filters: {
            user: userId,
            session: {
              id: { $in: sessionIds },
            },
          },
          fields: ["id", "status", "publishedAt"],
          populate: {
            session: {
              fields: ["id", "documentId", "title", "slug", "session_number"],
            },
          },
        }
      );
    }

    ctx.body = {
      course,
      courseAccess: courseAccess || null,
      sessionProgresses,
    };
  },
}));
