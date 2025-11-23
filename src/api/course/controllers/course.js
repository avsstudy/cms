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
    const pageSize = Number(rawPagination.pageSize) || 10;

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
          fields: ["id", "course_status", "has_accepted_rules"],
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
      fields: [
        "id",
        "title",
        "description",
        "publishedAt",
        "documentId",
        "slug",
        "course_type",
        "category",
      ],
      populate: {
        card_cover: { fields: ["url", "alternativeText"] },
        speaker: {
          fields: ["id", "first_name", "last_name", "job_title", "description"],
          populate: {
            banner_photo: { fields: ["url", "alternativeText"] },
            photo: { fields: ["url", "alternativeText"] },
          },
        },
        subscription_type: {
          fields: ["title", "documentId"],
        },
        topic: { fields: ["title", "documentId"] },
        general_content: { populate: "*" },
        reviews: { populate: "*" },
        study_session: {
          fields: ["id", "title", "slug", "session_number", "documentId"],
          sort: ["session_number:asc"],
        },
      },
    });

    if (!course) {
      return ctx.notFound("Course not found");
    }

    const [courseAccessRaw] = await strapi.entityService.findMany(
      "api::course-access.course-access",
      {
        filters: {
          user: userId,
          course: course.id,
        },
        fields: ["id", "has_accepted_rules", "course_status", "documentId"],
      }
    );

    let courseAccess = courseAccessRaw || null;

    if (courseAccess) {
      if (courseAccess.course_status === "open") {
        courseAccess = await strapi.entityService.update(
          "api::course-access.course-access",
          courseAccess.id,
          {
            data: {
              course_status: "progress",
            },
          }
        );
      }
    }

    const sessionIds = (course.study_session || []).map((s) => s.id);

    let sessionProgresses = [];

    if (sessionIds.length > 0) {
      sessionProgresses = await strapi.entityService.findMany(
        "api::session-progress.session-progress",
        {
          filters: {
            user: userId,
            study_session: {
              id: { $in: sessionIds },
            },
          },
          fields: ["id", "session_status", "publishedAt"],
          populate: {
            study_session: {
              fields: ["id", "documentId", "title", "slug", "session_number"],
            },
          },
        }
      );
    }

    ctx.body = {
      course,
      courseAccess,
      sessionProgresses,
    };
  },

  async getSessionForCurrentUser(ctx) {
    const userId = ctx.state.user?.id;
    const { slug, sessionSlug } = ctx.params;

    if (!userId) {
      return ctx.unauthorized("User not authenticated");
    }

    if (!slug || !sessionSlug) {
      return ctx.badRequest("slug and sessionSlug are required");
    }

    // 1) Знаходимо курс по slug
    const [course] = await strapi.entityService.findMany("api::course.course", {
      filters: { slug },
      fields: ["id", "title", "slug", "documentId", "course_type", "category"],
      populate: {
        study_session: {
          fields: ["id", "documentId", "title", "slug", "session_number"],
          sort: ["session_number:asc"],
        },
      },
    });

    if (!course) {
      return ctx.notFound("Course not found");
    }

    // 2) Перевіряємо доступ юзера до курсу
    const [courseAccess] = await strapi.entityService.findMany(
      "api::course-access.course-access",
      {
        filters: {
          user: userId,
          course: course.id,
        },
        fields: ["id", "has_accepted_rules", "course_status"],
      }
    );

    if (!courseAccess) {
      return ctx.forbidden("No access to this course for current user");
    }

    if (!courseAccess.has_accepted_rules) {
      return ctx.forbidden("Course rules are not accepted");
    }

    const sessions = (course.study_session || [])
      .slice()
      .sort((a, b) => a.session_number - b.session_number);

    if (!sessions.length) {
      return ctx.notFound("No sessions for this course");
    }

    // 3) Знаходимо поточну сесію по sessionSlug
    const currentSession = sessions.find((s) => s.slug === sessionSlug);

    if (!currentSession) {
      return ctx.notFound("Session not found for this course");
    }

    // 4) Prev / Next
    const idx = sessions.findIndex((s) => s.id === currentSession.id);
    const prevSession = idx > 0 ? sessions[idx - 1] : null;
    const nextSession = idx < sessions.length - 1 ? sessions[idx + 1] : null;

    // 5) Session-progress: шукаємо
    const [existingProgress] = await strapi.entityService.findMany(
      "api::session-progress.session-progress",
      {
        filters: {
          user: userId,
          study_session: currentSession.id,
        },
        fields: ["id", "session_status", "publishedAt"],
      }
    );

    let progress = existingProgress;

    // 6) Якщо немає прогресу – створюємо in_progress
    if (!progress) {
      progress = await strapi.entityService.create(
        "api::session-progress.session-progress",
        {
          data: {
            user: userId,
            study_session: currentSession.id,
            session_status: "in_progress",
            publishedAt: new Date().toISOString(),
          },
        }
      );
    } else if (
      progress.session_status !== "completed" &&
      !progress.publishedAt
    ) {
      // Якщо є, але ще не опублікований – ставимо publishedAt
      progress = await strapi.entityService.update(
        "api::session-progress.session-progress",
        progress.id,
        {
          data: {
            publishedAt: new Date().toISOString(),
          },
        }
      );
    }

    ctx.body = {
      course,
      courseAccess,
      session: currentSession,
      progress,
      sessions, // весь список для побудови "наступна/попередня"
    };
  },
}));
