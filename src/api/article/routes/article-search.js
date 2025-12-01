"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/articles/search",
      handler: "article.search",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
