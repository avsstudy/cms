"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/news-articles/:id/views",
      handler: "news-articles.views",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
