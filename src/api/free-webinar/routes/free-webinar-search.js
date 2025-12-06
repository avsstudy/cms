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
  ],
};
