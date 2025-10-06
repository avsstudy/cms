"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/articles/:id/views",
      handler: "article.views",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
