"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/expert-answers/search",
      handler: "expert-answer.search",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
