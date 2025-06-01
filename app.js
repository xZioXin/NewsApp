const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const newsRoutes = require("./routes/newsRoutes");
const authRoutes = require('./routes/authRoutes');
const newsController = require('./controllers/newsController');
const commentController = require('./controllers/commentController');
const commentRoutes = require('./routes/commentRoutes');
const { seedUsers } = require("./seeders/seedUsers");
const { seedNews } = require("./seeders/seedNews");
const { seedComments } = require("./seeders/seedComments");
const { initRabbitMQ } = require("./services/rabbitMQService");
const News = require('./models/News');
const User = require('./models/User');
const Comment = require('./models/Comment');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const cloudinary = require('cloudinary').v2;

cloudinary.config({ 
        cloud_name: 'dfk7kb2hp', 
        api_key: '792964947798479', 
        api_secret: 'PsSbelNPWkQoxOaB4gcm0my-ln0'
});

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect("mongodb://localhost:27017/news-app")
  	.then(async () => {
		console.log("Успішно підключено до MongoDB");

		try {
			const users = await seedUsers();
			if (users.length === 0) {
				console.warn("Не вдалося створити тестових користувачів");
				return;
			}

			const news = await seedNews();
			if (news.length === 0) {
				console.warn("Не вдалося створити тестові новини");
			}

			const comments = await seedComments();
			if (comments.length === 0) {
				console.warn("Не вдалося створити тестові коментарі");
			}

			await initRabbitMQ().catch(err => {
				console.warn("Не вдалося підключитися до RabbitMQ:", err.message);
			});

		} catch (error) {
			console.error("Помилка під час задання тестових значень:", error);
		}

		async function createUser(userData) {
			const { name, email, password } = userData;
			
			const existingUser = await User.findOne({ email });
			if (existingUser) {
				throw new Error('Користувач з таким email вже існує');
			}

			const user = new User({
				name,
				email,
				password
			});

			await user.save();
			return user;
		}

		function generateToken(user) {
			return jwt.sign(
				{ userId: user._id, email: user.email, role: user.role },
				'your-secret-key'
			);
		}

		async function loginUser(loginData) {
			const { email, password } = loginData;
			
			const user = await User.findOne({ email });
			if (!user) {
				throw new Error('Користувача з таким email не знайдено');
			}

			const isMatch = await bcrypt.compare(password, user.password);
			if (!isMatch) {
				throw new Error('Невірний пароль');
			}

			return user;
		}

		app.post('/auth/register', async (req, res) => {
			try {
				const user = await createUser(req.body);
				const token = generateToken(user);
				
				res.json({
					user: {
						_id: user._id,
						name: user.name,
						email: user.email,
						role: user.role
					},
					token
				});
			} catch (error) {
				res.status(400).json({
					message: error.message
				});
			}
		});

		app.post('/auth/login', async (req, res) => {
			try {
				const user = await loginUser(req.body);
				const token = generateToken(user);
				
				res.json({
					user: {
						_id: user._id,
						name: user.name,
						email: user.email,
						role: user.role
					},
					token
				});
			} catch (error) {
				res.status(400).json({
					message: error.message
				});
			}
		});	

		app.get('/auth/me', async (req, res) => {
			try {
				const token = req.headers.authorization?.split(' ')[1];
				if (!token) {
					return res.status(401).json({ message: 'Необхідна авторизація' });
				}

				const decoded = jwt.verify(token, 'your-secret-key');
				const user = await User.findById(decoded.userId);
				
				if (!user) {
					return res.status(404).json({ message: 'Користувача не знайдено' });
				}

				res.json({
					user: {
						_id: user._id,
						name: user.name,
						email: user.email,
						role: user.role
					}
				});
			} catch (error) {
				res.status(401).json({ message: 'Недійсний токен' });
			}
		});
		
		app.listen(PORT, () => {
		console.log(`Сервер працює на http://localhost:${PORT}`);
		});
  	})
  	.catch((error) => {
    	console.error("Проблема з підключенням до MongoDB: ", error);
    	process.exit(1);
  	});
	
app.use("/api/news", newsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/comments', commentRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.get('/news.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'news.html'));
});

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB з\'єднання закрито');
  process.exit(0);
});