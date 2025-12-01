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

      // 🔥 СУПЕР ВАЖЛИВО: правильний ключ - назва моделі = article
      article: {
        indexName: "article",

        transformEntry({ entry }) {
          return {
            id: entry.id,
            title: entry.title,
            description: entry.description,
            views: entry.views,
            article_date: entry.article_date,

            // categories: relation many-to-many
            categoryIds: entry.category?.map((c) => c.id) ?? [],

            // topics: relation many-to-many
            topicIds: entry.topic?.map((t) => t.id) ?? [],

            // search fields
            content: [entry.title ?? "", entry.description ?? ""].join(" "),
          };
        },

        settings: {
          searchableAttributes: ["title", "description", "content"],
          filterableAttributes: ["categoryIds", "topicIds"],
          sortableAttributes: ["article_date", "views"],
        },
      },
    },
  },
});
