"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/user-questions/my",
      handler: "user-question.my",
      config: {
        policies: ["global::is-authenticated"],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/user-questions/my/:documentId",
      handler: "user-question.myByDocumentId",
      config: {
        policies: ["global::is-authenticated"],
        middlewares: [],
      },
    },
  ],
};
