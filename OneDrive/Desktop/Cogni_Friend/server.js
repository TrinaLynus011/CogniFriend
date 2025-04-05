require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/AITutor', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    subjectRatings: {
        math: { type: String },
        english: { type: String },
        evs: { type: String },
        science: { type: String }
    },
    dailyScreenTime: { type: Number },
    profilePicture: { type: String },
    dashboardData: {
        coins: { type: Number, default: 1250 },
        level: { type: Number, default: 5 },
        completedCourses: { type: Number, default: 12 },
        hoursLearned: { type: Number, default: 48 },
        dailyChecklist: {
            goal1: { type: Boolean, default: false },
            goal2: { type: Boolean, default: false },
            goal3: { type: Boolean, default: false },
            goal4: { type: Boolean, default: false }
        },
        videoProgress: { type: Array, default: [] }
    },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Simple user authentication by ID (not secure, for development only)
const simpleAuth = async (req, res, next) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ message: 'User ID required' });

    try {
        req.user = await User.findById(userId);
        if (!req.user) return res.status(404).json({ message: 'User not found' });
        next();
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Signup Endpoint
app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password, subjectRatings, dailyScreenTime, profilePicture } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already in use' });
        }

        // Create new user
        const newUser = new User({
            name,
            email,
            password, // Note: In production, you should hash passwords!
            subjectRatings,
            dailyScreenTime,
            profilePicture
        });

        await newUser.save();

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                profilePicture: newUser.profilePicture
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// Login Endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check password (simple comparison - not secure)
        if (password !== user.password) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        res.json({
            message: 'Login successful',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                profilePicture: user.profilePicture,
                dashboardData: user.dashboardData
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// Dashboard Endpoints (using simple auth)
app.get('/api/dashboard', simpleAuth, async (req, res) => {
    try {
        res.json({
            dashboardData: req.user.dashboardData
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ message: 'Server error fetching dashboard data' });
    }
});

app.put('/api/dashboard/checklist', simpleAuth, async (req, res) => {
    try {
        const { goalId, checked } = req.body;
        const user = req.user;

        // Update checklist
        user.dashboardData.dailyChecklist[goalId] = checked;

        // Add coins if checking (not unchecking)
        if (checked) {
            let points = 0;
            switch(goalId) {
                case 'goal1': points = 50; break;
                case 'goal2': points = 30; break;
                case 'goal3': points = 40; break;
                case 'goal4': points = 20; break;
            }
            user.dashboardData.coins += points;
        }

        await user.save();
        res.json({
            coins: user.dashboardData.coins,
            dailyChecklist: user.dashboardData.dailyChecklist
        });
    } catch (error) {
        console.error('Checklist update error:', error);
        res.status(500).json({ message: 'Server error updating checklist' });
    }
});

app.post('/api/dashboard/video-progress', simpleAuth, async (req, res) => {
    try {
        const { videoId, title, percentage } = req.body;
        const user = req.user;

        // Add video progress
        user.dashboardData.videoProgress.unshift({
            videoId,
            title,
            percentage,
            date: new Date()
        });

        // Mark "Watch 1 educational video" as completed
        user.dashboardData.dailyChecklist.goal2 = true;
        
        // Add coins for watching video
        user.dashboardData.coins += 30;

        await user.save();
        res.json({
            coins: user.dashboardData.coins,
            videoProgress: user.dashboardData.videoProgress,
            dailyChecklist: user.dashboardData.dailyChecklist
        });
    } catch (error) {
        console.error('Video progress error:', error);
        res.status(500).json({ message: 'Server error tracking video progress' });
    }
});

// User Profile Endpoint
app.get('/api/user', simpleAuth, async (req, res) => {
    try {
        res.json(req.user);
    } catch (error) {
        console.error('User profile error:', error);
        res.status(500).json({ message: 'Server error fetching user profile' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});