'use strict';

/**
 * session-test service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::session-test.session-test');
