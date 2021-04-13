import { DynamoDB } from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'

const dynamoDb = new DynamoDB.DocumentClient()

/* POST /challenges = create new challenge */
export const handler = async (event, context) => {
  // Get challenge name from request body
  const body = JSON.parse(event.body)
  const name = body && body.name

  // Create challenge object
  const challenge = {
    id: uuidv4(),
    name: name,
    numberOfSubmissions: 0
  }
  const values = {
    TableName: process.env.CHALLENGES_TABLE,
    Item: challenge
  }

  // Insert challenge into table
  try {
    await dynamoDb.put(values).promise()
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
