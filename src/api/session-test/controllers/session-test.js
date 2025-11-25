"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::session-test.session-test",
  ({ strapi }) => ({
    async byStudySession(ctx) {
      const { studySessionId } = ctx.params;
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized("You must be authenticated");
      }

      const tests = await strapi.entityService.findMany(
        "api::session-test.session-test",
        {
          filters: {
            study_session: {
              documentId: studySessionId,
            },
          },
          populate: {
            questions: {
              populate: {
                answers: true,
              },
            },
          },
          limit: 1,
        }
      );

      const test = Array.isArray(tests) ? tests[0] : tests;

      if (!test) {
        return ctx.notFound("Session test not found for this study session");
      }

      const attemptsCount = await strapi.entityService.count(
        "api::test-attempt.test-attempt",
        {
          filters: {
            user: user.id,
            session_test: test.id,
          },
        }
      );

      const maxAttempts = test.maxAttempts || null;
      const canAttempt = !maxAttempts || attemptsCount < maxAttempts;

      const questions = (test.questions || [])
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((q) => ({
          id: q.id,
          title: q.title,
          order: q.order,
          answers: (q.answers || [])
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((a) => ({
              id: a.id,
              text: a.text,
              order: a.order,
            })),
        }));

      ctx.body = {
        id: test.id,
        title: test.title,
        timeLimitSeconds: test.timeLimitSeconds || null,
        passingScorePercent: test.passingScorePercent,
        maxAttempts: test.maxAttempts,
        attemptsCount,
        canAttempt,
        questions,
      };
    },

    async submit(ctx) {
      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized("You must be authenticated");
      }

      const testId = ctx.params.id;
      const { answers } = ctx.request.body || {};

      if (!Array.isArray(answers)) {
        return ctx.badRequest("answers must be an array");
      }

      const test = await strapi.entityService.findOne(
        "api::session-test.session-test",
        testId,
        {
          populate: {
            questions: {
              populate: {
                answers: true,
              },
            },
          },
        }
      );

      if (!test) {
        return ctx.notFound("Session test not found");
      }

      const maxAttempts = test.maxAttempts || null;
      const attemptsCount = await strapi.entityService.count(
        "api::test-attempt.test-attempt",
        {
          filters: {
            user: user.id,
            session_test: test.id,
          },
        }
      );

      if (maxAttempts && attemptsCount >= maxAttempts) {
        return ctx.forbidden("Maximum number of attempts reached");
      }

      const totalCount = (test.questions || []).length;
      let correctCount = 0;

      const answersResult = (test.questions || []).map((q) => {
        const userAnswer = answers.find((a) => a.questionId === q.id);
        const selectedAnswerId = userAnswer?.answerId || null;

        const correctAnswer = (q.answers || []).find((a) => a.isCorrect);
        const correctAnswerId = correctAnswer ? correctAnswer.id : null;

        const isCorrect =
          selectedAnswerId && correctAnswerId
            ? Number(selectedAnswerId) === Number(correctAnswerId)
            : false;

        if (isCorrect) correctCount += 1;

        return {
          questionId: q.id,
          questionTitle: q.title,
          explanation: q.explanation,
          selectedAnswerId,
          correctAnswerId,
          isCorrect,
        };
      });

      const scorePercent =
        totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

      const passed =
        scorePercent >= Number(test.passingScorePercent || 0) ? true : false;

      const attempt = await strapi.entityService.create(
        "api::test-attempt.test-attempt",
        {
          data: {
            user: user.id,
            session_test: test.id,
            attempt_status: passed ? "passed" : "failed",
            scorePercent,
            correctCount,
            totalCount,
            answers: answersResult,
            startedAt: new Date(),
            finishedAt: new Date(),
          },
        }
      );

      ctx.body = {
        attemptId: attempt.id,
        attempt_status: attempt.attempt_status,
        passed,
        scorePercent,
        correctCount,
        totalCount,
        passingScorePercent: test.passingScorePercent,
        answers: answersResult,
      };
    },

    async myLastAttempt(ctx) {
      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized("You must be authenticated");
      }

      const testId = ctx.params.id;

      const attempts = await strapi.entityService.findMany(
        "api::test-attempt.test-attempt",
        {
          filters: {
            user: user.id,
            session_test: testId,
          },
          sort: { createdAt: "desc" },
          limit: 1,
        }
      );

      const attempt = attempts[0];

      if (!attempt) {
        return ctx.notFound("No attempts found for this test");
      }

      ctx.body = {
        attemptId: attempt.id,
        attempt_status: attempt.attempt_status,
        scorePercent: attempt.scorePercent,
        correctCount: attempt.correctCount,
        totalCount: attempt.totalCount,
        answers: attempt.answers,
      };
    },
  })
);
