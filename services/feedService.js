const Parser = require('rss-parser');
const Feed = require('../models/Feed');
const Article = require('../models/Article');
const parser = new Parser();

class FeedService {
    async fetchAllFeeds() {
        try {
            const feeds = await Feed.find();
            console.log(`Fetching ${feeds.length} feeds...`);

            for (const feed of feeds) {
                await this.fetchFeed(feed);
            }
        } catch (error) {
            console.error('Error fetching feeds:', error);
        }
    }

    async fetchFeed(feed) {
        try {
            console.log(`Fetching feed: ${feed.name}`);
            const feedContent = await parser.parseURL(feed.url);
            
            for (const item of feedContent.items) {
                await Article.findOneAndUpdate(
                    { url: item.link },
                    {
                        title: item.title,
                        content: item.content,
                        url: item.link,
                        feedId: feed._id,
                        publishDate: new Date(item.pubDate),
                        processed: false
                    },
                    { upsert: true, new: true }
                );
            }

            await Feed.findByIdAndUpdate(feed._id, {
                lastFetched: new Date()
            });

            console.log(`Completed fetching feed: ${feed.name}`);
        } catch (error) {
            console.error(`Error fetching feed ${feed.name}:`, error);
        }
    }
}

module.exports = new FeedService();