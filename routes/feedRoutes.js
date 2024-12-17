const express = require("express");
const router = express.Router();
const Feed = require("../models/Feed");
const Article = require("../models/Article"); // Add this line
const feedService = require("../services/feedService");
const aiService = require("../services/aiService.js");

// Wrap database operations
const withDB = async (callback) => {
  try {
      return await callback();
  } catch (error) {
      console.error("Database operation error:", error);
      throw error;
  }
};

// GET all feeds
router.get('/', async (req, res) => {
  try {
      const feeds = await Feed.find();
      console.log(`Retrieved ${feeds.length} feeds`);
      res.json(feeds);
  } catch (error) {
      console.error('Error fetching feeds:', error);
      res.status(500).json({ message: 'Error fetching feeds', error: error.message });
  }
});

// POST new feed with enhanced error handling
router.post('/', async (req, res) => {
  try {
      console.log('Received feed creation request:', req.body);

      const { name, url } = req.body;

      // Input validation
      if (!name || !url) {
          console.log('Missing required fields');
          return res.status(400).json({ 
              message: 'Missing required fields',
              required: ['name', 'url'],
              received: { name: !!name, url: !!url }
          });
      }

      // Check for duplicate URL
      const existingFeed = await Feed.findOne({ url });
      if (existingFeed) {
          console.log('Feed URL already exists');
          return res.status(409).json({ 
              message: 'Feed URL already exists',
              existingFeed: {
                  name: existingFeed.name,
                  url: existingFeed.url
              }
          });
      }

      // Create new feed
      const feed = new Feed({
          name,
          url,
          lastFetched: null
      });

      const savedFeed = await feed.save();
      console.log('Feed saved successfully:', savedFeed);
      
      res.status(201).json(savedFeed);
  } catch (error) {
      console.error('Feed creation error:', {
          message: error.message,
          stack: error.stack,
          name: error.name
      });
      
      // Handle specific MongoDB errors
      if (error.name === 'MongoServerError' && error.code === 11000) {
          return res.status(409).json({ 
              message: 'Duplicate feed URL',
              error: error.message 
          });
      }
      
      res.status(500).json({ 
          message: 'Error creating feed',
          error: error.message,
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
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

// DELETE feed
router.delete('/:id', async (req, res) => {
  try {
      const feed = await Feed.findByIdAndDelete(req.params.id);
      if (!feed) {
          return res.status(404).json({ message: 'Feed not found' });
      }
      res.json({ message: 'Feed deleted successfully', feed });
  } catch (error) {
      console.error('Error deleting feed:', error);
      res.status(500).json({ message: 'Error deleting feed', error: error.message });
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

// Add this route to feedRoutes.js
router.post('/fetch-all', async (req, res) => {
  try {
      console.log('Starting feed fetch process...');
      
      const feeds = await Feed.find();
      console.log(`Found ${feeds.length} feeds to process`);

      if (feeds.length === 0) {
          console.log('No feeds found in database');
          return res.json({ message: 'No feeds to fetch' });
      }

      const feedService = require('../services/feedService');
      console.log('Initializing feed service...');
      
      for (const feed of feeds) {
          console.log(`Processing feed: ${feed.name} (${feed.url})`);
          try {
              await feedService.fetchFeed(feed);
              console.log(`Successfully processed feed: ${feed.name}`);
          } catch (feedError) {
              console.error(`Error processing feed ${feed.name}:`, feedError);
          }
      }

      console.log('Feed fetch process complete');
      res.json({ 
          message: 'Feeds processed',
          feedCount: feeds.length
      });
  } catch (error) {
      console.error('Feed fetch error:', error);
      res.status(500).json({ 
          error: 'Failed to fetch feeds',
          details: error.message
      });
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
