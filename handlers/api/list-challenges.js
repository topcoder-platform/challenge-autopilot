import Challenge, { ChallengeStatus } from '../../models/challenge'

/* GET /challenges = list challenges */
export const handler = async (event, context) => {
  console.info({ event, context })

  // Get status from query string
  const { status } = event.queryStringParameters || {}

  // Validate status parameter
  if (status && !Object.values(ChallengeStatus).includes(status)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: `Invalid status parameter - must be one of ${Object.values(
          ChallengeStatus
        )}`
      })
    }
  }

  // Filter if status is provided, otherwise get all
  const challenges = status
    ? await Challenge.query('status')
      .eq(status)
      .using('StatusIndex')
      .all()
      .exec()
    : await Challenge.scan()
      .all()
      .exec()

  // Respond with challenges object
  return {
    statusCode: 200,
    body: JSON.stringify({
      challenges
    })
  }
}
