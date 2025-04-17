import { TwitterApi } from 'twitter-api-v2';
import { XAIClient } from '@xai/grok-sdk'; // Hypothetical XAI SDK

const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
const xaiClient = new XAIClient({
  apiKey: process.env.XAI_API_KEY,
  model: 'grok-3-mini'
});

export default async function handler(req, res) {
  const { location } = req.query;

  if (!location) {
    return res.status(400).json({ error: 'Location is required' });
  }

  try {
    // Search for tweets about the location
    const tweets = await twitterClient.v2.search(`place:${location}`);

    // Use XAI Grok-3-Mini to understand the content of the tweets
    const tweetContents = tweets.data.map(tweet => tweet.text);
    const grokResponses = await Promise.all(tweetContents.map(async (content) => {
      const response = await xaiClient.completions.create({
        model: 'grok-3-mini',
        prompt: `Understand the following tweet and generate a response in the form of a question: ${content}`,
        max_tokens: 50
      });
      return response.choices[0].text.trim();
    }));

    // Classify the intent of the tweets
    const intents = await Promise.all(tweetContents.map(async (tweet) => {
      const intentResponse = await xaiClient.completions.create({
        model: 'grok-3-mini',
        prompt: `You are an expert at understanding user queries related to locations. Classify the intent of this tweet into one of the following categories: 'food', 'sightseeing', 'lodging', 'events', 'transport', 'other'. Tweet: "${tweet}" | Location: "${location}"`,
        max_tokens: 50
      });
      return intentResponse.choices[0].text.trim();
    }));

    // Reply to the tweets accordingly
    const replyPromises = tweets.data.map((tweet, index) => {
      return twitterClient.v2.reply(grokResponses[index], tweet.id);
    });
    await Promise.all(replyPromises);

    res.status(200).json({ message: 'Replies sent successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
