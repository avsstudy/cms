"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/ipks/search",
      handler: "ipk.search",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
