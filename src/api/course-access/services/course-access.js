'use strict';

/**
 * course-access service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::course-access.course-access');
