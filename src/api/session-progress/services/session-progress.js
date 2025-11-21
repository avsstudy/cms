'use strict';

/**
 * session-progress service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::session-progress.session-progress');
