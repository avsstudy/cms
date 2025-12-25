"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/free-webinars/search",
      handler: "free-webinar.search",
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: "GET",
      path: "/free-webinars/accessible",
      handler: "free-webinar.accessible",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
