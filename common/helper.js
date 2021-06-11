const _ = require('lodash');
const axios = require('axios');
import EventPhaseIDs from '../app-constants';
const m2mAuth = require('tc-core-library-js').auth.m2m;

const topcoderM2MConfig = _.pick(process.env, ['AUTH0_URL', 'AUTH0_AUDIENCE', 'TOKEN_CACHE_TIME', 'AUTH0_PROXY_SERVER_URL'])
const topcoderM2M = m2mAuth({...topcoderM2MConfig, AUTH0_AUDIENCE: topcoderM2MConfig.AUTH0_AUDIENCE})

const helper = {
  /* Function to get M2M token
 * (Topcoder APIs only)
 * @returns {Promise}
 */
  async getTopcoderM2Mtoken() {
    try {
      return topcoderM2M.getMachineToken(process.env.AUTH0_CLIENT_ID, process.env.AUTH0_CLIENT_SECRET)
    } catch (error) {
      console.info('An error occurred fetching the m2m token for Topcoder APIs')
      console.info(error);
    }
  },

  /**
   * Get challenge by id
   * @param challengeId the challenge id
   * @returns {object} challenge
   */
  async getChallenge(challengeId) {
    const url = `${process.env.CHALLENGE_API_URL}/${challengeId}`;
    const token = await helper.getTopcoderM2Mtoken();

    console.info(`request GET ${url}`)
    try {
      const res = await axios.get(url, {headers: {Authorization: `Bearer ${token}`}})
      console.info(res)
      return res.data
    } catch (err) {
      console.info(err.message)

      if (err.response) {
        if (err.response.status === 404) {
          console.info(`The Challenge with the id: ${challengeId} not exist`)
        }
      }

      console.info(`get ${url} failed`)
    }
  },

  /**
   * Create events from challenge object
   * @param challenge the challenge object
   */
  getEventsFromPhases(challenge) {
    const events = []
    const dateBasedEvents = {}

    for (const phase of challenge.phases) {
      // if the phase is not the predefined phase, ignore it
      if (!EventPhaseIDs.includes(phase.phaseId)) {
        continue
      }
      if (!dateBasedEvents[phase.scheduledStartDate]) {
        dateBasedEvents[phase.scheduledStartDate] = []
      }
      if (!dateBasedEvents[phase.scheduledEndDate]) {
        dateBasedEvents[phase.scheduledEndDate] = []
      }
      if (new Date(phase.scheduledEndDate).getTime() >= Date.now() && !phase.isOpen) {
        dateBasedEvents[phase.scheduledStartDate].push({
          phaseId: phase.phaseId,
          isOpen: true
        })
      }
      if (new Date(phase.scheduledStartDate).getTime() <= Date.now() && phase.isOpen) {
        dateBasedEvents[phase.scheduledEndDate].push({
          phaseId: phase.phaseId,
          isOpen: false
        })
      }
    }

    _.each(dateBasedEvents, (eventData, scheduleTime) => {
      if (eventData.length > 0) {
        events.push({
          externalId: challenge.id,
          scheduleTime,
          payload: {
            phases: eventData
          }
        })
      }
    })

    return events
  },

  /**
   * Create events in executor app
   * @param events the events array
   */
  async createEventsInExecutor(events) {
    const url = process.env.SCHEDULE_API_URL
    const token = await helper.getTopcoderM2Mtoken()

    for (const event of events) {
      try {
        // schedule executor api payload
        const executorPayload = {
          url: `${process.env.CHALLENGE_API_URL}/${event.externalId}`,
          externalId: event.externalId,
          method: 'patch',
          scheduleTime: event.scheduleTime,
          payload: JSON.stringify(event.payload)
        }

        // call executor api
        console.debug(`request POST ${url}`)
        await axios.post(`${url}`, executorPayload, {headers: {Authorization: `Bearer ${token}`}})
      } catch (err) {
        console.info(`Failed to create event for external ID ${event.externalId}`)
        console.info(err.message)
      }
    }
  },

  /**
   * Get challenge by id from Schedule Api
   * @param challengeId the challenge id
   * @returns {Array} array of events
   */
  async getEventsFromScheduleApi(challengeId) {
    const url = `${process.env.SCHEDULE_API_URL}?externalId=${challengeId}`

    console.info(`request GET ${url}`)
    try {
      const res = await axios.get(url)
      return res.data || []
    } catch (err) {
      return []
    }
  },

  /**
   * Delete events in executor app
   * @param events the events array
   */
  async deleteEventsInExecutor(events) {
    const url = process.env.SCHEDULE_API_URL
    for (const event of events) {
      // schedule executor api payload
      const executorPayload = {
        id: event.id
      }
      try {
        // call executor api
        console.info(`request DELETE ${url}`)
        await axios.delete(`${url}`, {data: executorPayload})
      } catch (err) {
        console.info(`Failed to delete event ${event.id}`)
        console.info(err.message)
      }
    }
  }
}


export default helper
