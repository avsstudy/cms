"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/ipks/:id/views",
      handler: "ipks.views",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
