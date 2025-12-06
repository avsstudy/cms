"use strict";

const { createCoreController } = require("@strapi/strapi").factories;
const { MeiliSearch } = require("meilisearch");

const getMeiliClient = (strapi) => {
  const pluginConfig = strapi.config.get("plugin.meilisearch") || {};
  const fromPlugin = pluginConfig.config || {};

  const host = fromPlugin.host || process.env.MEILISEARCH_HOST;
  const apiKey = fromPlugin.apiKey || process.env.MEILISEARCH_ADMIN_API_KEY;

  if (!host) {
    strapi.log.error(
      "[meilisearch] host не налаштований (plugin.meilisearch.config.host або MEILISEARCH_HOST)"
    );
  }
  if (!apiKey) {
    strapi.log.error(
      "[meilisearch] apiKey не налаштований (plugin.meilisearch.config.apiKey або MEILISEARCH_ADMIN_API_KEY)"
    );
  }

  return new MeiliSearch({ host, apiKey });
};

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
          fields: [
            "id",
            "title",
            "slug",
            "session_number",
            "documentId",
            "session_admin_status",
            "session_date",
            "session_stream",
            "session_question_deadline",
          ],
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
          fields: ["id", "session_status"],
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

    const [course] = await strapi.entityService.findMany("api::course.course", {
      filters: { slug },
      fields: ["id", "title", "slug", "documentId", "course_type", "category"],
      populate: {
        study_session: {
          fields: ["id", "documentId", "title", "slug", "session_number"],
          sort: ["session_number:asc"],
          populate: {
            session_content: {
              populate: {
                materials: true,
                video_content: true,
              },
            },
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
                homework_materials: true,
              },
            },
          },
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

    const currentSession = sessions.find((s) => s.slug === sessionSlug);

    if (!currentSession) {
      return ctx.notFound("Session not found for this course");
    }

    const idx = sessions.findIndex((s) => s.id === currentSession.id);
    const prevSession = idx > 0 ? sessions[idx - 1] : null;
    const nextSession = idx < sessions.length - 1 ? sessions[idx + 1] : null;

    const [existingProgress] = await strapi.entityService.findMany(
      "api::session-progress.session-progress",
      {
        filters: {
          user: userId,
          study_session: currentSession.id,
        },
        fields: ["id", "session_status"],
      }
    );

    let progress = existingProgress;

    if (!progress) {
      progress = await strapi.entityService.create(
        "api::session-progress.session-progress",
        {
          data: {
            user: userId,
            study_session: currentSession.id,
            session_status: "in_progress",
          },
        }
      );
    }

    const homeworkIds = (currentSession.homework_content || []).map(
      (h) => h.id
    );
    let homeworkProgresses = [];

    if (homeworkIds.length > 0) {
      homeworkProgresses = await strapi.entityService.findMany(
        "api::homework-progress.homework-progress",
        {
          filters: {
            user: userId,
            homework: {
              id: { $in: homeworkIds },
            },
          },
          fields: ["id", "homework_status"],
          populate: {
            homework: {
              fields: ["id", "documentId", "title"],
            },
          },
        }
      );
    }

    ctx.body = {
      course,
      courseAccess,
      session: currentSession,
      progress,
      sessions,
      homeworkProgresses,
      prevSession,
      nextSession,
    };
  },
  async search(ctx) {
    const { q = "", topics, page = 1, pageSize = 10 } = ctx.request.query;

    const pageNum = Number(page) || 1;
    const limit = Number(pageSize) || 10;
    const offset = (pageNum - 1) * limit;

    const meiliClient = getMeiliClient(strapi);
    const index = meiliClient.index("course");

    const filters = [];

    if (topics) {
      const ids = String(topics)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (ids.length) {
        filters.push(`topicIds IN [${ids.join(", ")}]`);
      }
    }

    // якщо хочеш, можна ще фільтрувати course_type:
    // filters.push(`course_type != "course_online"`);

    const searchOptions = {
      limit,
      offset,
      sort: ["publishedAt:desc"],
    };

    if (filters.length) {
      searchOptions.filter = filters.join(" AND ");
    }

    const result = await index.search(q, searchOptions);
    const hits = result.hits || [];

    const total = result.estimatedTotalHits ?? result.nbHits ?? hits.length;
    const pageCount = total > 0 ? Math.ceil(total / limit) : 0;

    const normalized = hits.map((hit) => ({
      id: hit.id,
      title: hit.title,
      description: hit.description,
      slug: hit.slug,
      publishedAt: hit.publishedAt,
      course_type: hit.course_type,
      documentId: hit.documentId,
      card_cover: hit.card_cover ?? null,
      topic: hit.topic ?? [],
      speaker: hit.speaker ?? [],
    }));

    ctx.body = {
      data: normalized,
      meta: {
        pagination: {
          page: pageNum,
          pageSize: limit,
          total,
          pageCount,
        },
      },
    };
  },
}));
