import AWSXRay from 'aws-xray-sdk'
import aws from 'aws-sdk'
import dynamoose from 'dynamoose'

import Challenge from './challenge'
import Submission from './submission'

dynamoose.AWS = AWSXRay.captureAWS(aws)
dynamoose.logger.providers.set(console)

const submissionReviewSchema = new dynamoose.Schema({
  id: String,
  challengeId: {
    type: Challenge,
    required: true,
    validate: async val => await Challenge.exists(val)
  },
  submissionId: {
    type: Submission,
    required: true,
    validate: async val => await Submission.exists(val),
    index: {
      name: 'SubmissionIndex',
      global: true
    }
  },
  score: {
    type: Number,
    required: true,
    validate: val => val >= 0 && val <= 100
  },
  reviewerHandle: { type: String, required: true },
  reviewerId: { type: String, required: true }
})

const submissionReviewModel = dynamoose.model(
  process.env.SUBMISSION_REVIEWS_TABLE,
  submissionReviewSchema,
  { create: false, waitForActive: false }
)

export default submissionReviewModel
