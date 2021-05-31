const _ = require('lodash');
const helper = require('../../common/helper');

/* Responds to challenge table update - start screening phase */
export const handler = async (event, context) => {
  if (event['detail-type'] && event['detail-type'] === 'MODIFY') {
    const challenge = await helper.getChallenge(event.detail.newImage.id)
    const allSubmissions = await helper.getAllSubmissions(event.detail.newImage.id);
    if (allSubmissions.length > 0) {
      let screeningPhase = _.find(challenge.phases, (phase) => phase.name === "Screening");
      if (screeningPhase && !screeningPhase.isOpen) {
        // open the challenge phase
        await helper.updateChallengePhase(screeningPhase.id, { isOpen: true } )
      }
    }
  }
  return;
}