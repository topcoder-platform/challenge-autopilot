/**
 * The default configuration file.
 */

 module.exports = {
  SCHEDULE_API_URL: process.env.SCHEDULE_API_URL || 'https://api.topcoder-dev.com/v5/schedules',
  CHALLENGE_API_URL: process.env.CHALLENGE_API_URL || 'https://api.topcoder-dev.com/v5/challenges',
  SUBMISSIONS_API_URL: process.env.CHALLENGE_API_URL || 'https://api.topcoder-dev.com/v5/submissions',
  CHALLENGE_API_PHASE_URL: process.env.CHALLENGE_API_URL || 'https://api.topcoder-dev.com/v5/challenge-phases',
  AUTH0_URL: process.env.AUTH0_URL,
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
  TOKEN_CACHE_TIME: process.env.TOKEN_CACHE_TIME,
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
  AUTH0_PROXY_SERVER_URL: process.env.AUTH0_PROXY_SERVER_URL
}
