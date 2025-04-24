import { TwitterApi } from 'twitter-api-v2';
import { createXai } from '@ai-sdk/xai';
import type { NextApiRequest, NextApiResponse } from 'next';

// Initialize clients
if (!process.env.X_BEARER_TOKEN) {
  throw new Error('X_BEARER_TOKEN environment variable is not set');
}
const twitterClient = new TwitterApi(process.env.X_BEARER_TOKEN as string);
const xaiClient = createXai({
  apiKey: process.env.XAI_API_KEY,
});

// Intent categories
const INTENT_CATEGORIES = ['food', 'sightseeing', 'lodging', 'events', 'transport', 'other'];

// Utility to handle rate limits
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchTweets(location: string, maxRetries = 3): Promise<import('twitter-api-v2').TweetV2[]> {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const query = `place:${location} -is:retweet lang:en`;
      const tweets = await twitterClient.v2.search({
        query,
        max_results: 10,
        'tweet.fields': ['text', 'id', 'created_at'],
      });

      const tweetData: import('twitter-api-v2').TweetV2[] = [];
      for await (const tweet of tweets) {
        tweetData.push(tweet);
      }
      return tweetData;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 429) {
        console.warn(`Rate limit hit, retrying (${retries + 1}/${maxRetries})...`);
        await delay(1000 * 2 ** retries); // Exponential backoff
        retries++;
      } else {
        const message = typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : String(error);
        throw new Error(`Failed to fetch tweets: ${message}`);
      }
    }
  }
  throw new Error('Max retries reached for fetching tweets');
}

async function classifyIntent(tweet: import('twitter-api-v2').TweetV2, location: string): Promise<string> {
  try {
    const response = await xaiClient.chat.arguments({
      model: 'grok-3-mini',
      messages: [
        {
          role: 'user',
          content: `
            You are an expert at understanding user queries related to locations. Classify the intent of this tweet into one of the following categories: ${INTENT_CATEGORIES.join(', ')}.
            If the intent is unclear, classify it as 'other'.
            Tweet: "${tweet.text}"
            Location: "${location}"
          `,
        },
      ],
      max_tokens: 50,
    });

    const intent = response.choices[0]?.message?.content?.trim().toLowerCase() || 'other';
    console.debug(`Classified intent for tweet ${tweet.id}: ${intent}`);
    return INTENT_CATEGORIES.includes(intent) ? intent : 'other';
  } catch (error) {
    const message = typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : String(error);
    console.error(`Intent classification failed: ${message}`);
    return 'other';
  }
}

async function generateResponse(tweet: import('twitter-api-v2').TweetV2, intent: string): Promise<string> {
  try {
    const response = await xaiClient.chat.arguments({
      model: 'grok-3-mini',
      messages: [
        {
          role: 'user',
          content: `
            You are a helpful assistant responding to a tweet about a location. Based on the tweet's intent (${intent}), generate a relevant question to engage the user.
            Tweet: "${tweet.text}"
            Intent: ${intent}
            Example: If intent is 'food', ask something like: "What's your favorite restaurant there?"
          `,
        },
      ],
      max_tokens: 50,
    });

    const responseText = response.choices[0]?.message?.content?.trim();
    if (!responseText) {
      throw new Error('Empty response from xAI API');
    }
    console.debug(`Generated response for tweet ${tweet.id}: ${responseText}`);
    return responseText;
  } catch (error) {
    const message = typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : String(error);
    console.error(`Response generation failed: ${message}`);
    return `What's cool about ${intent} in that place?`;
  }
}

async function replyToTweet(tweet: import('twitter-api-v2').TweetV2, response: string): Promise<void> {
  try {
    await twitterClient.v2.reply(response, tweet.id);
    console.log(`Replied to tweet ${tweet.id}: ${response}`);
  } catch (error) {
    const message = typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : String(error);
    console.error(`Failed to reply to tweet ${tweet.id}: ${message}`);
  }
}



export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { location } = req.query;

  // Validate input
  if (!location || typeof location !== 'string' || location.length < 2) {
    return res.status(400).json({ error: 'Valid location is required' });
  }

  try {
    // Fetch tweets
    const tweets = await fetchTweets(location);
    if (!tweets.length) {
      return res.status(404).json({ error: `No recent tweets found for ${location}` });
    }

    // Process tweets
    const results = await Promise.all(
      tweets.map(async (tweet) => {
        // Classify intent
        const intent = await classifyIntent(tweet, location);

        // Generate response
        const response = await generateResponse(tweet, intent);

        // Reply to tweet (skip if dry run or rate limits apply)
        if (process.env.DRY_RUN !== 'true') {
          await replyToTweet(tweet, response);
        }

        return { tweetId: tweet.id, intent, response };
      })
    );

    res.status(200).json({
      message: 'Processed tweets successfully',
      results,
      dryRun: process.env.DRY_RUN === 'true',
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      console.error(`Error in handler: ${(error as any).message}`);
    } else {
      console.error(`Error in handler: ${String(error)}`);
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}