import AWSXRay from 'aws-xray-sdk'
import aws from 'aws-sdk'
import dynamoose from 'dynamoose'

dynamoose.AWS = AWSXRay.captureAWS(aws)
dynamoose.logger.providers.set(console)

export const ChallengeStatus = Object.freeze({
  SUBMISSION: 'submission',
  REVIEW: 'review',
  COMPLETED: 'completed'
})

const challengeSchema = new dynamoose.Schema({
  id: String,
  name: { type: String, required: true },
  numberOfSubmissions: { type: Number, required: true },
  status: {
    type: String,
    required: true,
    enum: Object.values(ChallengeStatus),
    default: ChallengeStatus.SUBMISSION,
    index: {
      name: 'StatusIndex',
      global: true
    }
  }
})

const challengeModel = dynamoose.model(
  process.env.CHALLENGES_TABLE,
  challengeSchema,
  { create: false, waitForActive: false }
)

challengeModel.methods.set(
  'exists',
  async id => !!(await challengeModel.get(id))
)

export default challengeModel
