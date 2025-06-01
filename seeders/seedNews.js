const News = require("../models/News");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

async function seedNews() {
  try {
    const existingNews = await News.countDocuments();
    if (existingNews > 0) return [];

    const author = await User.findOne({});
    if (!author) {
      console.warn("Не знайдено користувачів для створення новин");
      return [];
    }

    const news = [
      {
        title: "Перша новина",
        content: "Це приклад першої новини в системі",
        category: "technology",
        author: author._id,
        status: "published"
      }
    ];

    const createdNews = await News.insertMany(news);
    console.log("Тестові новини успішно створені");
    return createdNews;
  } catch (error) {
    console.error("Помилка додавання тестових новин:", error);
    return [];
  }
}

module.exports = { seedNews };