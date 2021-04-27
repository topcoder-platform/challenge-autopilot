import Challenge from '../../models/challenge'

/* Responds to submissions table avScanPass update event - increments submissions count */
export const handler = async (event, context) => {
  console.info({ event, context })

  const { challengeId } = event.detail.newImage

  await Challenge.update(
    { id: challengeId },
    { $ADD: { numberOfSubmissions: 1 } }
  )
}
