const OpenAI = require("openai");
require("dotenv").config();

class AIService {
  constructor() {
    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OpenAI API key is not configured");
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async generateNewsletterContent(articles) {
    try {
      const prompt = this.createPrompt(articles);

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a professional newsletter curator. Create a concise, engaging daily newsletter from the provided articles. Include brief summaries and maintain a consistent, professional tone.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        // timeout: 25000, // 25 second timeout
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error("AI Service Error:", error);
      throw new Error("Failed to generate newsletter content", error.message);
    }
  }

  createPrompt(articles) {
    // Group articles by feed
    const feedGroups = {};
    articles.forEach((article) => {
      const feedName = article.feedId.name;
      if (!feedGroups[feedName]) {
        feedGroups[feedName] = [];
      }
      feedGroups[feedName].push(article);
    });

    // Create prompt with organized content
    const articleTexts = Object.entries(feedGroups)
      .map(([feedName, feedArticles]) => {
        return `
        Source: ${feedName}
        ${feedArticles
          .map(
            (article) => `
        - Title: ${article.title}
        URL: ${article.url}
        Published: ${new Date(article.publishDate).toLocaleString()}
        Content: ${article.content?.substring(0, 300) || "No content available"}
        `
          )
          .join("\n")}
        ---`;
      })
      .join("\n");

    return `
        Please create a comprehensive newsletter combining news from multiple RSS feeds.

        Available Sources and Articles:
        ${articleTexts}

        Create a newsletter that:
        1. Highlights the most important stories across all feeds
        2. Groups related topics together regardless of source
        3. Provides context when similar stories appear in multiple feeds
        4. Includes a balanced representation from all sources
        5. Prioritizes the most recent and most significant stories

        Format the content with:
        1. A main headline (h1)
        2. An executive summary of the day's most important news
        3. Major stories with detailed coverage
        4. Quick hits for other notable stories
        5. Clear attribution to sources

        Use appropriate HTML tags (h1, h2, h3, p, ul, li, a) for formatting, but do not include any styling or HTML boilerplate.`;
  }
}

const aiService = new AIService();
module.exports = aiService;
