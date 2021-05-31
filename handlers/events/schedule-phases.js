const _ = require('lodash');
const helper = require('../../common/helper');

/* Responds to challenge table insert/update - schedules phases */
export const handler = async (event, context) => {
  const challenge = await helper.getChallenge(event.detail.newImage.id)
  if (challenge.status !== 'Active' || !_.get(challenge, 'legacy.pureV5')) {
    console.info(`Not creating events for challenge status ${challenge.status}...`)
    return;
  }
  if (challenge.status === 'Active' && _.get(challenge, 'legacy.pureV5')) {
    if (event['detail-type'] && event['detail-type'] === 'INSERT') {
      // create events
      const events = helper.getEventsFromPhases(challenge);
      // call the executor api
      await helper.createEventsInExecutor(events);
      console.info(`processing of the record completed, id: ${challenge.id}`)
      return;
    }
    if (event['detail-type'] && event['detail-type'] === 'MODIFY') {
      // create events
      const newEvents = helper.getEventsFromPhases(challenge);
      const oldEvents = await helper.getEventsFromScheduleApi(challenge.id)
      console.info(`Deleting existing events for challenge ${challenge.id}`)
      await helper.deleteEventsInExecutor(oldEvents)
      console.info(`Creating events for challenge ${challenge.id}`)
      await helper.createEventsInExecutor(newEvents)
      console.info(`processing of the record completed, id: ${challenge.id}`)
      return;
    }
  }
  return;
}