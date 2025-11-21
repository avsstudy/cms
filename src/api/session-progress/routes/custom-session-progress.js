"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/session-progress/start",
      handler: "session-progress.startSession",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
    {
      method: "POST",
      path: "/session-progress/complete",
      handler: "session-progress.completeSession",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
  ],
};
