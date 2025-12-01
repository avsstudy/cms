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
      host: env("MEILISEARCH_HOST", "http://avssearch.duckdns.org"),
      apiKey: env("MEILISEARCH_ADMIN_API_KEY"),

      "api::article.article": {
        indexName: "articles",

        transformEntry({ entry }) {
          const categories = Array.isArray(entry.category)
            ? entry.category.map((c) => ({
                id: c.id,
                name: c.name,
                slug: c.slug,
              }))
            : [];

          const topics = Array.isArray(entry.topic)
            ? entry.topic.map((t) => ({
                id: t.id,
                name: t.name,
                slug: t.slug,
              }))
            : [];

          const author = entry.author
            ? {
                id: entry.author.id,
                name: entry.author.name,
                slug: entry.author.slug,
              }
            : null;

          const topicIds = topics.map((t) => t.id);
          const topicSlugs = topics.map((t) => t.slug);
          const categoryIds = categories.map((c) => c.id);
          const categorySlugs = categories.map((c) => c.slug);

          const cover = entry.cover
            ? {
                id: entry.cover.id,
                url: entry.cover.url,
                name: entry.cover.name,
                alternativeText: entry.cover.alternativeText,
              }
            : null;

          return {
            id: entry.id,
            title: entry.title,
            article_date: entry.article_date,
            description: entry.description,
            slug: entry.slug,
            cover,
            categories,
            topics,
            author,
            topicIds,
            topicSlugs,
            categoryIds,
            categorySlugs,
            views: entry.views,
            subscription_type: entry.subscription_type,
            pinned: entry.pinned,
            general_content: entry.general_content,
          };
        },

        settings: {
          searchableAttributes: [
            "title",
            "description",
            "slug",
            "author.name",
            "topics.name",
            "categories.name",
          ],

          filterableAttributes: [
            "subscription_type",
            "pinned",
            "topicIds",
            "topicSlugs",
            "categoryIds",
            "categorySlugs",
            "author.id",
          ],
          sortableAttributes: ["article_date", "views", "createdAt"],
        },
      },
    },
  },
});
