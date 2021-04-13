import { DynamoDB } from 'aws-sdk'

const dynamoDb = new DynamoDB.DocumentClient()

/* Responds to submissions table avScanPass update event - increments submissions count */
export const handler = async (event, context) => {
  const { challengeId } = event.detail.newImage

  const values = {
    TableName: process.env.CHALLENGES_TABLE,
    Key: {
      id: challengeId
    },
    UpdateExpression: 'set numberOfSubmissions = numberOfSubmissions + :val',
    ExpressionAttributeValues: {
      ':val': 1
    }
  }
  await dynamoDb.update(values).promise()
}
