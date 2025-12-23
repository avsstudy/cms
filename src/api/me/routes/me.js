"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/me",
      handler: "me.me",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
  ],
};
