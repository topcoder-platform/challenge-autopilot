const _ = require('lodash');
const helper = require('../../common/helper');

/* Responds to submission table update - start checkpoint review phase */
export const handler = async (event, context) => {
  if (event['detail-type'] && event['detail-type'] === 'MODIFY') {
    const submission = await helper.getSubmission(event.detail.newImage.id);
    const challenge = await helper.getChallenge(submission.challengeId);
    const allSubmissions = await helper.getAllSubmissions(challenge.id);
    const checkPointSubmissions = allSubmissions.filter((submission) => submission.type === 'CheckpointSubmission');

    let missingReview = _.some(checkPointSubmissions, (submissionItem) => {
      return !submissionItem.review || submissionItem.review.length === 0;
    });

    if (!missingReview) {
      // close the checkpoint screening phase
      let checkpointScreeningPhase = _.find(challenge.phases, (phase) => phase.name === "Checkpoint Screening");
      await helper.updateChallengePhase(checkpointScreeningPhase.phaseId, { isOpen: false } );

      // open the checkpoint review phase
      let checkpointReviewPhase = _.find(challenge.phases, (phase) => phase.name === "Checkpoint Review");
      await helper.updateChallengePhase(checkpointReviewPhase.phaseId, { isOpen: true } );
    }
  }
  return;
}