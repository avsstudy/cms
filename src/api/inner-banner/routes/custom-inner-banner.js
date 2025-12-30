"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/inner-banners/by-placement/:placement",
      handler: "inner-banner.byPlacement",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
