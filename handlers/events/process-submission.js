import { DynamoDB } from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'

const dynamoDb = new DynamoDB.DocumentClient()

/* Responds to PutObject event on DMZ bucket - adds to submissions table */
export const handler = async (event, context) => {
  // Get filename from event and extract attributes
  const filename = event.detail.requestParameters.key
  const regex = /(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})-(\w+)-(pass|fail).\w*/
  const [, challengeId] = filename.match(regex)

  // Create submission object
  const submission = {
    id: uuidv4(),
    filename: filename,
    challengeId: challengeId
    // avScanPass: null
  }

  // Insert submission into table
  const values = {
    TableName: process.env.SUBMISSIONS_TABLE,
    Item: submission
  }
  await dynamoDb.put(values).promise()

  return submission
}
