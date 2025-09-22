'use strict';

/**
 * video-review service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::video-review.video-review');
