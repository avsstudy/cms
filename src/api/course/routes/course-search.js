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
    {
      method: "GET",
      path: "/courses/accessible",
      handler: "course.accessible",
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: "GET",
      path: "/course/profile",
      handler: "course.profile",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
