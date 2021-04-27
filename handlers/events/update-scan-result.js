import Submission from '../../models/submission'

/* Responds to PutObject event on submissions bucket - updates submissions table */
export const handler = async (event, context) => {
  console.info({ event, context })

  // Get filename and bucket name from event
  const { key, bucketName } = event.detail.requestParameters

  // Determine AV scan result based on S3 bucket
  const avScanPass = bucketName === process.env.SUBMISSIONS_BUCKET

  // Get the submission ID for this file
  const submission = await Submission.query('filename')
    .eq(key)
    .using('FilenameIndex')
    .limit(1)
    .exec()
  const submissionId = submission[0].id

  // Update table with scan result
  await Submission.update({ id: submissionId }, { avScanPass: avScanPass })
}
