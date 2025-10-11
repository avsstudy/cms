'use strict';

/**
 * expert-answer service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::expert-answer.expert-answer');
