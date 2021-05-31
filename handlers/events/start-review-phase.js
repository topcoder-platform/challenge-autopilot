const _ = require('lodash');
const helper = require('../../common/helper');

/* Responds to submission table update - start review phase */
export const handler = async (event, context) => {
  if (event['detail-type'] && event['detail-type'] === 'MODIFY') {
    const submission = await helper.getSubmission(event.detail.newImage.id);
    const challenge = await helper.getChallenge(submission.challengeId);
    const allSubmissions = await helper.getAllSubmissions(challenge.id);

    let missingReview = _.some(allSubmissions, (submissionItem) => {
      return !submissionItem.review || submissionItem.review.length === 0;
    });

    if (!missingReview) {
      // close the screening phase
      let screeningPhase = _.find(challenge.phases, (phase) => phase.name === "Screening");
      await helper.updateChallengePhase(screeningPhase.phaseId, { isOpen: false } );

      // open the review phase
      let reviewPhase = _.find(challenge.phases, (phase) => phase.name === "Review");
      await helper.updateChallengePhase(reviewPhase.phaseId, { isOpen: true } );
    }
  }
  return;
}