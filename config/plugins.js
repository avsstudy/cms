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

            subscription_type: entry.subscription_type,
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
          filterableAttributes: [
            "categoryIds",
            "topicIds",
            "subscription_type",
            "pinned",
          ],
          sortableAttributes: ["article_date", "views"],
        },
      },

      "news-article": {
        indexName: "news-article",

        populate: {
          cover: { fields: ["id", "url", "alternativeText"] },
          category: { fields: ["id", "title"] },
          topic: { fields: ["id", "title"] },
          subscription_type: { fields: ["id", "title"] },
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

            subscription_type: entry.subscription_type
              ? {
                  id: entry.subscription_type.id,
                  title: entry.subscription_type.title,
                }
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
          filterableAttributes: [
            "categoryIds",
            "topicIds",
            "pinned",
            "subscription_type.id",
          ],
          sortableAttributes: ["publishedAt", "views"],
        },
      },

      ipk: {
        indexName: "ipk",

        populate: {
          topic: { fields: ["id", "title"] },
          author: { fields: ["id", "name"] },
          subscription_type: { fields: ["id", "title"] },
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

            topicIds: Array.isArray(entry.topic)
              ? entry.topic.map((t) => t.id)
              : [],

            author: entry.author
              ? { id: entry.author.id, name: entry.author.name }
              : null,

            subscription_type: entry.subscription_type
              ? {
                  id: entry.subscription_type.id,
                  title: entry.subscription_type.title,
                }
              : null,

            topic_dps: entry.topic_dps
              ? { id: entry.topic_dps.id, title: entry.topic_dps.title }
              : null,

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
          filterableAttributes: ["topicIds", "subscription_type.id"],
          sortableAttributes: ["ipk_date", "publishedAt", "views"],
        },
      },
    },
  },
});
