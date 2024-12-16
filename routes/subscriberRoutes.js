const express = require('express');
const router = express.Router();
const Subscriber = require('../models/Subscriber');

// GET all subscribers
router.get('/', async (req, res) => {
    try {
        const subscribers = await Subscriber.find();
        res.json(subscribers);
    } catch (error) {
        console.error('Error fetching subscribers:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST new subscriber
router.post('/', async (req, res) => {
    try {
        const { email } = req.body;

        // Validate email
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Check if subscriber already exists
        const existingSubscriber = await Subscriber.findOne({ email });
        if (existingSubscriber) {
            return res.status(400).json({ message: 'Email already subscribed' });
        }

        // Create new subscriber
        const subscriber = new Subscriber({
            email,
            active: true
        });

        const savedSubscriber = await subscriber.save();
        res.status(201).json(savedSubscriber);
    } catch (error) {
        console.error('Error creating subscriber:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE subscriber
router.delete('/:id', async (req, res) => {
    try {
        const subscriber = await Subscriber.findByIdAndDelete(req.params.id);
        if (!subscriber) {
            return res.status(404).json({ message: 'Subscriber not found' });
        }
        res.json({ message: 'Subscriber deleted' });
    } catch (error) {
        console.error('Error deleting subscriber:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// UPDATE subscriber (e.g., to deactivate)
router.put('/:id', async (req, res) => {
    try {
        const { email, active } = req.body;
        const subscriber = await Subscriber.findByIdAndUpdate(
            req.params.id,
            { email, active },
            { new: true }
        );
        if (!subscriber) {
            return res.status(404).json({ message: 'Subscriber not found' });
        }
        res.json(subscriber);
    } catch (error) {
        console.error('Error updating subscriber:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET single subscriber
router.get('/:id', async (req, res) => {
    try {
        const subscriber = await Subscriber.findById(req.params.id);
        if (!subscriber) {
            return res.status(404).json({ message: 'Subscriber not found' });
        }
        res.json(subscriber);
    } catch (error) {
        console.error('Error fetching subscriber:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Unsubscribe route (using email)
router.post('/unsubscribe', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const subscriber = await Subscriber.findOneAndUpdate(
            { email },
            { active: false },
            { new: true }
        );

        if (!subscriber) {
            return res.status(404).json({ message: 'Subscriber not found' });
        }

        res.json({ message: 'Successfully unsubscribed' });
    } catch (error) {
        console.error('Error unsubscribing:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST new subscriber with debug logging
router.post('/', async (req, res) => {
    console.log('Received subscriber request:', req.body);
    try {
        const { email } = req.body;

        // Validate email
        if (!email) {
            console.log('Email missing in request');
            return res.status(400).json({ message: 'Email is required' });
        }

        // Check if subscriber exists
        const existingSubscriber = await Subscriber.findOne({ email });
        if (existingSubscriber) {
            console.log('Subscriber already exists:', email);
            return res.status(400).json({ message: 'Email already subscribed' });
        }

        // Create subscriber
        const subscriber = new Subscriber({ email });
        const savedSubscriber = await subscriber.save();
        console.log('Subscriber saved successfully:', savedSubscriber);
        res.status(201).json(savedSubscriber);

    } catch (error) {
        console.error('Error in subscriber creation:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;