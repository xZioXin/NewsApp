const Comment = require('../models/Comment');

const commentController = {
    async getCommentsCount(req, res) {
        try {
            const count = await Comment.countDocuments();
            res.json({ count });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
};

module.exports = commentController;