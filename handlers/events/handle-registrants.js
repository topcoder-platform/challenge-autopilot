import helper from "../../common/helper"
import {
  SUBMITTER_RESOURCE_ROLE_ID,
  ChallengeStatuses,
  RegistrationPhase,
  EventNames,
  REGISTRATION_PHASE_EXTENSION_HOURS,
  SUBMISSION_PHASE_EXTENSION_HOURS,
  SubmissionPhase
} from "../../app-constants"
import _ from "lodash"

const moment = require('moment')

/**
 * Responds to resource insert/delete events
 *
 * @param {Object} event The received event
 * @param {Object} context The event context
 */
export const registrantsHandler = async (event, context) => {
  // This will only process the first element of the array. If we use batches,
  // we'll have to modify this to loop through records

  // Get the event name from the event data
  const eventName = _.get(event, 'Records')[0].eventName

  // Identify from which image to get the data based on the event name 'NewImage' (for INSERT) or 'OldImage' (for REMOVE)
  const image = eventName === EventNames.REMOVE ? 'OldImage' : 'NewImage'

  let challengeDataFromEvent
  let resourceRoleDataFromEvent
  try {
    const [_resourceRoleDataFromEvent] = await helper.extractFromDynamoStreamEvent(event,'roleId', image)
    resourceRoleDataFromEvent = _resourceRoleDataFromEvent

    // check if the resource is a submitter
    // We do this check first before getting the challenge data to prevent making useless calls to challenge API
    if(resourceRoleDataFromEvent.roleId === SUBMITTER_RESOURCE_ROLE_ID) {
      const [_challengeDataFromEvent] = await helper.extractFromDynamoStreamEvent(event, 'challengeId', image)
      challengeDataFromEvent = _challengeDataFromEvent
    } else {
      // If the resource is not a submitter, ignore the event and return
      console.info(`The resource ${resourceRoleDataFromEvent.roleId} is not a submitter, Skipping...`)
      return
    }
  } catch (e) {
    console.log('Could not extract required information')
    return
  }

  // Get the challenge information from the Challenge API
  const challenge = await helper.getChallenge(challengeDataFromEvent.challengeId)

  if (challenge.status !== ChallengeStatuses.ACTIVE || !_.get(challenge, 'legacy.pureV5')) {
    console.info(`The challenge ${challengeDataFromEvent.challengeId} is not Active or it's not pure V5. Skipping...`)
    return
  }

  // Get the challenge task information
  const challengeTaskInformation = _.get(challenge, 'task', { isTask: false })

  if (!challengeTaskInformation.isTask) { // If it is not a task, we ignore it
    // log the info and ignore the challenge
    console.info(`The challenge ${challengeDataFromEvent.challengeId} is not a task. Skipping...`)
  } else {
    let registrationPhase = await helper.getPhase(challenge, RegistrationPhase)

    // Get the memberId from the event
    const [memberDataFromEvent] = await helper.extractFromDynamoStreamEvent(event,'memberId', image)

    // Initialize the array of the challenges phases to update
    const phases = []

    switch(eventName) {
      case EventNames.INSERT: { // New registrant is added
        // Assign the task to the member
        challengeTaskInformation.isAssigned = true
        challengeTaskInformation.memberId = memberDataFromEvent.memberId
        break
      }
      case EventNames.REMOVE: { // A registrant is removed
        // Reopen the registration phase
        registrationPhase.isOpen = true

        // extend the registration phase by the configured value
        registrationPhase.scheduledEndDate = moment(new Date()).add(REGISTRATION_PHASE_EXTENSION_HOURS, 'hours').toDate()
        registrationPhase.duration += REGISTRATION_PHASE_EXTENSION_HOURS * 3600
        registrationPhase.actualEndDate = null

        // Add the updated registration phase to the phases to patch
        phases.push(registrationPhase)

        // Check if the new registration end date is after the submission end date
        let submissionPhase = await helper.getPhase(challenge, SubmissionPhase)
        if(moment(registrationPhase.scheduledEndDate).isAfter(moment(submissionPhase.scheduledEndDate))) {
          // Extend the submission phase by the configured value
          submissionPhase.scheduledEndDate = moment(new Date()).add(SUBMISSION_PHASE_EXTENSION_HOURS, 'hours').toDate()
          submissionPhase.duration += SUBMISSION_PHASE_EXTENSION_HOURS * 3600
          submissionPhase.actualEndDate = null

          submissionPhase.isOpen = true

          // Add the updated submission phase to the phases to patch
          phases.push(submissionPhase)
        }

        // Remove the member assignment
        challengeTaskInformation.isAssigned = false
        challengeTaskInformation.memberId = null
        break
      }
      default: console.info(`Unsupported event ${challengeDataFromEvent.eventName}, Skipping...`)
    }

    // Update the task information
    const token = await helper.getTopcoderM2Mtoken()

    // Patch the challenge with the updated task information and updated phases
    await helper.patchRequest(`${process.env.CHALLENGE_API_URL}/${challenge.id}`, {
      ...(phases.length === 0 ? {} : { phases }),
      task: { ...challengeTaskInformation }
    }, token)

    console.info(`Successfully handled ${eventName} Resource with id ${memberDataFromEvent.memberId} for challenge ${challengeDataFromEvent.challengeId}`)
  }
}
