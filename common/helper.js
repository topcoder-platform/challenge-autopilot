const _ = require('lodash')
const axios = require('axios')
import * as AppConstants from '../app-constants'
const EventPhaseIDs = AppConstants.EventPhaseIDs
const m2mAuth = require('tc-core-library-js').auth.m2m

const topcoderM2MConfig = _.pick(process.env, ['AUTH0_URL', 'AUTH0_AUDIENCE', 'TOKEN_CACHE_TIME', 'AUTH0_PROXY_SERVER_URL'])
const topcoderM2M = m2mAuth({ ...topcoderM2MConfig, AUTH0_AUDIENCE: topcoderM2MConfig.AUTH0_AUDIENCE })

const helper = {
  /**
   * Check prerequisites to close a phase
   * @param {Array} dateBasedEvents the events array
   * @param {Object} phase the phase
   * @param {String} challengeId the challenge ID
   */
  async checkPhasePrerequisites(dateBasedEvents, phase, challengeId) {
    // Checkpoint Submission Phase is closing...
    if (phase.phaseId === AppConstants.CheckpointSubmissionPhase) {
      const existsSubmission = await helper.getChallengeSubmissionsByChallengeId(challengeId, AppConstants.SubmissionTypes.CHECKPOINT_SUBMISSION)
      if (existsSubmission) {
        dateBasedEvents[phase.scheduledStartDate].push({
          phaseId: AppConstants.CheckpointScreeningPhase,
          isOpen: true
        })
      }
    } else if (phase.phaseId === AppConstants.SubmissionPhase) {
      const existsSubmission = await helper.getChallengeSubmissionsByChallengeId(challengeId, AppConstants.SubmissionTypes.CONSTEST_SUBMISSION)
      if (existsSubmission) {
        dateBasedEvents[phase.scheduledStartDate].push({
          phaseId: AppConstants.ScreeningPhase,
          isOpen: true
        })
      }
    }
  },

  /**
   * Function to get M2M token
   * @returns {Promise}
   */
  async getTopcoderM2Mtoken() {
    try {
      return topcoderM2M.getMachineToken(process.env.AUTH0_CLIENT_ID, process.env.AUTH0_CLIENT_SECRET)
    } catch (error) {
      console.info('An error occurred fetching the m2m token for Topcoder APIs')
      console.info(error)
    }
  },

  /**
   * Get challenge by id
   * @param challengeId the challenge id
   * @returns {object} challenge
   */
  async getChallenge(challengeId) {
    const url = `${process.env.CHALLENGE_API_URL}/${challengeId}`
    const token = await helper.getTopcoderM2Mtoken()

    try {
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } })
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
   * Get submission id by submission id
   * @param submissionId the submission id
   * @returns {object} submission
   */
  async getSubmissionById(submissionId) {
    const url = `${process.env.SUBMISSIONS_API_URL}/submissions/${submissionId}`
    const token = await helper.getTopcoderM2Mtoken()

    try {
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } })
      return res.data
    } catch (err) {
      console.info(err.message)
      if (err.response) {
        if (err.response.status === 404) {
          console.info(`The Submission with the id: ${submissionId} not exist`)
        }
      }
      console.info(`get ${url} failed`)
    }
  },

  /**
   * Get submissions by challenge id
   * @param challengeId the challenge id
   * @param type the submission type
   * @returns {Array} array of challenges
   */
  async getChallengeSubmissionsByChallengeId(challengeId, type = AppConstants.SubmissionTypes.CONSTEST_SUBMISSION) {
    const url = `${process.env.SUBMISSIONS_API_URL}/submissions?challengeId=${challengeId}&type=${type}`
    const token = await helper.getTopcoderM2Mtoken()

    try {
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } })
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
   * Check if a submission get reviewed
   * @param submissionId the submission id
   * @returns {boolean} true if submission is reviewed
   */
  async isSubmissionReviewed(submissionId) {
    const url = `${process.env.SUBMISSIONS_API_URL}/reviews?submissionId=${submissionId}`
    const token = await helper.getTopcoderM2Mtoken()
    try {
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } })
      const reviews = res.data
      if (reviews && reviews.length > 0) {
        for (const oneReview of reviews) {
          if (oneReview.status !== 'completed') {
            return false
          }
        }
        return true
      }
      console.info(`The Submission with the id: ${submissionId} doens't have review records`)
      return false
    } catch (err) {
      console.info(err.message)
      if (err.response) {
        if (err.response.status === 404) {
          console.info(`The Submission with the id: ${submissionId} not exist`)
        }
      }
      console.info(`get ${url} failed`)
    }
    return false
  },

  /**
   * Check if all submissions get reviewed
   * @param submissions the submissions
   * @returns {boolean} if all submissions get reviewed
   */
  async checkIfAllSubmissionsReviewed(submissions) {
    for (const oneSubmission of submissions) {
      const reviewed = await isSubmissionReviewed(oneSubmission.id)
      if (!reviewed) {
        return false
      }
    }
    return true
  },
  /**
   * Create events from challenge object
   * @param challenge the challenge object
   * @param extraEvents the extra events need to handle
   */
  async getEventsFromPhases(challenge, extraEvents) {
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
        await helper.checkPhasePrerequisites(dateBasedEvents, phase, challenge.id)
      }
      // TODO: Optimise this
      // Handle extraEvents
      for (const oneExtraEvent of extraEvents) {
        if (phase.phaseId == oneExtraEvent.phaseId) {
          if (oneExtraEvent.isOpen) { // Should open the phase
            dateBasedEvents[phase.scheduledStartDate].push({
              phaseId: phase.phaseId,
              isOpen: true
            })
          } else { // Should close the phase
            dateBasedEvents[phase.scheduledEndDate].push({
              phaseId: phase.phaseId,
              isOpen: false
            })
          }
        }
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
        await axios.post(`${url}`, executorPayload, { headers: { Authorization: `Bearer ${token}` } })
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
        await axios.delete(`${url}`, { data: executorPayload })
      } catch (err) {
        console.info(`Failed to delete event ${event.id}`)
        console.info(err.message)
      }
    }
  },

  /**
   * Extract value from a DynamoDB stream event based on the provided key
   * @param {Object} data the event stream object
   * @param {String} key the property key
   */
  async extractFromDynamoStreamEvent(data, key) {
    const dynamoEvents = _.filter(_.get(data, 'Records', []), r => r.eventSource === AppConstants.EventSources.DynamoDB)
    return _.map(dynamoEvents, record => {
      const obj = _.get(record, `dynamodb.Keys.${key}`)
      return {
        eventName: record.eventName,
        [key]: obj[_.keys(obj)[0]]
      }
    })
  }
}


export default helper
