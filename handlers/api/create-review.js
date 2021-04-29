import { v4 as uuidv4 } from 'uuid'

import Submission from '../../models/submission'
import SubmissionReview from '../../models/submission-review'

/* POST /submissions/{submissionId}/reviews = create new review */
export const handler = async (event, context) => {
  console.info({ event, context })

  // Get submission id from path
  const { submissionId } = event.pathParameters || {}
  const submission = await Submission.get(submissionId)

  // Check submission id is valid
  if (!submission) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Submission does not exist.'
      })
    }
  }

  const body = JSON.parse(event.body)

  // Create review object
  const review = new SubmissionReview({
    id: uuidv4(),
    challengeId: submission.challengeId,
    submissionId: submissionId,
    score: body.score,
    reviewerHandle: body.reviewerHandle,
    reviewerId: body.reviewerId
  })

  // Insert review into table
  try {
    await review.save()
    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Successfully created review.',
        item: review
      })
    }
  } catch (err) {
    console.error(err)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Unable to create review.'
      })
    }
  }
}
