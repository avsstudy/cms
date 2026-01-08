"use strict";

function frontendAnswersUrl() {
  const base = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  return `${base}/answers/my`;
}

module.exports = {
  async beforeUpdate(event) {
    const id = event.params?.where?.id;
    if (!id) return;

    const prev = await strapi.entityService.findOne(
      "api::user-question.user-question",
      id,
      {
        fields: ["id", "expert_comment"],
        populate: {
          user: { fields: ["id"] },
          expert_answer: { fields: ["id"] },
        },
      }
    );

    event.state = event.state || {};
    event.state.prev = prev;
  },

  async afterUpdate(event) {
    const prev = event.state?.prev;
    const id = event.result?.id;
    if (!id || !prev) return;

    const current = await strapi.entityService.findOne(
      "api::user-question.user-question",
      id,
      {
        fields: ["id", "expert_comment"],
        populate: {
          user: { fields: ["id"] },
          expert_answer: { fields: ["id"] },
        },
      }
    );

    const userId = current.user?.id;
    if (!userId) return;

    const prevHadComment = !!(
      prev.expert_comment && String(prev.expert_comment).trim()
    );
    const nowHasComment = !!(
      current.expert_comment && String(current.expert_comment).trim()
    );

    const prevHadAnswer = !!prev.expert_answer?.id;
    const nowHasAnswer = !!current.expert_answer?.id;

    const answerBecameAvailable =
      (!prevHadComment && nowHasComment) || (!prevHadAnswer && nowHasAnswer);

    if (!answerBecameAvailable) return;

    const nService = strapi.service("api::notification.notification");

    const uniqueKey = `EXPERT_ANSWER_READY:${userId}:${current.id}`;

    await nService.createNotification({
      userId,
      code: "EXPERT_ANSWER_READY",
      uniqueKey,
      meta_data: {
        source: "user-question.lifecycle",
        userQuestionId: current.id,
        expertAnswerId: current.expert_answer?.id ?? null,
      },
      override: {
        ctaUrl: frontendAnswersUrl(),
      },
    });
  },
};
