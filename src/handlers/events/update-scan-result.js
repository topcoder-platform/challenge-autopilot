import { DynamoDB } from 'aws-sdk'

const dynamoDb = new DynamoDB.DocumentClient()

/* Responds to PutObject event on submissions bucket - updates submissions table */
export const handler = async (event, context) => {
  // Get filename and bucket name from event
  const { key, bucketName } = event.detail.requestParameters

  // Determine AV scan result based on S3 bucket
  const avScanPass = bucketName === process.env.SUBMISSIONS_BUCKET

  // Get the submission ID for this file
  const res = await dynamoDb.query({
    TableName: process.env.SUBMISSIONS_TABLE,
    IndexName: 'FilenameIndex',
    KeyConditionExpression: 'filename = :filename',
    Limit: 1,
    ExpressionAttributeValues: {
      ':filename': key
    }
  }).promise()
  const submissionId = res.Items[0].id

  // Update table with scan result
  const values = {
    TableName: process.env.SUBMISSIONS_TABLE,
    Key: {
      id: submissionId
    },
    UpdateExpression: 'set avScanPass = :avScanPass',
    ExpressionAttributeValues: {
      ':avScanPass': avScanPass
    }
  }
  await dynamoDb.update(values).promise()
}
