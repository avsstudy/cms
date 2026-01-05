"use strict";

/**
 * about-page router
 */

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/about-pages/by-type/:page_type",
      handler: "about-page.findByType",
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
