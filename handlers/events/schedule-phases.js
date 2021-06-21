const _ = require('lodash')
import helper from '../../common/helper'
import { ChallengeStatuses, EventNames } from '../../app-constants'

/* Responds to challenge table insert/update - schedules phases */
export const handlerChallenge = async (event, context) => {
  // This will only process the first element of the array. If we use batches,
  // we'll have to modify this to loop through records
  const [challengeDataFromEvent] = helper.extractFromDynamoStreamEvent(event, 'id')
  const challenge = await helper.getChallenge(challengeDataFromEvent.id)

  if (challenge.status !== ChallengeStatuses.ACTIVE || !_.get(challenge, 'legacy.pureV5')) {
    console.info(`The challenge ${challengeId} is not Active or it's not pure V5. Skipping...`)
    return
  }

  if (challengeDataFromEvent.eventName === EventNames.INSERT) {
    // create events
    const events = await helper.getEventsFromPhases(challenge, [])
    // call the executor api
    await helper.createEventsInExecutor(events)
    console.info(`processing of the record completed, id: ${challenge.id}`)
    return
  }
  if (challengeDataFromEvent.eventName === EventNames.MODIFY) {
    // create events
    let newEvents = await helper.getEventsFromPhases(challenge, [])
    let oldEvents = await helper.getEventsFromScheduleApi(challenge.id)

    // use the scheduleTime and phases to check if there is any change
    newEvents = _.map(newEvents, item => ({ externalId: item.externalId, scheduleTime: item.scheduleTime, payload: item.payload}))
    oldEvents = _.map(oldEvents, item => ({ externalId: item.externalId, scheduleTime: item.scheduleTime, payload: JSON.parse(item.payload)}))

    if (!_.isEqual(newEvents, oldEvents)) {
      console.info(`Deleting existing events for challenge ${challenge.id}`)
      await helper.deleteEventsInExecutor(oldEvents)
      console.info(`Creating events for challenge ${challenge.id}`)
      await helper.createEventsInExecutor(newEvents)
      console.info(`processing of the record completed, id: ${challenge.id}`)
    } else {
      console.info(`No need to update events for challenge ${challenge.id}`)
    }
    return
  }
  return
}

/* Responds to review table insert/update - schedules phases */
export const handlerReview = async (event, context) => {
  console.log('event:', event)
  const reviewTypeId = event.detail.newImage.typeId
  const submissionId = event.detail.newImage.submissionId
  const extrEvents = []
  if (reviewTypeId === AppConstants.ReviewType.Screening || reviewTypeId === AppConstants.ReviewType.Review) {
    const submissionInfo = await helper.getSubmissionById(submissionId)
    const challengeId = submissionInfo.challengeId
    const allSubmissions = await helper.getChallengeSubmissionsByChallengeId(challengeId)
    const areAllSubmissionsReivewed = await helper.checkIfAllSubmissionsReviewed(allSubmissions)
    if (areAllSubmissionsReivewed) {
      const challenge = await helper.getChallenge(challengeId)
      if (eviewTypeId === AppConstants.ReviewType.Screening) {
        // Close the checkpoint screening for challenge: challengeId
        extrEvents.push({
          phaseId: AppConstants.CheckpointScreeningPhase,
          isOpen: false
        })
        // Start the checkpoint review for challenge: challengeId
        extrEvents.push({
          phaseId: AppConstants.CheckpointReviewPhase,
          isOpen: true
        })
      } else if (reviewTypeId === AppConstants.ReviewType.Review) {
        // Close the review phase for challenge: challengeId
        extrEvents.push({
          phaseId: AppConstants.ReviewPhase,
          isOpen: false
        })
        // Start the final fix phase for challenge: challengeId
        extrEvents.push({
          phaseId: AppConstants.FinalFixPhase,
          isOpen: true
        })
      }
    }
  }
  if (extrEvents.length > 0) {
    let newEvents = await helper.getEventsFromPhases(challenge, extrEvents)
    let oldEvents = await helper.getEventsFromScheduleApi(challenge.id)
    newEvents = _.map(newEvents, item => ({ externalId: item.externalId, scheduleTime: item.scheduleTime, payload: item.payload}))
    oldEvents = _.map(oldEvents, item => ({ externalId: item.externalId, scheduleTime: item.scheduleTime, payload: JSON.parse(item.payload)}))
    if (!_.isEqual(newEvents, oldEvents)) {
      console.info(`Deleting existing events for challenge ${challenge.id}`)
      await helper.deleteEventsInExecutor(oldEvents)
      console.info(`Creating events for challenge ${challenge.id}`)
      await helper.createEventsInExecutor(newEvents)
      console.info(`processing of the record completed, id: ${challenge.id}`)
    } else {
      console.info(`No need to update events for challenge ${challenge.id}`)
    }
  }
  return
}

/* Responds to submission table insert/update - schedules phases */
export const handlerSubmission = async (event, context) => {
  console.log('event:', event)
  console.log('event:', JSON.stringify(event))
  // const submissionId = event.detail.newImage.id
  // const challengeId = event.detail.newImage.challengeId
  return
}