const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs').promises;

class EmailService {
    constructor() {
        this.ses = new SESClient({
            region: process.env.AWS_REGION || 'us-east-1'
        });
    }

    async sendNewsletter(subscribers, articles) {
        try {
            const template = await fs.readFile(
                path.join(__dirname, '../templates/newsletter.ejs'),
                'utf8'
            );
            
            const htmlContent = ejs.render(template, { articles });

            for (const subscriber of subscribers) {
                await this.ses.send(new SendEmailCommand({
                    Source: process.env.EMAIL_FROM,
                    Destination: {
                        ToAddresses: [subscriber.email]
                    },
                    Message: {
                        Subject: {
                            Data: `Daily Newsletter - ${new Date().toLocaleDateString()}`
                        },
                        Body: {
                            Html: {
                                Data: htmlContent
                            }
                        }
                    }
                }));
                console.log(`Newsletter sent to ${subscriber.email}`);
            }
        } catch (error) {
            console.error('Error sending newsletter:', error);
            throw error;
        }
    }
}

module.exports = new EmailService();