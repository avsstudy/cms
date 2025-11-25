'use strict';

/**
 * test-attempt service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::test-attempt.test-attempt');
