import { TwitterApi } from 'twitter-api-v2';
import { Configuration, OpenAIApi } from 'openai';

const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
}));

export default async function handler(req, res) {
  const { location } = req.query;

  if (!location) {
    return res.status(400).json({ error: 'Location is required' });
  }

  try {
    // Search for tweets about the location
    const tweets = await twitterClient.v2.search(`place:${location}`);

    // Use OpenAI GPT-3 to understand the content of the tweets
    const tweetContents = tweets.data.map(tweet => tweet.text);
    const gpt3Responses = await Promise.all(tweetContents.map(async (content) => {
      const response = await openai.createCompletion({
        model: 'text-davinci-002',
        prompt: `Understand the following tweet and generate a response: ${content}`,
        max_tokens: 50,
      });
      return response.data.choices[0].text.trim();
    }));

    // Classify the intent of the tweets
    const intents = await Promise.all(tweetContents.map(async (tweet) => {
      const intentResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: "You are an expert at understanding user queries related to locations. Classify the intent of this tweet into one of the following categories: 'food', 'sightseeing', 'lodging', 'events', 'transport', 'other'." },
          { role: "user", content: `Tweet: "${tweet}" | Location: "${location}"` }
        ]
      });
      return intentResponse.choices[0].message.content.trim();
    }));

    // Reply to the tweets accordingly
    const replyPromises = tweets.data.map((tweet, index) => {
      return twitterClient.v2.reply(gpt3Responses[index], tweet.id);
    });
    await Promise.all(replyPromises);

    res.status(200).json({ message: 'Replies sent successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
