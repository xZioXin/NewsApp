const Comment = require("../models/Comment");
const News = require("../models/News");
const User = require("../models/User");

async function seedComments() {
  try {
    const existingComments = await Comment.countDocuments();
    if (existingComments > 0) return [];

    const news = await News.findOne();
    const user = await User.findOne();
    
    if (!news || !user) {
      console.warn("Не знайдено необхідних даних для коментарів");
      return [];
    }

    const comments = [
      {
        content: "Цікава новина!",
        news: news._id,
        author: user._id
      }
    ];

    const createdComments = await Comment.insertMany(comments);
    console.log("Тестові коментарі успішно створені");
    return createdComments;
  } catch (error) {
    console.error("Помилка додавання тестових коментарів:", error);
    return [];
  }
}

module.exports = { seedComments };