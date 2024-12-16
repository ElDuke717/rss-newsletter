const express = require("express");
const router = express.Router();
const Feed = require("../models/Feed");
const Article = require("../models/Article"); // Add this line
const feedService = require("../services/feedService");
const aiService = require("../services/aiService.js");

// GET all feeds
router.get("/", async (req, res) => {
  try {
    const feeds = await Feed.find();
    res.json(feeds);
  } catch (error) {
    console.error("Error fetching feeds:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// POST new feed
router.post("/", async (req, res) => {
  try {
    console.log("Received feed creation request:", req.body); // Debug log
    const { name, url } = req.body;

    // Validate input
    if (!name || !url) {
      return res.status(400).json({ message: "Name and URL are required" });
    }

    // Create new feed
    const feed = new Feed({
      name,
      url,
    });

    const savedFeed = await feed.save();
    console.log("Feed saved:", savedFeed); // Debug log
    res.status(201).json(savedFeed);
  } catch (error) {
    console.error("Error creating feed:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Test route
router.post("/fetch", async (req, res) => {
  try {
    await feedService.fetchAllFeeds();
    res.json({ message: "Feeds fetched successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching feeds", error: error.message });
  }
});

router.get("/articles", async (req, res) => {
  try {
    const articles = await Article.find().populate("feedId");
    res.json(articles);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching articles", error: error.message });
  }
});

router.post("/test-ai-newsletter", async (req, res) => {
  try {
    const articles = await Article.find()
      .sort({ publishDate: -1 })
      .limit(5)
      .populate("feedId");

    const newsletterContent = await aiService.generateNewsletterContent(
      articles
    );
    res.json({
      message: "Newsletter generated successfully",
      content: newsletterContent,
    });
  } catch (error) {
    console.error("Error generating AI newsletter:", error);
    res.status(500).json({
      message: "Error generating newsletter",
      error: error.message,
    });
  }
});

// Fetch single feed
router.post('/fetch', async (req, res) => {
    try {
        const { feedId } = req.body;
        const feed = await Feed.findById(feedId);
        if (!feed) {
            return res.status(404).json({ message: 'Feed not found' });
        }

        console.log(`Fetching articles for feed: ${feed.name}`);
        await feedService.fetchFeed(feed);
        
        res.json({ message: 'Feed fetched successfully' });
    } catch (error) {
        console.error('Error fetching feed:', error);
        res.status(500).json({ message: 'Error fetching feed', error: error.message });
    }
});

// Fetch all feeds
router.post('/fetch-all', async (req, res) => {
    try {
        console.log('Fetching all feeds...');
        await feedService.fetchAllFeeds();
        res.json({ message: 'All feeds fetched successfully' });
    } catch (error) {
        console.error('Error fetching feeds:', error);
        res.status(500).json({ message: 'Error fetching feeds', error: error.message });
    }
});

// Get articles for a specific feed
router.get('/:feedId/articles', async (req, res) => {
    try {
        const articles = await Article.find({ feedId: req.params.feedId })
            .sort({ publishDate: -1 })
            .limit(10);
        res.json(articles);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching articles', error: error.message });
    }
});

module.exports = router;
