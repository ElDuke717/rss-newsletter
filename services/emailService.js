const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs').promises;

class EmailService {
    constructor() {
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            console.warn('AWS credentials not found in environment variables');
        }

        this.ses = new SESClient({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });

        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async sendWithRetry(command, retries = 0) {
        try {
            return await this.ses.send(command);
        } catch (error) {
            if (retries < this.maxRetries && this.isRetryableError(error)) {
                console.log(`Retrying send (attempt ${retries + 1} of ${this.maxRetries})...`);
                await this.sleep(this.retryDelay * Math.pow(2, retries));
                return this.sendWithRetry(command, retries + 1);
            }
            throw error;
        }
    }

    isRetryableError(error) {
        const retryableCodes = ['ThrottlingException', 'RequestTimeout', 'ServiceUnavailable'];
        return retryableCodes.includes(error.name);
    }

    async sendNewsletter(subscribers, articles) {
        const results = {
            success: [],
            failed: []
        };
    
        try {
            // Validate inputs
            if (!Array.isArray(subscribers) || !Array.isArray(articles)) {
                throw new Error('Invalid input: subscribers and articles must be arrays');
            }
    
            if (!process.env.EMAIL_FROM) {
                throw new Error('EMAIL_FROM environment variable not set');
            }
    
            // Template validation and loading
            const templatePath = path.join(__dirname, '../templates/newsletter.ejs');
            
            // Check if template exists
            try {
                await fs.access(templatePath);
                console.log('✓ Newsletter template found');
            } catch (error) {
                throw new Error(`Newsletter template not found at ${templatePath}`);
            }
    
            // Load template
            const template = await fs.readFile(templatePath, 'utf8')
                .catch(error => {
                    throw new Error(`Failed to load email template: ${error.message}`);
                });
    
            // Validate template content
            if (!template.includes('<%')) {
                console.warn('Warning: Template might not contain EJS syntax');
            }
    
            // Test template rendering with sample data
            try {
                const testRender = ejs.render(template, {
                    articles: [{
                        title: 'Test Article',
                        description: 'Test Description',
                        content: 'Test Content',
                        link: 'https://example.com',
                        publishDate: new Date(),
                        feedId: { name: 'Test Feed' }
                    }],
                    date: new Date().toLocaleDateString(),
                    unsubscribeLink: '#'
                });
                console.log('✓ Template test render successful');
            } catch (error) {
                throw new Error(`Template validation failed: ${error.message}`);
            }
    
            // Render actual newsletter
            console.log(`Rendering newsletter with ${articles.length} articles...`);
            const htmlContent = ejs.render(template, { 
                articles,
                date: new Date().toLocaleDateString(),
                unsubscribeLink: process.env.UNSUBSCRIBE_URL || '#'
            });
            console.log('✓ Newsletter content generated');
    
            // Validate rendered content
            if (!htmlContent.includes('<html')) {
                console.warn('Warning: Generated content might not be valid HTML');
            }
    
            // Send to each subscriber
            for (const subscriber of subscribers) {
                try {
                    if (!subscriber.email) {
                        throw new Error('Invalid subscriber: missing email');
                    }
    
                    const command = new SendEmailCommand({
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
                                    Data: htmlContent,
                                    Charset: 'UTF-8'
                                },
                                Text: {
                                    Data: this.createTextVersion(articles),
                                    Charset: 'UTF-8'
                                }
                            }
                        },
                        ConfigurationSetName: process.env.SES_CONFIGURATION_SET // Optional
                    });
    
                    await this.sendWithRetry(command);
                    console.log(`✓ Newsletter sent to ${subscriber.email}`);
                    results.success.push(subscriber.email);
                } catch (error) {
                    console.error(`✗ Failed to send to ${subscriber.email}:`, error);
                    results.failed.push({
                        email: subscriber.email,
                        error: error.message
                    });
                }
            }
    
            return results;
        } catch (error) {
            console.error('Newsletter service error:', error);
            throw error;
        }
    }
    
    // Add this method to test the template separately
    async testTemplate() {
        try {
            const templatePath = path.join(__dirname, '../templates/newsletter.ejs');
            
            // Check template existence
            await fs.access(templatePath);
            
            // Load template
            const template = await fs.readFile(templatePath, 'utf8');
            
            // Test render
            const testData = {
                articles: [{
                    title: 'Test Article',
                    description: 'Test Description',
                    content: 'Test Content',
                    link: 'https://example.com',
                    publishDate: new Date(),
                    feedId: { name: 'Test Feed' }
                }],
                date: new Date().toLocaleDateString(),
                unsubscribeLink: '#'
            };
    
            const rendered = ejs.render(template, testData);
    
            return {
                success: true,
                templateFound: true,
                templateLength: template.length,
                renderedLength: rendered.length,
                containsHtml: rendered.includes('<html'),
                containsArticle: rendered.includes('Test Article'),
                sample: rendered.substring(0, 200) + '...'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    createTextVersion(articles) {
        return articles.map(article => 
            `${article.title}\n${article.description || ''}\n${article.link || ''}\n\n`
        ).join('\n---\n\n');
    }

    // Test method to verify configuration
    async testConnection() {
        try {
            const command = new SendEmailCommand({
                Source: process.env.EMAIL_FROM,
                Destination: {
                    ToAddresses: [process.env.EMAIL_FROM] // Send to self
                },
                Message: {
                    Subject: {
                        Data: 'SES Test Email'
                    },
                    Body: {
                        Text: {
                            Data: 'If you receive this, SES is configured correctly.'
                        }
                    }
                }
            });

            await this.sendWithRetry(command);
            return { success: true, message: 'SES configuration is valid' };
        } catch (error) {
            return { 
                success: false, 
                message: 'SES configuration test failed',
                error: error.message
            };
        }
    }
    async testTemplate() {
        try {
            const templatePath = path.join(__dirname, '../templates/newsletter.ejs');
            
            // Check template existence
            await fs.access(templatePath);
            
            // Load template
            const template = await fs.readFile(templatePath, 'utf8');
            
            // Test render
            const testData = {
                articles: [{
                    title: 'Test Article',
                    description: 'Test Description',
                    content: 'Test Content',
                    link: 'https://example.com',
                    publishDate: new Date(),
                    feedId: { name: 'Test Feed' }
                }],
                date: new Date().toLocaleDateString(),
                unsubscribeLink: '#'
            };
    
            const rendered = ejs.render(template, testData);
    
            return {
                success: true,
                templateFound: true,
                templateLength: template.length,
                renderedLength: rendered.length,
                containsHtml: rendered.includes('<html'),
                containsArticle: rendered.includes('Test Article'),
                sample: rendered.substring(0, 200) + '...'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

}

module.exports = new EmailService();