'use strict';

/**
 * site-page service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::site-page.site-page');
