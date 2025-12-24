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
    {
      method: "GET",
      path: "/news-articles/accessible",
      handler: "news-article.accessible",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
