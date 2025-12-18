"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/favorites/article/ids",
      handler: "favorite.articleIds",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
    {
      method: "POST",
      path: "/favorites/toggle",
      handler: "favorite.toggle",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
  ],
};
