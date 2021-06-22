const _ = require('lodash')

/**
 * App constants
 */
export const RegistrationPhase = 'a93544bc-c165-4af4-b55e-18f3593b457a'
export const SubmissionPhase = '6950164f-3c5e-4bdc-abc8-22aaf5a1bd49'
export const CheckpointSubmissionPhase = 'd8a2cdbe-84d1-4687-ab75-78a6a7efdcc8'
export const CheckpointScreeningPhase = 'ce1afb4c-74f9-496b-9e4b-087ae73ab032'
export const CheckpointReviewPhase= '84b43897-2aab-44d6-a95a-42c433657eed'
export const ScreeningPhase = '2d7d3d85-0b29-4989-b3b4-be7f2b1d0aa6'
export const ReviewPhase = 'aa5a3f78-79e0-4bf7-93ff-b11e8f5b398b'
export const FinalFixPhase = '3e2afca6-9542-4763-a135-96b33f12c082'
export const ApprovalPhase = 'ad985cff-ad3e-44de-b54e-3992505ba0ae'

export const ReviewType = {
  Screening: 'c56a4180-65aa-42ec-a945-5fd21dec0501',
  CheckpointReview: 'c56a4180-65aa-42ec-a945-5fd21dec0502',
  Review: 'c56a4180-65aa-42ec-a945-5fd21dec0503',
  AppealsResponse: 'c56a4180-65aa-42ec-a945-5fd21dec0504',
  IterativeReview: 'c56a4180-65aa-42ec-a945-5fd21dec0505',
  FinalFix: '9ecc88e5-a4ee-44a4-8ec1-70bd98022510',
  Approval: 'd6d31f34-8ee5-4589-ae65-45652fcc01a6'
}

export const SubmissionTypes = {
  CONSTEST_SUBMISSION: 'Contest Submission',
  CHECKPOINT_SUBMISSION: 'Checkpoint Submission',
  FINAL_FIX: 'Final Fix Submission'
}

export const EventPhaseIDs = {
  [RegistrationPhase]: {
    open: true,
    close: true
  },
  [SubmissionPhase]: {
    open: true,
    close: true
  },
  [CheckpointSubmissionPhase]: {
    open: true,
    close: true
  },
  [CheckpointScreeningPhase]: {
    open: true,
    checkPrerequisites: (challenge, submissions) => {
      const existingPhase = _.find(_.get(challenge, 'phases'), p => p.phaseId === CheckpointScreeningPhase)
      if (!existingPhase || existingPhase.actualEndDate) return false
      return !!_.find(submissions, s => s.type === SubmissionTypes.CHECKPOINT_SUBMISSION)
    }
  },
  [ScreeningPhase]: {
    open: true,
    checkPrerequisites: (challenge, submissions) => {
      const existingPhase = _.find(_.get(challenge, 'phases'), p => p.phaseId === ScreeningPhase)
      if (!existingPhase || existingPhase.actualEndDate) return false
      return !!_.find(submissions, s => s.type === SubmissionTypes.CONSTEST_SUBMISSION)
    }
  }
}

export const EventSources = {
  DynamoDB: 'aws:dynamodb'
}

export const EventNames = {
  INSERT: 'INSERT',
  MODIFY: 'MODIFY'
}

export const ChallengeStatuses = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed'
}

export const PrizeTypes = {
  PLACEMENT: 'placement',
  CHECKPOINT: 'checkpoint',
}