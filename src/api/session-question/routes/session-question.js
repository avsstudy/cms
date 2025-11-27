"use strict";

/**
 * session-question router
 */

const { createCoreRouter } = require("@strapi/strapi").factories;

module.exports = createCoreRouter("api::session-question.session-question", {
  config: {
    create: {
      policies: ["global::is-authenticated"],
    },
  },
});
