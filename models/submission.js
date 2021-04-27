import AWSXRay from 'aws-xray-sdk'
import aws from 'aws-sdk'
import dynamoose from 'dynamoose'

import Challenge from './challenge'

dynamoose.AWS = AWSXRay.captureAWS(aws)
dynamoose.logger.providers.set(console)

const submissionSchema = new dynamoose.Schema({
  id: String,
  filename: {
    type: String,
    required: true,
    index: {
      name: 'FilenameIndex',
      global: true
    }
  },
  challengeId: {
    type: Challenge,
    required: true,
    validate: async val => await Challenge.exists(val),
    index: {
      name: 'ChallengeIndex',
      global: true
    }
  },
  avScanPass: Boolean
})

const submissionModel = dynamoose.model(
  process.env.SUBMISSIONS_TABLE,
  submissionSchema,
  { create: false, waitForActive: false }
)

submissionModel.methods.set(
  'exists',
  async id => !!(await submissionModel.get(id))
)

export default submissionModel
