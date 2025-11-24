"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/courses/me/:slug/session/:sessionSlug/homework/:homeworkId",
      handler: "homework-progress.getHomeworkForCurrentUser",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
    {
      method: "POST",
      path: "/homework-progress/:homeworkId/complete",
      handler: "homework-progress.completeHomework",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
  ],
};
