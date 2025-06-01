const newsService = require("../services/newsService");
const News = require('../models/News');
const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const cloudinary = require('cloudinary').v2

const handleNotFound = (res, message = "Дані не знайдено") => {
    return res.status(404).json({ error: message });
};

async function uploadMediaToCloudinary(buffer) {
    try {
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { folder: 'news-app', resource_type: 'auto' },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            ).end(buffer);
        });
        return result.secure_url;
    } catch (error) {
        console.error('Error uploading media to Cloudinary:', error);
        throw error;
    }
}


const errorHandler = (fn) => {
    return async (req, res, next) => {
        try {
            await fn(req, res, next);
        } catch (err) {
            console.error("Помилка в контролері:", err);
            res.status(500).json({ error: "Внутрішня помилка сервера" });
        }
    };
};

const newsController = {
    async addView(req, res) {
        const { newsId } = req.params;
        const result = await newsService.addNewsView(newsId);

        if (!result) return handleNotFound(res, "Новину не знайдено");
        res.json(result);
    },

    async addLike(req, res) {
        const { newsId } = req.params;
        const userId = req.userId;

        const result = await newsService.addNewsLike(newsId, userId);

        if (result.error) return res.status(400).json(result);
        res.json(result);
    },

    async addComment(req, res) {
        try {
            const { newsId } = req.params;
            const { content } = req.body;
            const userId = req.userId;

            if (!content) {
                return res.status(400).json({ error: "Текст коментаря обов'язковий" });
            }

            if (!mongoose.Types.ObjectId.isValid(newsId)) {
                return res.status(400).json({ error: "Невірний ID новини" });
            }

            const news = await News.findById(newsId);
            if (!news) {
                return res.status(404).json({ error: "Новину не знайдено" });
            }

            const comment = new Comment({
                content,
                news: newsId,
                author: userId
            });

            const savedComment = await comment.save();

            const populatedComment = await Comment.findById(savedComment._id)
                .populate('author', 'name');

            res.status(201).json(populatedComment);
        } catch (error) {
            console.error("Помилка при додаванні коментаря:", error);
            res.status(500).json({ error: "Внутрішня помилка сервера" });
        }
    },

    async createNews(req, res) {
        try {
            const { title, content, category } = req.body;

            if (!title || !content || !category) {
                return res.status(400).json({
                    error: 'Необхідно заповнити заголовок, вміст та категорію'
                });
            }

            if (req.file && req.file.size > 10 * 1024 * 1024) {
                return res.status(400).json({
                    error: 'Розмір файлу занадто великий (максимум 10MB)'
                });
            }

            let mediaUrl = null;
            if (req.file) {
                try {
                    mediaUrl = await uploadMediaToCloudinary(req.file.buffer);
                } catch (uploadError) {
                    console.error('Помилка завантаження медіа:', uploadError);
                    return res.status(500).json({ error: 'Помилка завантаження медіа' });
                }
            }

            const newNews = new News({
                title,
                content,
                category,
                author: req.userId,
                mediaUrl,
                status: 'pending',
                likes: []
            });

            const savedNews = await newNews.save();
            res.status(201).json(savedNews);
        } catch (error) {
            console.error('Помилка при створенні новини:', error);
            res.status(500).json({ error: 'Внутрішня помилка сервера' });
        }
    },

    async updateNews(req, res) {
        try {
            const { newsId } = req.params;
            const { title, content, category } = req.body;

            const existingNews = await News.findById(newsId);
            if (!existingNews) {
                return res.status(404).json({ error: 'Новину не знайдено' });
            }

            const updateData = {
                title: title || existingNews.title,
                content: content || existingNews.content,
                category: category || existingNews.category,
                updatedAt: Date.now()
            };

            if (req.file) {
                updateData.mediaUrl = await uploadMediaToCloudinary(req.file.buffer);
            }

            if (existingNews.status === 'published' || existingNews.status === 'rejected') {
                updateData.status = 'pending';
                updateData.likes = [];
                await Comment.deleteMany({ news: newsId });
            }

            const updatedNews = await News.findByIdAndUpdate(
                newsId,
                updateData,
                { new: true }
            ).populate('author', 'name');

            res.json(updatedNews);
        } catch (error) {
            console.error('Помилка при оновленні новини:', error);
            res.status(500).json({ error: 'Внутрішня помилка сервера' });
        }
    },

    async getNews(req, res) {
        const { newsId } = req.params;
        const result = await newsService.getNewsWithComments(newsId);

        if (result.error) return handleNotFound(res, result.error);
        res.json(result);
    },

    async getAllNews(req, res) {
        try {
            const { status, search, sort, category } = req.query;

            if (req.query.count !== undefined) {
                const count = await News.countDocuments(status ? { status } : {});
                return res.json({ count });
            }

            const filter = status ? { status } : { status: 'published' };

            if (search) {
                filter.title = { $regex: search, $options: 'i' };
            }

            if (category && category !== 'all') {
                filter.category = category;
            }

            let sortOption = { createdAt: -1 };

            if (sort) {
                switch (sort) {
                    case 'oldest':
                        sortOption = { createdAt: 1 };
                        break;
                    case 'title-asc':
                        sortOption = { title: 1 };
                        break;
                    case 'title-desc':
                        sortOption = { title: -1 };
                        break;
                }
            }

            const news = await News.find(filter)
                .populate('author', 'name')
                .sort(sortOption);

            res.json(news);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    async getNewsByStatus(req, res) {
        const { status } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const news = await newsService.getNewsByStatus(
            status,
            parseInt(page),
            parseInt(limit)
        );

        res.json(news);
    },

    async getUserNews(req, res) {
        try {
            const news = await News.find({
                author: req.params.authorId
            })
                .populate('author', 'name')
                .sort({ createdAt: -1 });

            res.json(news);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    async getNewsComments(req, res) {
        try {
            const { newsId } = req.params;

            if (!mongoose.Types.ObjectId.isValid(newsId)) {
                return res.status(400).json({ error: "Невірний ID новини" });
            }

            const comments = await Comment.find({ news: newsId })
                .populate('author', 'name')
                .sort({ createdAt: -1 });

            res.json(comments);
        } catch (error) {
            console.error("Помилка при отриманні коментарів:", error);
            res.status(500).json({ error: "Внутрішня помилка сервера" });
        }
    },

    async deleteNews(req, res) {
        try {
            const { newsId } = req.params;

            const deletedNews = await News.findByIdAndDelete(newsId);
            if (!deletedNews) {
                return res.status(404).json({ error: "Новину не знайдено" });
            }

            res.json({ success: true, message: "Новину успішно видалено" });
        } catch (error) {
            console.error("Помилка при видаленні новини:", error);
            res.status(500).json({ error: "Внутрішня помилка сервера" });
        }
    },

    async updateNewsStatus(req, res) {
        try {
            const { newsId } = req.params;
            const { status } = req.body;

            const validStatuses = ['published', 'pending', 'rejected', 'draft'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Невірний статус' });
            }

            const news = await News.findById(newsId);
            if (!news) {
                return res.status(404).json({ error: "Новину не знайдено" });
            }

            if (status === 'pending' || status === 'rejected') {
                news.likes = [];

                await Comment.deleteMany({ news: newsId });
            }

            news.status = status;
            const updatedNews = await news.save();

            res.json(updatedNews);
        } catch (error) {
            console.error('Помилка при оновленні статусу новини:', error);
            res.status(500).json({ error: 'Внутрішня помилка сервера' });
        }
    },

    async getPublishedNewsCount(req, res) {
        try {
            const count = await News.countDocuments({ status: 'published' });
            res.json({ count });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    async getNewsWithComments(newsId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(newsId)) {
                return { error: "Невірний ID новини" };
            }

            const news = await News.findById(newsId)
                .populate('author', 'name')
                .populate({
                    path: 'comments',
                    populate: {
                        path: 'author',
                        select: 'name'
                    }
                });

            if (!news) {
                return { error: "Новину не знайдено" };
            }

            return {
                ...news.toObject(),
                likesCount: news.likes ? news.likes.length : 0,
                isLiked: req.userId && news.likes && news.likes.includes(req.userId)
            };
        } catch (error) {
            console.error("Помилка при отриманні новини з коментарями:", error);
            return { error: "Внутрішня помилка сервера" };
        }
    }
};

module.exports = newsController;