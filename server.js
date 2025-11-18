import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { fileURLToPath } from 'url';
import connectToDB from './db/connectToDB.js';
import apiRouter from './routes/index.js';
import registerChatHandlers from './socket/registerChatHandlers.js';
import { setSocketServer } from './socket/socketState.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const isProd = process.env.NODE_ENV === 'production';

// If running behind a proxy (Heroku, Vercel, nginx, etc.) enable trust proxy
if (isProd) app.set('trust proxy', 1);

// Allow cross-origin requests from the client dev server(s) and enable cookies
// Include deployed frontend origins by default so Render deployments are allowed.
const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3002',
    'https://mostore.onrender.com',
    'https://mostore-admin.onrender.com',
    'https://mostoreeg.com/'
];
const clientOrigin = process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : defaultOrigins;
app.use(cors({
    origin: function(origin, callback){
        // allow requests with no origin (like curl, mobile clients)
        if (!origin) return callback(null, true);
        if (clientOrigin.indexOf(origin) !== -1) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(__dirname, './public');
app.use(express.static(publicDirectory, {
    maxAge: isProd ? '1d' : '60s',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'public, max-age=60');
        }
    }
}));

// Serve sitemap.xml preferentially from client build/public locations when available
app.get('/sitemap.xml', (req, res) => {
    const clientPublic = path.join(__dirname, '..', 'client', 'public', 'sitemap.xml');
    const clientBuild = path.join(__dirname, '..', 'client', 'build', 'sitemap.xml');
    const serverPublic = path.join(__dirname, 'public', 'sitemap.xml');
    const tryFiles = [clientBuild, clientPublic, serverPublic];
    for (const f of tryFiles) {
        try {
            if (fs.existsSync(f)) {
                res.setHeader('Content-Type', 'application/xml');
                res.sendFile(f);
                return;
            }
        } catch (e) {
            // ignore
        }
    }
    res.status(404).send('sitemap not found');
});

// Register API routes
app.use('/api', apiRouter);


// lightweight request logging (console-based)
app.use((req, res, next) => {
    const now = new Date().toISOString();
    console.log(`[${now}] ${req.method} ${req.originalUrl}`);
    next();
});

connectToDB();

// global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err && (err.stack || err));
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT} (env=${process.env.NODE_ENV || 'development'})`);
});

const io = new SocketIOServer(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (clientOrigin.includes(origin)) return callback(null, true);
            return callback(new Error('Not allowed by CORS'));
        },
        credentials: true
    }
});

setSocketServer(io);
registerChatHandlers(io);

// Graceful shutdown
const shutdown = async () => {
    console.log('Shutting down server...');
    try {
        server.close(() => {
            console.log('HTTP server closed');
            // allow DB disconnect to finish if needed
            process.exit(0);
        });
        // Force exit after timeout
        setTimeout(() => {
            console.warn('Forcing shutdown');
            process.exit(1);
        }, 10000).unref();
    } catch (e) {
        console.error('Error during shutdown', e);
        process.exit(1);
    }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
