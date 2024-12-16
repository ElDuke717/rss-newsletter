const cron = require('node-cron');
const Article = require('../models/Article');
const Subscriber = require('../models/Subscriber');
const emailService = require('../services/emailService');
const feedService = require('../services/feedService');
const aiService = require('../services/aiService');

class NewsletterJob {
    initializeJobs() {
        // Fetch feeds every 6 hours
        cron.schedule('0 */6 * * *', async () => {
            console.log('Fetching RSS feeds...');
            await feedService.fetchAllFeeds();
        });

        // Send newsletter daily at 7 AM
        cron.schedule('0 7 * * *', async () => {
            console.log('Generating daily newsletter...');
            await this.generateAndSendNewsletter();
        });
    }

    async generateAndSendNewsletter() {
        try {
            // Get unprocessed articles from last 24 hours
            const articles = await Article.find({
                processed: false,
                publishDate: { 
                    $gte: new Date(Date.now() - 24*60*60*1000)
                }
            }).populate('feedId');

            if (articles.length === 0) {
                console.log('No new articles to send');
                return;
            }

            // Generate AI content
            const newsletterContent = await aiService.generateNewsletterContent(articles);

            const activeSubscribers = await Subscriber.find({ active: true });
            if (activeSubscribers.length === 0) {
                console.log('No active subscribers');
                return;
            }

            // Send newsletter
            await emailService.sendNewsletter(activeSubscribers, {
                content: newsletterContent,
                articles: articles // Original articles as reference
            });

            // Mark articles as processed
            await Article.updateMany(
                { _id: { $in: articles.map(a => a._id) } },
                { processed: true }
            );

        } catch (error) {
            console.error('Newsletter generation error:', error);
        }
    }
}

module.exports = new NewsletterJob();