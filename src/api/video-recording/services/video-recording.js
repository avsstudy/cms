'use strict';

/**
 * video-recording service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::video-recording.video-recording');
