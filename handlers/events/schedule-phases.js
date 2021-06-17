const _ = require('lodash');
import helper from '../../common/helper';

/* Responds to challenge table insert/update - schedules phases */
export const handlerChallenge = async (event, context) => {
  const challenge = await helper.getChallenge(event.detail.newImage.id)
  if (challenge.status !== 'Active' || !_.get(challenge, 'legacy.pureV5Task')) {
    console.info(`Not creating events for challenge status ${challenge.status}...`)
    return;
  }
  if (challenge.status === 'Active' && _.get(challenge, 'legacy.pureV5Task')) {
    if (event['detail-type'] && event['detail-type'] === 'INSERT') {
      // create events
      const events = await helper.getEventsFromPhases(challenge, []);
      // call the executor api
      await helper.createEventsInExecutor(events);
      console.info(`processing of the record completed, id: ${challenge.id}`)
      return;
    }
    if (event['detail-type'] && event['detail-type'] === 'MODIFY') {
      // create events
      let newEvents = await helper.getEventsFromPhases(challenge, []);
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
      return;
    }
  }
  return;
}

/* Responds to challenge phases update - schedules phases */
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
    let newEvents = await helper.getEventsFromPhases(challenge, extrEvents);
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

export const handlerSubmission = async (event, context) => {
  console.log('event:', event)
  const submissionId = event.detail.newImage.id
  const challengeId = event.detail.newImage.challengeId
  return
}