"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/profile/me",
      handler: "profile.me",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
    {
      method: "PUT",
      path: "/profile/me",
      handler: "profile.updateMe",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
  ],
};
