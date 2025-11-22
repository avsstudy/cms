"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/courses/me",
      handler: "course.getCoursesForCurrentUser",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
    {
      method: "GET",
      path: "/courses/me/:slug",
      handler: "course.getCourseForCurrentUser",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
  ],
};
