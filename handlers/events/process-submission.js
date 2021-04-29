import { v4 as uuidv4 } from 'uuid'

import Submission from '../../models/submission'

/* Responds to PutObject event on DMZ bucket - adds to submissions table */
export const handler = async (event, context) => {
  console.info({ event, context })

  // Get filename from event and extract attributes
  const filename = event.detail.requestParameters.key
  const regex = /(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})-(\w+)-(pass|fail).\w*/
  const [, challengeId] = filename.match(regex)

  // Create submission object
  const submission = new Submission({
    id: uuidv4(),
    filename: filename,
    challengeId: challengeId
  })

  // Insert submission into table
  await submission.save()

  return submission
}
