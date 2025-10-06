"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/articles/:id/view",
      handler: "article.view",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
