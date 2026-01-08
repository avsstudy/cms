"use strict";

function frontendAnswersUrl() {
  const base = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  return `${base}/answers/my`;
}

async function notifyIfLinkedToUserQuestion(expertAnswerId) {
  const answer = await strapi.entityService.findOne(
    "api::expert-answer.expert-answer",
    expertAnswerId,
    {
      populate: {
        user_question: {
          fields: ["id"],
          populate: { user: { fields: ["id"] } },
        },
      },
    }
  );

  const uq = answer?.user_question;
  const userId = uq?.user?.id;
  if (!uq?.id || !userId) return;

  const nService = strapi.service("api::notification.notification");
  const uniqueKey = `EXPERT_ANSWER_READY:${userId}:${uq.id}`;

  await nService.createNotification({
    userId,
    code: "EXPERT_ANSWER_READY",
    uniqueKey,
    meta_data: {
      source: "expert-answer.lifecycle",
      userQuestionId: uq.id,
      expertAnswerId,
    },
    override: {
      ctaUrl: frontendAnswersUrl(),
    },
  });
}

module.exports = {
  async afterCreate(event) {
    const id = event.result?.id;
    if (!id) return;
    await notifyIfLinkedToUserQuestion(id);
  },

  async afterUpdate(event) {
    const id = event.result?.id;
    if (!id) return;
    await notifyIfLinkedToUserQuestion(id);
  },
};
