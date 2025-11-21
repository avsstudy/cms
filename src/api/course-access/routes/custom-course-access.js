"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/course-access/grant-for-course",
      handler: "course-access.grantForCourse",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
    {
      method: "POST",
      path: "/course-access/grant-for-subscription",
      handler: "course-access.grantForSubscription",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
    {
      method: "POST",
      path: "/course-access/accept-rules",
      handler: "course-access.acceptRules",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
  ],
};
