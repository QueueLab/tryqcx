# Next.js AI SDK Vercel Server Function

This repository contains a Next.js API route that uses the Twitter API and AWS Bedrock's Claude 3.7 Sonnet to search for tweets about a specific location, understand the content of the tweets, and reply accordingly.

## Setup

### Twitter API

1. Create a Twitter Developer account and create a new project.
2. Generate the necessary API keys and tokens.
3. Set the `TWITTER_BEARER_TOKEN` environment variable with your Twitter Bearer Token.

### AWS Bedrock Claude 3.7 Sonnet

1. Create an AWS account and generate the necessary credentials.
2. Set the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables with your AWS credentials.

## Deployment

To deploy the function on Vercel:

1. Install the Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the root directory of your project.
3. Follow the prompts to deploy your project.
4. Set the necessary environment variables in the Vercel dashboard.
