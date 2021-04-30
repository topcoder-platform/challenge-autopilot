import Submission from '../../models/submission'

/* GET /challenges/:id/submissions = list challenges */
export const handler = async (event, context) => {
  console.info({ event, context })

  const { challengeId } = event.pathParameters

  if(!challengeId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: `Invalid request. Challenge UUID must be passed in as a path variable /challenges/:challengeId/submissions`
      })
    }
  }

  // Filter if status is provided, otherwise get all
  const submissions = 
    await Submission.query('challengeId')
      .eq(challengeId)
      .all()
      .exec()

  // Respond with challenges object
  return {
    statusCode: 200,
    body: JSON.stringify({
      submissions
    })
  }
}
