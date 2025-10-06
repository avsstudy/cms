"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/handbooks/:id/views",
      handler: "handbooks.views",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
