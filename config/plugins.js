module.exports = ({ env }) => ({
  upload: {
    config: {
      provider: "strapi-provider-upload-do",
      providerOptions: {
        key: env("DO_SPACE_ACCESS_KEY"),
        secret: env("DO_SPACE_SECRET_KEY"),
        endpoint: env("DO_SPACE_ENDPOINT"),
        space: env("DO_SPACE_BUCKET"),
        directory: env("DO_SPACE_DIRECTORY"),
        cdn: env("DO_SPACE_CDN"),
      },
    },
  },

  email: {
    config: {
      provider: "sendgrid",
      providerOptions: {
        apiKey: env("SENDGRID_API_KEY"),
      },
      settings: {
        defaultFrom: env("SENDGRID_FROM", "no-reply@yourdomain.com"),
        defaultReplyTo: env("SENDGRID_REPLY_TO", "support@yourdomain.com"),
      },
    },
  },

  meilisearch: {
    config: {
      host: env("MEILISEARCH_HOST"),
      apiKey: env("MEILISEARCH_ADMIN_API_KEY"),

      article: {
        indexName: "article",

        populate: {
          cover: { fields: ["id", "url", "alternativeText"] },
          category: { fields: ["id", "title"] },
          topic: { fields: ["id", "title"] },
          author: { fields: ["id", "name"] },
        },

        transformEntry({ entry }) {
          return {
            id: entry.id,
            title: entry.title,
            slug: entry.slug,
            description: entry.description,
            views: entry.views,
            article_date: entry.article_date,
            publishedAt: entry.publishedAt,
            documentId: entry.documentId,
            pinned: entry.pinned,

            cover: entry.cover
              ? {
                  id: entry.cover.id,
                  url: entry.cover.url,
                  alternativeText: entry.cover.alternativeText,
                }
              : null,

            category: Array.isArray(entry.category)
              ? entry.category.map((c) => ({
                  id: c.id,
                  title: c.title,
                }))
              : [],

            topic: Array.isArray(entry.topic)
              ? entry.topic.map((t) => ({
                  id: t.id,
                  title: t.title,
                }))
              : [],

            author: entry.author
              ? { id: entry.author.id, name: entry.author.name }
              : null,

            categoryIds: Array.isArray(entry.category)
              ? entry.category.map((c) => c.id)
              : [],
            topicIds: Array.isArray(entry.topic)
              ? entry.topic.map((t) => t.id)
              : [],

            content: [entry.title ?? "", entry.description ?? ""].join(" "),
          };
        },

        settings: {
          searchableAttributes: ["title", "description", "content"],
          filterableAttributes: ["categoryIds", "topicIds", "pinned"],
          sortableAttributes: ["article_date", "views"],
        },
      },

      "news-article": {
        indexName: "news-article",

        populate: {
          cover: { fields: ["id", "url", "alternativeText"] },
          category: { fields: ["id", "title"] },
          topic: { fields: ["id", "title"] },
        },

        transformEntry({ entry }) {
          return {
            id: entry.id,
            title: entry.title,
            slug: entry.slug,
            description: entry.description,
            views: entry.views,
            publishedAt: entry.publishedAt,
            documentId: entry.documentId,

            comments_enabled: entry.comments_enabled,
            pinned: entry.pinned,

            cover: entry.cover
              ? {
                  id: entry.cover.id,
                  url: entry.cover.url,
                  alternativeText: entry.cover.alternativeText,
                }
              : null,

            category: Array.isArray(entry.category)
              ? entry.category.map((c) => ({
                  id: c.id,
                  title: c.title,
                }))
              : [],

            topic: Array.isArray(entry.topic)
              ? entry.topic.map((t) => ({
                  id: t.id,
                  title: t.title,
                }))
              : [],

            categoryIds: Array.isArray(entry.category)
              ? entry.category.map((c) => c.id)
              : [],
            topicIds: Array.isArray(entry.topic)
              ? entry.topic.map((t) => t.id)
              : [],

            content: [entry.title ?? "", entry.description ?? ""].join(" "),
          };
        },

        settings: {
          searchableAttributes: ["title", "description", "content"],
          filterableAttributes: ["categoryIds", "topicIds", "pinned"],
          sortableAttributes: ["publishedAt", "views"],
        },
      },

      ipk: {
        indexName: "ipk",

        populate: {
          topic: { fields: ["id", "title"] },
          author: { fields: ["id", "name"] },
          topic_dps: { fields: ["id", "title"] },
          ipk_file: { fields: ["id", "url", "name"] },
        },

        transformEntry({ entry }) {
          return {
            id: entry.id,
            ipk_title: entry.ipk_title,
            slug: entry.slug,
            description: entry.description,
            ipk_date: entry.ipk_date,
            publishedAt: entry.publishedAt,
            documentId: entry.documentId,
            views: entry.views,

            topic: Array.isArray(entry.topic)
              ? entry.topic.map((t) => ({
                  id: t.id,
                  title: t.title,
                }))
              : [],

            author: entry.author
              ? { id: entry.author.id, name: entry.author.name }
              : null,

            topic_dps: entry.topic_dps
              ? {
                  id: entry.topic_dps.id,
                  title: entry.topic_dps.title,
                }
              : null,

            topicDpsId: entry.topic_dps ? entry.topic_dps.id : null,

            ipk_file: entry.ipk_file
              ? {
                  id: entry.ipk_file.id,
                  url: entry.ipk_file.url,
                  name: entry.ipk_file.name,
                }
              : null,

            content: [entry.ipk_title ?? "", entry.description ?? ""].join(" "),
          };
        },

        settings: {
          searchableAttributes: ["ipk_title", "slug", "description", "content"],
          filterableAttributes: ["topicDpsId"],
          sortableAttributes: ["ipk_date", "publishedAt", "views"],
        },
      },

      "avs-document": {
        indexName: "avs_document",
        populate: {
          topic: { fields: ["id", "title"] },
          author: { fields: ["id", "name"] },
        },
        transformEntry({ entry }) {
          const topics = Array.isArray(entry.topic) ? entry.topic : [];
          const authors = Array.isArray(entry.author) ? entry.author : [];

          return {
            id: entry.id,
            title: entry.title,
            slug: entry.slug,
            description: entry.description,
            views: entry.views,
            publishedAt: entry.publishedAt,
            documentId: entry.documentId,
            pinned: entry.pinned,

            topic: topics.map((t) => ({
              id: t.id,
              title: t.title,
            })),

            author: authors.map((a) => ({
              id: a.id,
              name: a.name,
            })),

            topicIds: topics.map((t) => t.id),
            authorIds: authors.map((a) => a.id),

            content: [entry.title ?? "", entry.description ?? ""].join(" "),
          };
        },
        settings: {
          searchableAttributes: ["title", "description", "content"],
          filterableAttributes: ["topicIds", "authorIds", "pinned"],
          sortableAttributes: ["publishedAt", "views"],
        },
      },

      handbook: {
        indexName: "handbook",
        populate: {
          topic: { fields: ["id", "title"] },
          authors: { fields: ["id", "name"] },
        },
        transformEntry({ entry }) {
          const topics = Array.isArray(entry.topic) ? entry.topic : [];
          const authors = Array.isArray(entry.authors) ? entry.authors : [];

          return {
            id: entry.id,
            title: entry.title,
            slug: entry.slug,
            description: entry.description,
            views: entry.views,
            publishedAt: entry.publishedAt,
            documentId: entry.documentId,
            pinned: entry.pinned,

            topic: topics.map((t) => ({
              id: t.id,
              title: t.title,
            })),

            authors: authors.map((a) => ({
              id: a.id,
              name: a.name,
            })),

            topicIds: topics.map((t) => t.id),
            authorIds: authors.map((a) => a.id),

            content: [entry.title ?? "", entry.description ?? ""].join(" "),
          };
        },
        settings: {
          searchableAttributes: ["title", "description", "content"],
          filterableAttributes: ["topicIds", "authorIds", "pinned"],
          sortableAttributes: ["publishedAt", "views"],
        },
      },
      "expert-answer": {
        indexName: "expert_answer",
        populate: {
          topic: { fields: ["id", "title"] },
          author: { fields: ["id", "name"] },
        },
        transformEntry({ entry }) {
          const topics = Array.isArray(entry.topic) ? entry.topic : [];
          const author = entry.author || null;

          return {
            id: entry.id,
            short_title: entry.short_title,
            question_title: entry.question_title,
            slug: entry.slug,
            views: entry.views,
            publishedAt: entry.publishedAt,
            documentId: entry.documentId,
            pinned: entry.pinned,

            topic: topics.map((t) => ({
              id: t.id,
              title: t.title,
            })),

            author: author
              ? {
                  id: author.id,
                  name: author.name,
                }
              : null,

            topicIds: topics.map((t) => t.id),

            content: [entry.short_title ?? "", entry.question_title ?? ""].join(
              " "
            ),
          };
        },
        settings: {
          searchableAttributes: ["short_title", "question_title", "content"],
          filterableAttributes: ["topicIds", "pinned"],
          sortableAttributes: ["publishedAt", "views"],
        },
      },
      "video-recording": {
        indexName: "video-recording",
        populate: {
          card_cover: { fields: ["id", "url", "alternativeText"] },
          topic: { fields: ["id", "title"] },
          speaker: { fields: ["id", "first_name", "last_name"] },
        },
        transformEntry({ entry }) {
          const topics = Array.isArray(entry.topic) ? entry.topic : [];
          const speakers = Array.isArray(entry.speaker) ? entry.speaker : [];

          return {
            id: entry.id,
            title: entry.title,
            description: entry.description,
            slug: entry.slug,
            video_type: entry.video_type,
            stream_date: entry.stream_date,
            publishedAt: entry.publishedAt,
            documentId: entry.documentId,
            top: entry.top ?? false,

            card_cover: entry.card_cover
              ? {
                  id: entry.card_cover.id,
                  url: entry.card_cover.url,
                  alternativeText: entry.card_cover.alternativeText,
                }
              : null,

            topic: topics.map((t) => ({
              id: t.id,
              title: t.title,
            })),
            topicIds: topics.map((t) => t.id),

            speaker: speakers.map((s) => ({
              id: s.id,
              first_name: s.first_name,
              last_name: s.last_name,
            })),
            speakerIds: speakers.map((s) => s.id),

            content: [
              entry.title ?? "",
              entry.description ?? "",
              speakers
                .map((s) => `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim())
                .join(" "),
            ].join(" "),
          };
        },
        settings: {
          searchableAttributes: ["title", "description", "content"],
          filterableAttributes: ["topicIds", "speakerIds", "video_type", "top"],
          sortableAttributes: ["publishedAt", "stream_date", "top"],
        },
      },
      "free-webinar": {
        indexName: "free-webinar",
        populate: {
          card_cover: { fields: ["id", "url", "alternativeText"] },
          topic: { fields: ["id", "title"] },
          speaker: { fields: ["id", "first_name", "last_name"] },
        },
        transformEntry({ entry }) {
          const topics = Array.isArray(entry.topic) ? entry.topic : [];
          const speakers = Array.isArray(entry.speaker) ? entry.speaker : [];

          return {
            id: entry.id,
            title: entry.title,
            description: entry.description,
            slug: entry.slug,
            webinar_type: entry.webinar_type,
            date_1: entry.date_1,
            date_2: entry.date_2,
            date_3: entry.date_3,
            time: entry.time,
            stream_url: entry.stream_url,
            pinned: entry.pinned ?? false,
            documentId: entry.documentId,

            card_cover: entry.card_cover
              ? {
                  id: entry.card_cover.id,
                  url: entry.card_cover.url,
                  alternativeText: entry.card_cover.alternativeText,
                }
              : null,

            topic: topics.map((t) => ({
              id: t.id,
              title: t.title,
            })),
            topicIds: topics.map((t) => t.id),

            speaker: speakers.map((s) => ({
              id: s.id,
              first_name: s.first_name,
              last_name: s.last_name,
            })),
            speakerIds: speakers.map((s) => s.id),

            content: [
              entry.title ?? "",
              entry.description ?? "",
              speakers
                .map((s) => `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim())
                .join(" "),
            ].join(" "),
          };
        },
        settings: {
          searchableAttributes: ["title", "description", "content"],
          filterableAttributes: [
            "topicIds",
            "speakerIds",
            "webinar_type",
            "pinned",
          ],
          sortableAttributes: [
            "publishedAt",
            "date_1",
            "date_2",
            "date_3",
            "time",
          ],
        },
      },
      course: {
        indexName: "course",
        populate: {
          card_cover: { fields: ["id", "url", "alternativeText"] },
          topic: { fields: ["id", "title"] },
          speaker: {
            fields: ["id", "first_name", "last_name"],
          },
        },
        transformEntry({ entry }) {
          const topics = Array.isArray(entry.topic) ? entry.topic : [];
          const speakers = Array.isArray(entry.speaker) ? entry.speaker : [];

          return {
            id: entry.id,
            title: entry.title,
            description: entry.description,
            slug: entry.slug,
            course_type: entry.course_type,
            publishedAt: entry.publishedAt,
            documentId: entry.documentId,

            card_cover: entry.card_cover
              ? {
                  id: entry.card_cover.id,
                  url: entry.card_cover.url,
                  alternativeText: entry.card_cover.alternativeText,
                }
              : null,

            topic: topics.map((t) => ({
              id: t.id,
              title: t.title,
            })),
            topicIds: topics.map((t) => t.id),

            speaker: speakers.map((s) => ({
              id: s.id,
              first_name: s.first_name,
              last_name: s.last_name,
            })),
            speakerIds: speakers.map((s) => s.id),

            content: [
              entry.title ?? "",
              entry.description ?? "",
              speakers
                .map((s) => `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim())
                .join(" "),
            ].join(" "),
          };
        },
        settings: {
          searchableAttributes: ["title", "description", "content"],
          filterableAttributes: ["topicIds", "speakerIds"],
          sortableAttributes: ["publishedAt"],
        },
      },
    },
  },
});
