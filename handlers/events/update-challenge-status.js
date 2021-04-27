import Submission from '../../models/submission'
import SubmissionReview from '../../models/submission-review'
import Challenge, { ChallengeStatus } from '../../models/challenge'

/* Responds to reviews table insert event - updates challenge status */
export const handler = async (event, context) => {
  console.info({ event, context })

  const { challengeId } = event.detail.newImage

  // Get all submissions for this challenge
  const submissions = await Submission.query('challengeId')
    .eq(challengeId)
    .using('ChallengeIndex')
    .all()
    .exec()

  // Get review count for each submission
  const reviews = await Promise.all(
    submissions.map(async ({ id }) =>
      SubmissionReview.query('submissionId')
        .eq(id)
        .using('SubmissionIndex')
        .count()
        .exec()
    )
  )
  console.info({ reviews })
  const counts = reviews.map(({ count }) => count)

  // Check if every submission has at least two reviews
  if (counts.every(count => count >= 2)) {
    // Set challenge status to completed
    await Challenge.update(
      { id: challengeId },
      { status: ChallengeStatus.COMPLETED }
    )
  }
}
