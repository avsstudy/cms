"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/payments/me",
      handler: "payment-me.me",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
  ],
};
