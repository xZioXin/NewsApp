const express = require("express");
const router = express.Router();
const commentController = require("../controllers/commentController");

router.get('/count', commentController.getCommentsCount);

module.exports = router;