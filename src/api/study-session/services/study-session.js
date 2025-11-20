'use strict';

/**
 * study-session service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::study-session.study-session');
