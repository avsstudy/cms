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
const getUserFromAuthHeader = async (ctx) => {
  const authHeader = ctx.request.header.authorization || "";
  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) return null;

  try {
    const payload = await strapi
      .plugin("users-permissions")
      .service("jwt")
      .verify(token);

    if (!payload?.id) return null;

    const user = await strapi
      .plugin("users-permissions")
      .service("user")
      .fetchAuthenticatedUser(payload.id);

    return user || null;
  } catch (e) {
    return null;
  }
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

  async accessible(ctx) {
    let user = ctx.state.user || null;
    if (!user) user = await getUserFromAuthHeader(ctx);

    let activePackageId = null;

    if (user?.id) {
      const fullUser = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        user.id,
        {
          fields: ["id", "packageActiveUntil"],
          populate: {
            package: { fields: ["id", "title"] },
          },
        }
      );

      const activeUntil = fullUser?.packageActiveUntil
        ? new Date(fullUser.packageActiveUntil).getTime()
        : null;

      const isActive = activeUntil ? activeUntil > Date.now() : false;
      const packageId = fullUser?.package?.id ?? null;

      if (isActive && packageId) activePackageId = packageId;
    }

    let allowedCourseDocumentIds = [];

    if (activePackageId) {
      const pkgs = await strapi.entityService.findMany("api::package.package", {
        filters: { id: activePackageId },
        fields: ["id", "title"],
        populate: {
          course: { fields: ["id", "documentId"] },

          subscriptions: {
            fields: ["id"],
            populate: {
              courses: { fields: ["id", "documentId"] },
            },
          },
        },
        limit: 1,
      });

      const pkg = pkgs?.[0] || null;

      const pkgCourses = Array.isArray(pkg?.course) ? pkg.course : [];
      const subs = Array.isArray(pkg?.subscriptions) ? pkg.subscriptions : [];

      const subCourses = subs.flatMap((s) =>
        Array.isArray(s?.courses) ? s.courses : []
      );

      allowedCourseDocumentIds.push(
        ...pkgCourses.map((c) => c?.documentId).filter(Boolean),
        ...subCourses.map((c) => c?.documentId).filter(Boolean)
      );
    }

    if (user?.id) {
      const accesses = await strapi.entityService.findMany(
        "api::course-access.course-access",
        {
          filters: { user: { id: { $eq: user.id } } },
          fields: ["id", "course_status", "has_accepted_rules"],
          populate: {
            course: { fields: ["id", "documentId"] },
          },
          limit: 1000,
        }
      );

      allowedCourseDocumentIds.push(
        ...(accesses || []).map((a) => a?.course?.documentId).filter(Boolean)
      );
    }

    allowedCourseDocumentIds = Array.from(
      new Set(allowedCourseDocumentIds.map(String))
    );
    const allowedSet = new Set(allowedCourseDocumentIds);

    const {
      topics,
      q,
      page = "1",
      pageSize = "10",
      courseTypes,
      slug,
    } = ctx.query;

    const topicIds = topics
      ? String(topics).split(",").map(Number).filter(Boolean)
      : [];

    const types = courseTypes
      ? String(courseTypes)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const filters = {
      publishedAt: { $notNull: true },
    };

    if (slug && String(slug).trim()) {
      filters.slug = { $eq: String(slug).trim() };
    }

    if (types.length) filters.course_type = { $in: types };
    if (topicIds.length) filters.topic = { id: { $in: topicIds } };

    if (q && String(q).trim()) {
      const qq = String(q).trim();
      filters.$or = [
        { title: { $containsi: qq } },
        { description: { $containsi: qq } },
      ];
    }

    const result = await strapi.entityService.findPage("api::course.course", {
      sort: ["publishedAt:desc"],
      locale: "all",
      publicationState: "live",

      fields: [
        "id",
        "publishedAt",
        "documentId",
        "title",
        "description",
        "slug",
        "course_type",
        "category",
      ],
      populate: {
        card_cover: { fields: ["url", "alternativeText"] },
        speaker: { populate: "*" },
        topic: { populate: "*" },
        general_content: { populate: "*" },
      },
      filters,

      page: Number(page) || 1,
      pageSize: Number(pageSize) || 10,
    });

    const withAccess = (result.results || []).map((item) => {
      const docId = item?.documentId ? String(item.documentId) : "";
      const canWatch = docId ? allowedSet.has(docId) : false;

      return {
        ...item,
        access: { canWatch },
      };
    });

    ctx.body = {
      data: withAccess,
      meta: { pagination: result.pagination },
      access: { allowedCourseDocumentIds },
    };
  },
}));
