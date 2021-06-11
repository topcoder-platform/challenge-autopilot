const _ = require('lodash');
import helper from '../../common/helper';

/* Responds to challenge table insert/update - schedules phases */
export const handler = async (event, context) => {
  const challenge = await helper.getChallenge(event.detail.newImage.id)
  if (challenge.status !== 'Active' || !_.get(challenge, 'legacy.pureV5Task')) {
    console.info(`Not creating events for challenge status ${challenge.status}...`)
    return;
  }
  if (challenge.status === 'Active' && _.get(challenge, 'legacy.pureV5Task')) {
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
      let newEvents = helper.getEventsFromPhases(challenge);
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
