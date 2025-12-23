"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/subscription/me",
      handler: "subscription-me.me",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
  ],
};
