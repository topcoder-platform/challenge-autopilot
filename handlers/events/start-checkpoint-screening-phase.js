const _ = require('lodash');
const helper = require('../../common/helper');

/* Responds to challenge table update - start checkpoint screening phase */
export const handler = async (event, context) => {
  if (event['detail-type'] && event['detail-type'] === 'MODIFY') {
    const challenge = await helper.getChallenge(event.detail.newImage.id)
    const allSubmissions = await helper.getAllSubmissions(event.detail.newImage.id);
    const checkPointSubmissions = allSubmissions.filter((submission) => submission.type === 'CheckpointSubmission');
    if (checkPointSubmissions.length > 0) {
      let checkpointScreeningPhase = _.find(challenge.phases, (phase) => phase.name === "Checkpoint Screening");
      if (!checkpointScreeningPhase.isOpen) {
        await helper.updateChallengePhase(checkpointScreeningPhase.phaseId, { isOpen: true } );
      }
    }
  }
  return;
}