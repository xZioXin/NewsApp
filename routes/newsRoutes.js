const express = require("express");
const router = express.Router();
const path = require('path');
const jwt = require('jsonwebtoken');
const newsController = require("../controllers/newsController");
const Comment = require('../models/Comment');
const User = require('../models/User');
const News = require('../models/News');
const FormData = require('multer');

const upload = FormData({
  storage: FormData.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Необхідна авторизація' });
    }

    const decoded = jwt.verify(token, 'your-secret-key');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Недійсний токен' });
  }
};

router.get('/count/published', newsController.getPublishedNewsCount);

router.get("/", newsController.getAllNews);
router.get("/status/:status", newsController.getNewsByStatus);
router.get("/author/:authorId", newsController.getUserNews);
router.get("/:newsId", newsController.getNews);
router.get("/:newsId/comments", newsController.getNewsComments);

router.post("/", authMiddleware, upload.single('media'), newsController.createNews);
router.put("/:newsId", authMiddleware, upload.single('media'), newsController.updateNews);
router.put("/:newsId/status", authMiddleware, newsController.updateNewsStatus);
router.post("/:newsId/view", newsController.addView);
router.post("/:newsId/like", authMiddleware, newsController.addLike);
router.post("/:newsId/comment", authMiddleware, newsController.addComment);
router.delete("/:newsId", authMiddleware, newsController.deleteNews);

module.exports = router;