"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/courses/search",
      handler: "course.search",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
