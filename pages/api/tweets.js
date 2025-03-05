import { TwitterApi } from 'twitter-api-v2';
import AWS from 'aws-sdk';

const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
const bedrock = new AWS.Bedrock({
  apiVersion: '2019-11-24',
  region: 'us-west-2',
  credentials: new AWS.Credentials(process.env.AWS_ACCESS_KEY_ID, process.env.AWS_SECRET_ACCESS_KEY)
});

export default async function handler(req, res) {
  const { location } = req.query;

  if (!location) {
    return res.status(400).json({ error: 'Location is required' });
  }

  try {
    // Search for tweets about the location
    const tweets = await twitterClient.v2.search(`place:${location}`);

    // Use AWS Bedrock's Claude 3.7 Sonnet to understand the content of the tweets
    const tweetContents = tweets.data.map(tweet => tweet.text);
    const bedrockResponses = await Promise.all(tweetContents.map(async (content) => {
      const response = await bedrock.invokeModel({
        modelId: 'claude-3.7-sonnet',
        body: JSON.stringify({
          prompt: `Understand the following tweet and generate a response in the form of a question: ${content}`,
          maxTokens: 50
        })
      }).promise();
      return JSON.parse(response.body).choices[0].text.trim();
    }));

    // Classify the intent of the tweets
    const intents = await Promise.all(tweetContents.map(async (tweet) => {
      const intentResponse = await bedrock.invokeModel({
        modelId: 'claude-3.7-sonnet',
        body: JSON.stringify({
          prompt: `You are an expert at understanding user queries related to locations. Classify the intent of this tweet into one of the following categories: 'food', 'sightseeing', 'lodging', 'events', 'transport', 'other'. Tweet: "${tweet}" | Location: "${location}"`,
          maxTokens: 50
        })
      }).promise();
      return JSON.parse(intentResponse.body).choices[0].text.trim();
    }));

    // Reply to the tweets accordingly
    const replyPromises = tweets.data.map((tweet, index) => {
      return twitterClient.v2.reply(bedrockResponses[index], tweet.id);
    });
    await Promise.all(replyPromises);

    res.status(200).json({ message: 'Replies sent successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
