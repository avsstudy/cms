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

        // 🔽 обовʼязкове populate для звʼязків і медіа
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

            // обкладинка (з урахуванням Strapi-media)
            cover: entry.cover
              ? {
                  id: entry.cover.id,
                  url: entry.cover.url,
                  alternativeText: entry.cover.alternativeText,
                }
              : null,

            // категорії
            category: Array.isArray(entry.category)
              ? entry.category.map((c) => ({
                  id: c.id,
                  title: c.title,
                }))
              : [],

            // топіки
            topic: Array.isArray(entry.topic)
              ? entry.topic.map((t) => ({
                  id: t.id,
                  title: t.title,
                }))
              : [],

            // автор
            author: entry.author
              ? { id: entry.author.id, name: entry.author.name }
              : null,

            // ID для фільтрів
            categoryIds: Array.isArray(entry.category)
              ? entry.category.map((c) => c.id)
              : [],
            topicIds: Array.isArray(entry.topic)
              ? entry.topic.map((t) => t.id)
              : [],

            // текст для пошуку
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
    },
  },
});
