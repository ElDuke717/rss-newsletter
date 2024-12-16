const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const feedRoutes = require("./routes/feedRoutes");
const subscriberRoutes = require("./routes/subscriberRoutes");
const aiService = require("./services/aiService");
const Article = require("./models/Article");
const Feed = require("./models/Feed");
const path = require("path");

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Test route for configuration
app.get("/test-config", (req, res) => {
  res.json({
    port: process.env.PORT,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasMongoDB: !!process.env.MONGODB_URI,
    openAIKeyLength: process.env.OPENAI_API_KEY?.length,
  });
});

// Routes
app.use("/api/feeds", feedRoutes);
app.use("/api/subscribers", subscriberRoutes);

// Test AI route
app.post("/test-ai", async (req, res) => {
  try {
    const articles = await Article.find()
      .sort({ publishDate: -1 })
      .limit(5)
      .populate("feedId");

    const content = await aiService.generateNewsletterContent(articles);
    res.json({ content });
  } catch (error) {
    console.error("AI test error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Test route
app.get("/test", (req, res) => {
  res.json({ message: "Server is working" });
});

// Test route to check env variables
app.get("/test-env", (req, res) => {
  res.json({
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    keyLength: process.env.OPENAI_API_KEY?.length,
  });
});

app.get("/preview-newsletter", async (req, res) => {
  try {
    // Get articles from all feeds, sorted by publish date
    const articles = await Article.find()
      .populate("feedId")
      .sort({ publishDate: -1 }) // Most recent first
      .limit(10) // Adjust this number as needed
      .exec();

    console.log(`Found ${articles.length} articles from all feeds`);
    console.log("Feeds represented:", [
      ...new Set(articles.map((a) => a.feedId.name)),
    ]);

    let content = await aiService.generateNewsletterContent(articles);

    // Clean up markdown formatting
    content = content
      .replace(/```html/g, "")
      .replace(/`/g, "")
      .trim();

    const styledNewsletter = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Daily Newsletter</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #f5f5f5;
                    }
                    
                    .newsletter-container {
                        background-color: white;
                        padding: 30px;
                        border-radius: 8px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }

                    h1 {
                        color: #2c5282;
                        border-bottom: 2px solid #e2e8f0;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }

                    h2 {
                        color: #2d3748;
                        margin-top: 30px;
                    }

                    h3 {
                        color: #4a5568;
                    }

                    a {
                        color: #4299e1;
                        text-decoration: none;
                    }

                    a:hover {
                        text-decoration: underline;
                    }

                    ul {
                        padding-left: 20px;
                    }

                    li {
                        margin-bottom: 10px;
                    }

                    .highlight {
                        background-color: #f7fafc;
                        border-left: 4px solid #4299e1;
                        padding: 15px;
                        margin: 20px 0;
                    }

                    .footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #e2e8f0;
                        font-size: 0.9em;
                        color: #718096;
                    }
                </style>
            </head>
            <body>
                <div class="newsletter-container">
                    ${content}
                    <div class="footer">
                        <p>Generated with AI assistance • ${new Date().toLocaleDateString()}</p>
                        <p>Sources: ${[
                          ...new Set(articles.map((a) => a.feedId.name)),
                        ].join(", ")}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

    res.send(styledNewsletter);
  } catch (error) {
    console.error("Newsletter preview error:", error);
    res.status(500).send(`
            <html>
                <body>
                    <h1>Error Generating Newsletter</h1>
                    <p>${error.message}</p>
                </body>
            </html>
        `);
  }
});

// Diagnostic route
app.get("/api/diagnostic", async (req, res) => {
  try {
    // Get all feeds
    const feeds = await Feed.find().lean();
    console.log(`Found ${feeds.length} feeds`);

    // Get all articles with their feed information
    const articles = await Article.find().populate("feedId").lean();
    console.log(`Found ${articles.length} total articles`);

    const diagnostic = {
      totalFeeds: feeds.length,
      feeds: feeds.map((feed) => ({
        name: feed.name,
        url: feed.url,
        lastFetched: feed.lastFetched,
        _id: feed._id,
      })),
      totalArticles: articles.length,
      articlesByFeed: feeds.map((feed) => ({
        feedName: feed.name,
        articleCount: articles.filter(
          (a) => a.feedId && a.feedId._id.toString() === feed._id.toString()
        ).length,
      })),
      recentArticles: articles
        .sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate))
        .slice(0, 5)
        .map((a) => ({
          title: a.title,
          feed: a.feedId?.name || "Unknown Feed",
          publishDate: a.publishDate,
        })),
    };

    res.json(diagnostic);
  } catch (error) {
    console.error("Diagnostic error:", error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully");

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });
