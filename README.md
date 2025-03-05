# Next.js AI SDK Vercel Server Function

This repository contains a Next.js API route that uses the Twitter API and OpenAI's GPT-3 to search for tweets about a specific location, understand the content of the tweets, and reply accordingly.

## Setup

### Twitter API

1. Create a Twitter Developer account and create a new project.
2. Generate the necessary API keys and tokens.
3. Set the `TWITTER_BEARER_TOKEN` environment variable with your Twitter Bearer Token.

### OpenAI GPT-3

1. Create an OpenAI account and generate an API key.
2. Set the `OPENAI_API_KEY` environment variable with your OpenAI API key.

## Deployment

To deploy the function on Vercel:

1. Install the Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the root directory of your project.
3. Follow the prompts to deploy your project.
4. Set the necessary environment variables in the Vercel dashboard.
