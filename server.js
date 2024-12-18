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

// Create cached connection variable
let cachedDb = null;

// Connection wrapper function
const withDB = async (callback) => {
  try {
    if (!cachedDb) {
      cachedDb = await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        bufferCommands: true, // Changed from false to true
        serverSelectionTimeoutMS: 5000,
      });
      console.log("New database connection established");
    }
    return await callback();
  } catch (error) {
    console.error("Database operation error:", error);
    throw error;
  }
};

// Add connection status endpoint
app.get("/api/connection-test", async (req, res) => {
  try {
    await withDB(async () => {
      const connectionState = mongoose.connection.readyState;
      const stateMap = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting",
      };

      return {
        status: "success",
        connectionState: stateMap[connectionState],
        numericState: connectionState,
        mongodbUri: process.env.MONGODB_URI ? "URI is set" : "URI is missing",
        databaseName: mongoose.connection.name || "not connected",
      };
    });

    res.json(await withDB(() => ({ message: "Connection test successful" })));
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// System status endpoint
app.get("/api/system-status", async (req, res) => {
  try {
    const status = await withDB(async () => ({
      mongoConnected: mongoose.connection.readyState === 1,
      mongoState: mongoose.connection.readyState,
      environment: process.env.NODE_ENV,
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasMongoDB: !!process.env.MONGODB_URI,
      mongoQueryTest: (await Feed.findOne().select("_id")) ? true : false,
    }));

    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: "System status check failed",
      details: error.message,
    });
  }
});

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
    const articles = await withDB(async () => {
      return Article.find()
        .sort({ publishDate: -1 })
        .limit(5)
        .populate("feedId");
    });

    const content = await aiService.generateNewsletterContent(articles);
    res.json({ content });
  } catch (error) {
    console.error("AI test error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch articles route
app.post("/api/fetch-articles", async (req, res) => {
  try {
    const result = await withDB(async () => {
      const feeds = await Feed.find();
      console.log(`Found ${feeds.length} feeds to fetch`);

      const feedService = require("./services/feedService");
      await feedService.fetchAllFeeds();

      return { feedCount: feeds.length };
    });

    res.json({
      message: "Articles fetched successfully",
      feedsProcessed: result.feedCount,
    });
  } catch (error) {
    console.error("Error fetching articles:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/preview-newsletter", async (req, res) => {
  try {
    console.log("Preview newsletter route hit");

    // Get articles from all feeds, sorted by publish date
    const articles = await Article.find()
      .populate("feedId")
      .sort({ publishDate: -1 })
      .limit(5)
      .lean()
      .exec();

    console.log(`Found ${articles.length} articles from all feeds`);

    if (articles.length === 0) {
      return res.send(`
        <html>
          <body>
            <h1>No Articles Found</h1>
            <p>The database is connected but no articles were found. Please make sure:</p>
            <ol>
              <li>Feeds have been added</li>
              <li>Articles have been fetched from the feeds</li>
            </ol>
            <p>Database status:</p>
            <pre>MongoDB State: ${mongoose.connection.readyState}</pre>
          </body>
        </html>
      `);
    }

    // Add timeout to OpenAI call
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI API timeout')), 25000)
    );

    let content = await Promise.race([contentPromise, timeoutPromise]);

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
                    }l
                    
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
    res.status(error.message === 'OpenAI API timeout' ? 503 : 500).send(`
      <html>
        <body>
          <h1>Error Generating Newsletter</h1>
          <p>Error: ${error.message}</p>
          ${process.env.NODE_ENV === 'development' ? `<p>Stack: ${error.stack}</p>` : ''}
          <p>MongoDB State: ${mongoose.connection.readyState}</p>
          <p>Try refreshing the page or <a href="/api/diagnostic">check system status</a>.</p>
        </body>
      </html>
    `);
    } });

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

app.get("/api/system-status", async (req, res) => {
  try {
    const status = {
      mongoConnected: mongoose.connection.readyState === 1,
      mongoState: mongoose.connection.readyState,
      environment: process.env.NODE_ENV,
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasMongoDB: !!process.env.MONGODB_URI,
    };

    // Test MongoDB connection
    if (status.mongoConnected) {
      const testDoc = await Feed.findOne().select("_id");
      status.mongoQueryTest = !!testDoc;
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: "System status check failed",
      details: error.message,
    });
  }
});

app.get("/api/feed-status", async (req, res) => {
  try {
    const feeds = await Feed.find().lean();
    const articles = await Article.find().lean();

    const status = {
      feedCount: feeds.length,
      feeds: feeds.map((f) => ({
        name: f.name,
        url: f.url,
        lastFetched: f.lastFetched,
      })),
      articleCount: articles.length,
      recentArticles: articles
        .sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate))
        .slice(0, 5)
        .map((a) => ({
          title: a.title,
          publishDate: a.publishDate,
        })),
    };

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Development server
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

// Export the Express API
module.exports = app;
