"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/ipks/:id/views",
      handler: "ipk.views",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
