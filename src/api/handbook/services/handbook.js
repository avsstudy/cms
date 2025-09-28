'use strict';

/**
 * handbook service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::handbook.handbook');
