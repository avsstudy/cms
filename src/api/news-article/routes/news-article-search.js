"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/news-articles/search",
      handler: "news-article.search",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
