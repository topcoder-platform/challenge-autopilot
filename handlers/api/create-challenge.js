import { v4 as uuidv4 } from 'uuid'

import Challenge, { ChallengeStatus } from '../../models/challenge'

/* POST /challenges = create new challenge */
export const handler = async (event, context) => {
  console.info({ event, context })

  // Get challenge name from request body
  const body = JSON.parse(event.body)
  const name = body && body.name

  // Create challenge object
  const challenge = new Challenge({
    id: uuidv4(),
    name: name,
    numberOfSubmissions: 0,
    status: ChallengeStatus.SUBMISSION
  })

  // Insert challenge into table
  try {
    await challenge.save()
    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Successfully created challenge.',
        item: challenge
      })
    }
  } catch (err) {
    console.error(err)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Unable to create challenge.'
      })
    }
  }
}
