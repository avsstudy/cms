"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/session-tests/by-session/:studySessionId",
      handler: "session-test.byStudySession",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
    {
      method: "POST",
      path: "/session-tests/:id/submit",
      handler: "session-test.submit",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
    {
      method: "GET",
      path: "/session-tests/:id/my-last-attempt",
      handler: "session-test.myLastAttempt",
      config: {
        policies: ["global::is-authenticated"],
      },
    },
  ],
};
