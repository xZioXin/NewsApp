
const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    content: { type: String, required: true },
    news: { type: mongoose.Schema.Types.ObjectId, ref: 'News', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Comment', commentSchema);