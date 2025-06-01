const User = require("../models/User");
const bcrypt = require("bcryptjs");

async function seedUsers() {
  try {
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      const admin = await User.findOne({ role: "admin" });
      return admin ? [admin] : [];
    }

    const adminUser = new User({
      name: "Адміністратор",
      email: "admin@gmail.com",
      password: await bcrypt.hash("admin", 10),
      role: "admin"
    });

    await adminUser.save();
    console.log("Адміністратор успішно створений");
    return [adminUser];
  } catch (error) {
    console.error("Помилка додавання тестових користувачів:", error);
    return [];
  }
}

module.exports = { seedUsers };