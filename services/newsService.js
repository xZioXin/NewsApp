const mongoose = require('mongoose');
const News = require("../models/News");
const User = require("../models/User");
const Comment = require("../models/Comment");
const { sendToQueue } = require("./rabbitMQService");

async function calculatePopularity(newsId) {
    const news = await News.findById(newsId);
    if (!news) return 0;

    const commentsCount = await Comment.countDocuments({ news: newsId });
    return news.views * 0.5 + commentsCount * 2 + news.likes * 1.5;
}

async function addNewsView(newsId) {
    const updatedNews = await News.findByIdAndUpdate(
        newsId,
        { $inc: { views: 1 } },
        { new: true }
    );

    if (updatedNews) {
        const popularity = await calculatePopularity(newsId);
        updatedNews.popularity = popularity;
        await updatedNews.save();

        sendToQueue({
            type: "news_view",
            newsId: updatedNews._id,
            views: updatedNews.views,
            popularity
        });
    }

    return updatedNews;
}

async function addNewsLike(newsId, userId) {
    try {
        const news = await News.findById(newsId);
        if (!news) {
            return { error: "Новину не знайдено" };
        }

        const likeIndex = news.likes.indexOf(userId);
        if (likeIndex === -1) {
            news.likes.push(userId);
        } else {
            news.likes.splice(likeIndex, 1);
        }

        await news.save();

        return {
            likesCount: news.likes.length,
            isLiked: likeIndex === -1
        };
    } catch (error) {
        console.error("Помилка при додаванні лайку:", error);
        return { error: "Внутрішня помилка сервера" };
    }
}

async function addComment(newsId, userId, content) {
    const news = await News.findById(newsId);
    if (!news) return { error: "Новину не знайдено" };

    const user = await User.findById(userId);
    if (!user) return { error: "Користувача не знайдено" };

    const newComment = new Comment({
        content,
        news: newsId,
        author: userId
    });

    await newComment.save();

    const popularity = await calculatePopularity(newsId);
    await News.findByIdAndUpdate(newsId, { popularity });

    sendToQueue({
        type: "new_comment",
        newsId,
        userId,
        commentId: newComment._id,
        popularity
    });

    return {
        comment: newComment,
        popularity
    };
}

async function createNews(authorId, title, content, category) {
    const user = await User.findById(authorId);
    if (!user) return { error: "Користувача не знайдено" };

    const newNews = new News({
        title,
        content,
        category,
        author: authorId,
        status: user.role === "admin" ? "published" : "pending",
        views: 0,
        likes: [],
        popularity: 0
    });

    await newNews.save();

    sendToQueue({
        type: "news_created",
        newsId: newNews._id,
        authorId,
        title,
        category,
        status: newNews.status
    });

    return newNews;
}

async function getNewsWithComments(newsId) {
    if (!mongoose.Types.ObjectId.isValid(newsId)) {
        return { error: "Невірний ID новини" };
    }
    const news = await News.findById(newsId)
        .populate("author", "name email")
        .lean();

    if (!news) return { error: "Новину не знайдено" };

    const comments = await Comment.find({ news: newsId })
        .populate("author", "name")
        .sort({ createdAt: -1 })
        .lean();

    return {
        ...news,
        comments
    };
}

const getAllNews = (page = 1, limit = 10) =>
    News.find()
        .populate("author", "name")
        .sort({ popularity: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

const getNewsByStatus = async (status, page = 1, limit = 10) =>
    News.find({ status })
        .populate("author", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

const getNewsById = async newsId =>
    News.findById(newsId)
        .populate("author", "name email")
        .lean();

const getUserNewsHistory = async authorId =>
    News.find({ author: authorId })
        .sort({ createdAt: -1 })
        .lean();

const getCommentsByNews = async newsId =>
    Comment.find({ news: newsId })
        .populate("author", "name")
        .sort({ createdAt: -1 })
        .lean();

module.exports = {
    addNewsView,
    addNewsLike,
    addComment,
    createNews,
    getNewsWithComments,
    getAllNews,
    getNewsByStatus,
    getNewsById,
    getUserNewsHistory,
    getCommentsByNews,
    calculatePopularity
};