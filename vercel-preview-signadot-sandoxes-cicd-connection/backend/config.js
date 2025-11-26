// * Environment-based configuration
// * Only PORT is configurable via environment variables
// * Other configurations can be added here when needed

/**
 * Application configuration loaded from environment variables
 * @type {Object}
 */
const config = {
  // * Server port (default: 3000)
  port: process.env.PORT || 3000,
};

module.exports = config;

