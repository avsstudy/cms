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
    {
      method: "GET",
      path: "/ipks/accessible",
      handler: "ipk.accessible",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
