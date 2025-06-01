const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: {
        type: String,
        enum: ['politics', 'sports', 'technology', 'entertainment'],
        required: true
    },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: {
        type: String,
        enum: ['draft', 'pending', 'published', 'rejected'],
        default: 'pending'
    },
    mediaUrl: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date }
});

module.exports = mongoose.model('News', newsSchema);