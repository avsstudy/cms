"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/news-articles/:id/views",
      handler: "news-article.views",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
