"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/handbooks/:id/views",
      handler: "handbook.views",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
