"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/notifications",
      handler: "notification.findMine",
      config: { policies: ["global::is-authenticated"] },
    },
    {
      method: "GET",
      path: "/notifications/unread-count",
      handler: "notification.unreadCount",
      config: { policies: ["global::is-authenticated"] },
    },
    {
      method: "PATCH",
      path: "/notifications/:id/read",
      handler: "notification.markRead",
      config: { policies: ["global::is-authenticated"] },
    },
  ],
};
