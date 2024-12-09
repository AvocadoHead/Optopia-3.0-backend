import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { coursesRouter } from './routes/courses.js';
import { membersRouter } from './routes/members.js';
import { galleryRouter } from './routes/gallery.js';
import { authRouter } from './routes/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5000', 'http://localhost:5000', 'https://avocadohead.github.io'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json());

// Routes
app.use('/api/courses', coursesRouter);
app.use('/api/members', membersRouter);
app.use('/api/gallery', galleryRouter);
app.use('/api/auth', authRouter);

// Error handling
app.use(errorHandler);

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
