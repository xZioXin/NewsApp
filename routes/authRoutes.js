const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Користувач з таким email вже існує' });
        }

        const user = new User({ name, email, password });
        await user.save();

        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            'your-secret-key',
            { expiresIn: '1h' }
        );

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
        res.status(500).json({ message: error.message });
    }
});

router.put('/profile', async (req, res) => {
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

        user.name = req.body.name || user.name;

        if (req.body.newPassword) {
            if (!req.body.currentPassword) {
                return res.status(400).json({ message: 'Поточний пароль обов\'язковий' });
            }

            const isMatch = await bcrypt.compare(req.body.currentPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Поточний пароль невірний' });
            }

            user.password = req.body.newPassword;
        }

        await user.save();

        res.json({
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email та пароль обов\'язкові' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Користувача з таким email не знайдено' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Невірний пароль' });
        }

        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            'your-secret-key',
            { expiresIn: '24h' }
        );

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
        console.error('Login error:', error);
        res.status(500).json({ message: 'Внутрішня помилка сервера' });
    }
});

router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'Необхідна авторизація' });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Необхідна авторизація' });
        }

        const decoded = jwt.verify(token, 'your-secret-key');
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'Користувача не знайдено' });
        }

        res.json({ user });
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Недійсний токен' });
        }
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

router.get('/count', async (req, res) => {
    try {
        const count = await User.countDocuments();
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;