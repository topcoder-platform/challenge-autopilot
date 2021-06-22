const _ = require('lodash')
const axios = require('axios')
import * as AppConstants from '../app-constants'
const EventPhaseIDs = AppConstants.EventPhaseIDs
const m2mAuth = require('tc-core-library-js').auth.m2m

const topcoderM2MConfig = _.pick(process.env, ['AUTH0_URL', 'AUTH0_AUDIENCE', 'TOKEN_CACHE_TIME', 'AUTH0_PROXY_SERVER_URL'])
const topcoderM2M = m2mAuth({ ...topcoderM2MConfig, AUTH0_AUDIENCE: topcoderM2MConfig.AUTH0_AUDIENCE })

const helper = {
  /**
   * Get a challenge phase
   * @param {Object} challenge the challenge object
   * @param {String} phaseId the phase Id
   */
  getPhase(challenge, phaseId) {
    return _.find(_.get(challenge, 'phases', []), p => p.phaseId === phaseId)
  },
  /**
   * Check if a phase is open
   * @param {Object} challenge the challenge object
   * @param {String} phaseId the phase ID
   */
  isPhaseOpen(challenge, phaseId) {
    return _.get(_.find(_.get(challenge, 'phases'), p => p.phaseId === phaseId), 'isOpen', false)
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
    const url = `${process.env.SUBMISSIONS_API_URL}/${submissionId}`
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
  async getChallengeSubmissions(challengeId, type) {
    let url = `${process.env.SUBMISSIONS_API_URL}?challengeId=${challengeId}`
    if (type) {
      url = `${url}&type=${type}`
    }
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
   * @param typeId the review type id
   * @returns {boolean} true if submission is reviewed
   */
  async isSubmissionReviewed(submissionId, typeId) {
    const url = `${process.env.SUBMISSIONS_API_URL.replace('submissions', 'reviews')}?submissionId=${submissionId}`
    const token = await helper.getTopcoderM2Mtoken()
    try {
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } })
      const reviews = res.data
      if (reviews && reviews.length > 0) {
        const targetReview = _.find(reviews, r => r.typeId === typeId)
        if (!targetReview) return false // not yet submitted
        return targetReview.status === 'completed'
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
   * @param reviewType the review type
   * @returns {boolean} if all submissions get reviewed
   */
  async checkIfAllSubmissionsReviewed(submissions, reviewType) {
    for (const oneSubmission of submissions) {
      // TODO: Optimise this to not call the api for all submissions
      const reviewed = await helper.isSubmissionReviewed(oneSubmission.id, reviewType)
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
   * @param submissions the submissions used to check prerequisites
   */
  async getEventsFromPhases(challenge, extraEvents, submissions) {
    const events = []
    const dateBasedEvents = {}

    for (const phase of challenge.phases) {
      // if the phase is not the predefined phase, ignore it
      if (!_.keys(EventPhaseIDs).includes(phase.phaseId)) {
        continue
      }
      if (EventPhaseIDs[phase.phaseId].checkPrerequisites && !EventPhaseIDs[phase.phaseId].checkPrerequisites(challenge, submissions)) {
        continue
      }
      if (!dateBasedEvents[phase.scheduledStartDate]) {
        dateBasedEvents[phase.scheduledStartDate] = []
      }
      if (!dateBasedEvents[phase.scheduledEndDate]) {
        dateBasedEvents[phase.scheduledEndDate] = []
      }
      if (EventPhaseIDs[phase.phaseId].open && new Date(phase.scheduledEndDate).getTime() >= Date.now() && !phase.isOpen) {
        dateBasedEvents[phase.scheduledStartDate].push({
          phaseId: phase.phaseId,
          isOpen: true
        })
      }
      if (EventPhaseIDs[phase.phaseId].close && new Date(phase.scheduledStartDate).getTime() <= Date.now() && phase.isOpen) {
        dateBasedEvents[phase.scheduledEndDate].push({
          phaseId: phase.phaseId,
          isOpen: false
        })
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
      const obj = _.get(record, `dynamodb.NewImage.${key}`)
      return {
        eventName: record.eventName,
        [key]: obj[_.keys(obj)[0]]
      }
    })
  },

  /**
   * Get the member handles based on their IDs
   * @param {Array} userIds member IDs
   */
  async getMemberHandles(userIds) {
    const url = `${process.env.MEMBERS_API_URL}`
    const token = await helper.getTopcoderM2Mtoken()
    try {
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, params: { userIds } })
      const mapping = {}
      _.each(res.data, (entry) => {
        mapping[entry.userId] = entry.handle
      })
      return mapping
    } catch (err) {
      console.info(`Failed to get member handles: ${memberIds}`)
      console.info(err.message)
      throw err
    }
  },

  /**
   * Populate challenge winners
   * @param {String} challengeId the challenge ID
   * @param {Array} submissions the submissions
   * @param {Array} checkpointSubmissions the checkpoint submissions
   */
  async getChallengeWinners(challengeId, submissions, checkpointSubmissions) {
    const memberHandles = await helper.getMemberHandles([
      ..._.map(checkpointSubmissions, s => s.memberId),
      ..._.map(submissions, s => s.memberId)
    ])
    // Take into account the number of checkpoint prizes
    const checkpointReviews = []
    _.each(checkpointSubmissions, (cs) => {
      const checkpointReview = _.find(cs.review, r => r.status === 'completed' && r.typeId === AppConstants.ReviewType.CheckpointReview)
      if (checkpointReview) {
        checkpointReviews.push(checkpointReview)
      }
    })

    const reviews = []
    _.each(submissions, (s) => {
      const review = _.find(s.review, r => r.status === 'completed' && r.typeId === AppConstants.ReviewType.Review)
      if (review) {
        reviews.push(review)
      }
    })

    const winners = []
    let placement = 1
    _.each(_.filter(checkpointReviews, r => r.score === 100), (review) => {
      if (review.status === 'completed') {
        const submission = _.find(checkpointSubmissions, s => s.id === review.submissionId)
        winners.push({
          handle: memberHandles[submission.memberId],
          placement,
          type: AppConstants.PrizeTypes.CHECKPOINT,
          userId: submission.memberId
        })
        placement += 1
      }
    })
    placement = 1
    _.each(_.orderBy(reviews, 'score', 'desc'), (review) => {
      if (review.status === 'completed') {
        const submission = _.find(submissions, s => s.id === review.submissionId)
        winners.push({
          handle: memberHandles[submission.memberId],
          placement,
          type: AppConstants.PrizeTypes.CHECKPOINT,
          userId: submission.memberId
        })
        placement += 1
      }
    })
    return winners
  },

  /**
   * Aggregate the phase arrays of the events
   * @param {Array} oldEvents the old events
   * @param {Array} newEvents the new events
   */
  aggregateEventPhases (oldEvents, newEvents) {
    const dateBasedEvents = {}
    _.each(oldEvents, (event) => {
      dateBasedEvents[`${event.scheduleTime}-${event.externalId}`] = event
    })
    _.each(newEvents, (event) => {
      if (dateBasedEvents[`${event.scheduleTime}-${event.externalId}`]) {
        // overwrite
        const phases = []
        const phaseMap = {}
        _.each(_.get(dateBasedEvents[`${event.scheduleTime}-${event.externalId}`], 'payload.phases', []), (p) => {
          phaseMap[p.phaseId] = p.isOpen
        })
        _.each(_.get(event, 'payload.phases', []), (p) => {
          phaseMap[p.phaseId] = p.isOpen
        })
        _.each(phaseMap, (isOpen, phaseId) => {
          phases.push({ phaseId, isOpen })
        })
        dateBasedEvents[`${event.scheduleTime}-${event.externalId}`] = {
          ...dateBasedEvents[`${event.scheduleTime}-${event.externalId}`],
          payload: {
            ...dateBasedEvents[`${event.scheduleTime}-${event.externalId}`].payload,
            phases
          }
        }
      } else {
        dateBasedEvents[`${event.scheduleTime}-${event.externalId}`] = event
      }
    })
    const events = []
    _.each(dateBasedEvents, (eventData, scheduleTime) => {
      events.push(eventData)
    })
    return events
  }
}


export default helper
