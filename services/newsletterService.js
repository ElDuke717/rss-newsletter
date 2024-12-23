const Article = require('../models/Article');
const aiService = require('./aiService');
const emailService = require('./emailService');
const Feed = require('../models/Feed');

class NewsletterService {
    async generateAndSendDailyNewsletter() {
        try {
            console.log("Starting daily newsletter generation...");

            // Get latest articles from each feed
            const feeds = await Feed.find();
            console.log(`Processing ${feeds.length} feeds`);

            // Fetch latest articles
            const articles = await Article.find({
                publishDate: {
                    $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                }
            })
            .populate('feedId')
            .sort({ publishDate: -1 })
            .limit(10)
            .lean();

            console.log(`Found ${articles.length} recent articles`);

            if (articles.length === 0) {
                console.log("No recent articles found, skipping newsletter");
                return;
            }

            // Generate newsletter content
            const content = await aiService.generateNewsletterContent(articles);

            // Create HTML email template
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; }
                        .newsletter { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .footer { margin-top: 20px; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="newsletter">
                        ${content}
                        <div class="footer">
                            <p>Generated on ${new Date().toLocaleDateString()}</p>
                            <p>Sources: ${[...new Set(articles.map(a => a.feedId.name))].join(', ')}</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            // Send newsletter
            await emailService.sendNewsletter(
                htmlContent, 
                process.env.RECIPIENT_EMAIL
            );

            console.log("Daily newsletter sent successfully");
            return true;
        } catch (error) {
            console.error("Failed to generate/send newsletter:", error);
            throw error;
        }
    }
}

module.exports = new NewsletterService();