# Topcoder EventBridge PoC

<img src="./docs/images/diagram.png" width="500px" />

Proof of concept application that processes challenge file submissions using AWS EventBridge.

## Install and deploy

- Requires [Node/NPM](https://nodejs.org/en/download/) and [Serverless Framework CLI](https://www.serverless.com/framework/docs/getting-started/) to be installed. Credentials for your AWS account will also need to be [configured](https://www.serverless.com/framework/docs/providers/aws/guide/credentials/).
- Set necessary environment variables (see table below):
  - _S3 bucket names need to be globally unique._
  - _`CREATE_CLOUDTRAIL` should be set to `true` unless CloudTrail is already set up in the account._
- Install dependencies:
  - `npm install`
- Deploy to AWS:
  - `serverless deploy`
- Take note of the API Gateway endpoint shown once deployed (e.g `https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev`).
- Open Postman collection and update `endpoint` variable to the API Gateway endpoint.

## Testing the application

### Create Challenge Flow
- Create a challenge - either:
  - Run the "New Challenge" request in Postman, or
  - `curl https://<REPLACEME>.execute-api.us-east-1.amazonaws.com/dev/eventbridge-poc-challenges -H 'Content-Type: application/json' --data '{"name": "Test Challenge"}'`

### Submission Flow
- Take note of the ID of the challenge, and create a zip file to upload with the filename format: `<challenge_id>-<name>-<pass/fail>.zip`:
  - e.g. `touch xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-test-pass.zip`
- Upload the file to the DMZ bucket:
  - e.g. `aws s3 cp xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-test-pass.zip s3://topcoder-eventbridge-poc-submissions-dmz`
- Verify the submission has been created:
  - e.g. `aws dynamodb scan --table-name=submissions --region=us-east-1`
  - _It might take a minute for the submission to appear._
- Verify the submitted file has been moved to the appropriate bucket:
  - e.g. `aws s3 ls s3://topcoder-eventbridge-poc-submissions` or `aws s3 ls s3://topcoder-eventbridge-poc-submissions-quarantine`
  - _The file should be in the submissions bucket if the anti-virus scan passed, or in the quarantine bucket if it failed._
- Verify the anti-virus result is correct:
  - Re-run `aws dynamodb scan --table-name=submissions --region=us-east-1` until the `avScanPass` attribute is `true` or `false`.
  - _The result should match the final part of the filename - `-pass.zip` = `true` / `-fail.zip` = `false`._
- Verify the `numberOfSubmissions` attribute on the challenge has been incremented:
  - e.g. `aws dynamodb scan --table-name=challenges --region=us-east-1`

### Review Flow
- Create a review for a submission - either:
  - Run the "New Review" request in Postman, or
  - ```
    curl https://<REPLACEME>.execute-api.us-east-1.amazonaws.com/dev/eventbridge-poc-submissions/<REPLACEME>/reviews \
    -H 'Content-Type: application/json' \
    --data '{"score": 85.5, "reviewerHandle": "Reviewer", "reviewerId": "6b53e767-e480-4c1e-b839-18074fb751fd"}'
    ```
- Repeat the above until each submission in a challenge has at least two reviews.
- Verify the challenge status has changed to `completed` - either:
  - Run the "List Challenges - Completed" request in Postman, or
  - `curl https://REPLACEME.execute-api.us-east-1.amazonaws.com/dev/eventbridge-poc-challenges\?status\=completed`


## Using ServiceLens
- The application is instrumented with AWS X-Ray, which allows each API Gateway request and Lambda function invocation to be traced.
- This can be viewed through the Service Map or Traces in the ServiceLens section of CloudWatch.
- The Service Map gives a visual overview of the whole application and how its different parts interact, allowing for errors to be quickly located.
- Traces shows every invocation and can be filtered on various criteria. It can be helpful to narrow down the timeframe and status to find the trace you want.
- In addition, API Gateway responses contain an `X-Amzn-Trace-Id` header which you can use to search for the trace for that request.
- It may take a few minutes after a request or invocation for the logs to be available.

### Locating an error
#### API Gateway
- If you are receiving an error response from API Gateway, you may be able to find out more detail in the trace.
- Copy the `X-Amzn-Trace-Id` header (omitting `Root=`) in the response and paste it into the search box in the Traces section.
- You should then be able to see the entire trace for this request. Clicking on the subsections gives extra information about them, and may reveal the error.
- Alternatively, at the bottom of the page are the logs for all the services involved in the request. Expanding these is likely to help locate an error message.
- Common errors may be found in the `Request parameter validation failed` and `Method response...` logs.

#### EventBridge triggered Lambda
- A Lambda function that is producing errors will appear with a red or orange ring in the Service Map. You can click on it and click `View Traces` to see what the issue is.
- Clicking on the trace that has an error allows you to view the subsections and logs for the invocation.
- Errors that are thrown might include a stack trace which allows you to locate the point in the code that is causing the issue.

### Diagnosing unexpected behaviour
- It can be more difficult to diagnose a service that is not behaving as expected, but is not throwing any errors.
- In the first instance, you should wait a few minutes as sometimes EventBridge events are not sent immediately.
- It might also be a temporary error - EventBridge will retry most events in this case, which can be seen within the trace.
- The next step is to locate the Lambda that is causing the issue. A good place to start is sorting the traces by timestamp and looking at the latest ones.
- The Lambda functions are configured to log helpful information including the details of the event that triggered them and any DynamoDB requests they make.
- This should give some insight into the operations being performed by the function and where the issue might be.

### Common issues
#### Submission file not processed
- Check the filename is in the correct format and the challenge ID is valid.
- An invalid challenge ID will produce a `ValidationError` which can be seen in the trace for the `processSubmission` invocation.

#### File moved to incorrect bucket
- Check the `<pass/fail>` section of the filename - anything other than `pass` will cause the file to be moved to the quarantine bucket.
- The `avScan` Lambda logs the `destinationBucket` for the file, and it can also be seen in the Trace Map at the top of the trace page.

#### Submissions count not incremented
- Check the AV scan result - only submissions that pass will cause the submissions count to be incremented.
- In addition, only unique filenames will be counted as a new submission and increment the count.

#### Challenge/Review not created
- Ensure you have provided a valid submission ID within the URL.
- Check the request body is in the correct format. You may receive an `Invalid request body` error message.
- More detail on the specific error can be found within the trace logs by searching for the `X-Amzn-Trace-Id`.

## Remove deployment

- When you are finished, you can remove all of the provisioned resources from your AWS account by running:
  - `serverless remove`
  - _If there are objects remaining in the S3 buckets, these will need to manually be removed before the bucket can be deleted._

## Environment variables

| Variable name                 | Description                                                                         |
|-------------------------------|-------------------------------------------------------------------------------------|
| SUBMISSIONS_BUCKET            | The name of the S3 bucket to store submission files that pass the AV scan.          |
| SUBMISSIONS_DMZ_BUCKET        | The name of the S3 bucket to store submission files that have not been scanned yet. |
| SUBMISSIONS_QUARANTINE_BUCKET | The name of the S3 bucket to store submission files that fail the AV scan.          |
| CLOUDTRAIL_LOGS_BUCKET        | The name of the S3 bucket to store CloudTrail logs.                                 |
| CHALLENGES_TABLE              | The name of the DynamoDB table to hold challenges.                                  |
| SUBMISSIONS_TABLE             | The name of the DynamoDB table to hold submissions.                                 |
| SUBMISSION_REVIEWS_TABLE      | The name of the DynamoDB table to hold submission reviews.                          |
| CREATE_CLOUDTRAIL             | Boolean - whether or not to create the CloudTrail resources.                        |

## Project structure

- `/docs` - Documentation/Postman files
- `/handlers`
  - `/api`
    - `*.js` - Lambda function handlers for API Gateway routes
  - `/events`
    - `*.js` - Lambda function handlers for EventBridge events
- `/models`
    - `*.js` - Dynamoose models
- `/schema`
  - `*.json` - API Gateway validation models
- `serverless.yml` - Main Serverless Framework configuration file

## Notes

- CloudTrail only supports sending events directly to the `default` bus in EventBridge.
- DynamoDB does not support sending events directly to EventBridge.
  - As a solution, the [DynamoDB to EventBridge plugin](https://github.com/theburningmonk/serverless-dynamodb-to-eventbridge-plugin) is used here, which uses [DynamoDB Streams](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html) to trigger a Lambda that forwards events to EventBridge.
  - An alternative would be to send an [EventBridge custom event](https://docs.aws.amazon.com/eventbridge/latest/APIReference/API_PutEvents.html) after writing to the database.
