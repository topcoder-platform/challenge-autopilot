const _ = require('lodash')
import helper from '../../common/helper'
import {
  ChallengeStatuses,
  EventNames,
  CheckpointScreeningPhase,
  CheckpointReviewPhase,
  ScreeningPhase,
  ReviewPhase,
  ApprovalPhase,
  SubmissionTypes,
  ReviewType,
  EventPhaseIDs
} from '../../app-constants'

/* Responds to challenge table insert/update - schedules phases */
export const handlerChallenge = async (event, context) => {
  // This will only process the first element of the array. If we use batches,
  // we'll have to modify this to loop through records
  const [challengeDataFromEvent] = await helper.extractFromDynamoStreamEvent(event, 'id')
  const challenge = await helper.getChallenge(challengeDataFromEvent.id)

  if (challenge.status !== ChallengeStatuses.ACTIVE || !_.get(challenge, 'legacy.pureV5')) {
    console.info(`The challenge ${challengeDataFromEvent.id} is not Active or it's not pure V5. Skipping...`)
    return
  }

  const submissions = await helper.getChallengeSubmissions(challenge.id)

  if (challengeDataFromEvent.eventName === EventNames.INSERT) {
    // create events
    const events = await helper.getEventsFromPhases(challenge, [], submissions)
    // call the executor api
    await helper.createEventsInExecutor(events)
    console.log('Events to be created:', JSON.stringify(events))
    console.info(`processing of the record completed, id: ${challenge.id}`)
    return
  }
  if (challengeDataFromEvent.eventName === EventNames.MODIFY) {
    // create events
    let newEvents = await helper.getEventsFromPhases(challenge, [], submissions)
    let oldEvents = await helper.getEventsFromScheduleApi(challenge.id)

    // use the scheduleTime and phases to check if there is any change
    newEvents = _.map(newEvents, item => ({ externalId: item.externalId, scheduleTime: item.scheduleTime, payload: item.payload }))
    oldEvents = _.map(oldEvents, item => ({ externalId: item.externalId, scheduleTime: item.scheduleTime, payload: JSON.parse(item.payload) }))

    if (!_.isEqual(newEvents, oldEvents)) {
      console.info(`Deleting existing events for challenge ${challenge.id}`)
      await helper.deleteEventsInExecutor(oldEvents)
      console.info(`Creating events for challenge ${challenge.id}`)
      console.log('Events to be created:', JSON.stringify(newEvents))
      await helper.createEventsInExecutor(newEvents)
      console.info(`processing of the record completed, id: ${challenge.id}`)
    } else {
      console.info(`No need to update events for challenge ${challenge.id}`)
    }
    return
  }
  return
}

