const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    content: String,
    url: {
        type: String,
        required: true,
        unique: true
    },
    feedId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Feed'
    },
    publishDate: Date,
    processed: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Article', ArticleSchema);