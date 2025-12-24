"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/handbooks/search",
      handler: "handbook.search",
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: "GET",
      path: "/handbooks/accessible",
      handler: "handbook.accessible",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