export const handlerReview = async (event, context, challengeId) => {
  let challenge, reviewDataFromDynamo
  if (event) {
    console.log('event:', JSON.stringify(event))
    try {
      const [data] = await helper.extractFromDynamoStreamEvent(event, 'submissionId')
      reviewDataFromDynamo = data
    } catch (e) {
      console.log('Could not extract required information')
      return
    }
    if (reviewDataFromDynamo.eventName !== EventNames.INSERT && reviewDataFromDynamo.eventName !== EventNames.MODIFY) {
      console.log(`Event ${reviewDataFromDynamo.eventName} is not supported`)
      return
    }
    console.log('data: ', JSON.stringify(reviewDataFromDynamo))
    const submission = await helper.getSubmissionById(reviewDataFromDynamo.submissionId)
    console.info(`Processing reviews for challenge ${submission.challengeId} by event`)
    challenge = await helper.getChallenge(submission.challengeId)
  } else if (challengeId) {
    console.info(`Processing reviews for challenge ${challengeId} by challenge ID`)
    challenge = await helper.getChallenge(challengeId)
  } else {
    return
  }
  const apEvents = []
  if (helper.isPhaseOpen(challenge, CheckpointScreeningPhase)) {
    const submissions = await helper.getChallengeSubmissions(challenge.id, SubmissionTypes.CHECKPOINT_SUBMISSION)
    const reviewsDone = await helper.checkIfAllSubmissionsReviewed(submissions, ReviewType.Screening)
    console.log(`reviews done: ${reviewsDone}`)
    if (reviewsDone) {
      if (helper.getPhase(challenge, CheckpointScreeningPhase)) {
        console.log('should schedule the close of the checkpoint screening phase')
        apEvents.push({
          phaseId: CheckpointScreeningPhase,
          isOpen: false,
          actualEndDate: Date.now()
        })
      }
      if (helper.getPhase(challenge, CheckpointReviewPhase)) {
        apEvents.push({
          phaseId: CheckpointReviewPhase,
          isOpen: true
        })
      }
    }
  } else if (helper.isPhaseOpen(challenge, CheckpointReviewPhase)) {
    const submissions = await helper.getChallengeSubmissions(challenge.id, SubmissionTypes.CHECKPOINT_SUBMISSION)
    const reviewsDone = await helper.checkIfAllSubmissionsReviewed(submissions, ReviewType.CheckpointReview)
    if (reviewsDone) {
      if (helper.getPhase(challenge, CheckpointReviewPhase)) {
        apEvents.push({
          phaseId: CheckpointReviewPhase,
          isOpen: false,
          actualEndDate: Date.now()
        })
      }
    }
  } else if (helper.isPhaseOpen(challenge, ScreeningPhase)) {
    const submissions = await helper.getChallengeSubmissions(challenge.id, SubmissionTypes.CONSTEST_SUBMISSION)
    const reviewsDone = await helper.checkIfAllSubmissionsReviewed(submissions, ReviewType.Screening)
    if (reviewsDone) {
      if (helper.getPhase(challenge, ScreeningPhase)) {
        apEvents.push({
          phaseId: ScreeningPhase,
          isOpen: false,
          actualEndDate: Date.now()
        })
      }
      if (helper.getPhase(challenge, ReviewPhase)) {
        apEvents.push({
          phaseId: ReviewPhase,
          isOpen: true
        })
      }
    }
  } else if (helper.isPhaseOpen(challenge, ReviewPhase)) {
    const submissions = await helper.getChallengeSubmissions(challenge.id, SubmissionTypes.CONSTEST_SUBMISSION)
    const reviewsDone = await helper.checkIfAllSubmissionsReviewed(submissions, ReviewType.Review)
    if (reviewsDone) {
      if (helper.getPhase(challenge, ReviewPhase)) {
        apEvents.push({
          phaseId: ReviewPhase,
          isOpen: false,
          actualEndDate: Date.now()
        })
      }
      if (helper.getPhase(challenge, ApprovalPhase)) {
        apEvents.push({
          phaseId: ApprovalPhase,
          isOpen: true
        })
      }
    }
  } else if (helper.isPhaseOpen(challenge, ApprovalPhase)) {
    const finalFix = await helper.getChallengeSubmissions(challenge.id, SubmissionTypes.FINAL_FIX)
    const reviewsDone = await helper.checkIfAllSubmissionsReviewed(finalFix, ReviewType.Approval)
    const submissions = await helper.getChallengeSubmissions(challenge.id, SubmissionTypes.CONSTEST_SUBMISSION)
    const checkpointSubmissions = await helper.getChallengeSubmissions(challenge.id, SubmissionTypes.CHECKPOINT_SUBMISSION)
    if (reviewsDone) {
      // Close challenge
      const winners = await helper.getChallengeWinners(submissions, checkpointSubmissions)
      let oldEvents = await helper.getEventsFromScheduleApi(challenge.id)
      oldEvents = _.map(oldEvents, item => ({ externalId: item.externalId, scheduleTime: item.scheduleTime, payload: JSON.parse(item.payload) }))
      await helper.deleteEventsInExecutor(oldEvents)
      await helper.createEventsInExecutor([
        {
          challengeId: challenge.id,
          externalId: `${challenge.id}-forced`, // those won't be deleted
          scheduleTime: Date.now(),
          payload: {
            status: ChallengeStatuses.COMPLETED,
            phases: [
              {
                phaseId: ApprovalPhase,
                isOpen: false,
                actualEndDate: Date.now()
              }
            ],
            winners
          }
        }
      ])
      return
    }
  }

  console.log('events to be created: ', JSON.stringify(apEvents))
  if (apEvents.length > 0) {
    let oldEvents = await helper.getEventsFromScheduleApi(challenge.id)
    oldEvents = _.map(oldEvents, item => ({ externalId: item.externalId, scheduleTime: item.scheduleTime, payload: JSON.parse(item.payload) }))
    await helper.deleteEventsInExecutor(oldEvents)
    // TODO: why not calling the API directly instead of scheduling the changes?
    await helper.createEventsInExecutor([{
      challengeId: challenge.id,
      externalId: `${challenge.id}-forced`, // those won't be deleted
      scheduleTime: Date.now(),
      payload: {
        phases: apEvents
      }
    }])
  }
  return
}

/* Responds to submission table insert/update - schedules phases */
export const handlerSubmission = async (event, context) => {
  // This will only process the first element of the array. If we use batches,
  // we'll have to modify this to loop through records
  const [challengeDataFromEvent] = await helper.extractFromDynamoStreamEvent(event, 'challengeId')
  const challenge = await helper.getChallenge(challengeDataFromEvent.challengeId)

  if (challenge.status !== ChallengeStatuses.ACTIVE || !_.get(challenge, 'legacy.pureV5')) {
    console.info(`The challenge ${challengeDataFromEvent.challengeId} is not Active or it's not pure V5. Skipping...`)
    return
  }
  const submissions = await helper.getChallengeSubmissions(challenge.id)

  // create events
  let newEvents = await helper.getEventsFromPhases(challenge, [], submissions)
  let oldEvents = await helper.getEventsFromScheduleApi(challenge.id)

  // use the scheduleTime and phases to check if there is any change
  newEvents = _.map(newEvents, item => ({ externalId: item.externalId, scheduleTime: item.scheduleTime, payload: item.payload }))
  oldEvents = _.map(oldEvents, item => ({ externalId: item.externalId, scheduleTime: item.scheduleTime, payload: JSON.parse(item.payload) }))

  if (!_.isEqual(newEvents, oldEvents)) {
    console.info(`Deleting existing events for challenge ${challenge.id}`)
    await helper.deleteEventsInExecutor(oldEvents)
    console.info(`Creating events for challenge ${challenge.id}`)
    console.log('Events to be created:', JSON.stringify(newEvents))
    await helper.createEventsInExecutor(newEvents)
    console.info(`processing of the record completed, id: ${challenge.id}`)
  } else {
    console.info(`No need to update events for challenge ${challenge.id}`)
  }
  return
}
