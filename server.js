// ==========================================================
// DRAGON QUEUE SERVER
// ==========================================================

require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const db = require("./database");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const COOKIE_NAME = "dragon_session";
const SESSION_DAYS = 7;

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(requireHttps);
app.use(express.static(path.join(__dirname, "public")));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many account attempts. Please wait 15 minutes and try again." }
});

// ==========================================================
// SMALL HELPERS
// ==========================================================

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return salt + ":" + hash;
}

function verifyPassword(password, savedPassword) {
    if (!savedPassword || !savedPassword.includes(":")) return false;
    const [salt, savedHex] = savedPassword.split(":");
    const savedHash = Buffer.from(savedHex, "hex");
    if (savedHash.length !== 64) return false;
    return crypto.timingSafeEqual(savedHash, crypto.scryptSync(password, salt, 64));
}

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function readCookie(req, name) {
    const cookies = String(req.headers.cookie || "").split(";");
    for (const cookie of cookies) {
        const [key, ...parts] = cookie.trim().split("=");
        if (key === name) return decodeURIComponent(parts.join("="));
    }
    return "";
}

function sessionCookie(token) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

function requireHttps(req, res, next) {
    if (process.env.NODE_ENV !== "production" || req.secure) return next();
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
}

function clearSessionCookie() {
    return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function sendDatabaseError(res, label, error, message) {
    console.error(label, error.message);
    res.status(500).json({ message });
}

function publicUser(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        title: user.title,
        role: user.role || "student"
    };
}

async function createSession(res, userId) {
    const token = crypto.randomBytes(32).toString("hex");
    await db.query("DELETE FROM user_sessions WHERE expires_at <= NOW()");
    await db.query(
        `INSERT INTO user_sessions (token_hash, user_id, expires_at)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
        [hashToken(token), userId, SESSION_DAYS]
    );
    res.setHeader("Set-Cookie", sessionCookie(token));
}

async function requireUser(req, res, next) {
    try {
        const token = readCookie(req, COOKIE_NAME);
        if (!token) return res.status(401).json({ message: "Please log in again." });

        const [rows] = await db.query(
            `SELECT u.id, u.username, u.email, u.title,
                    COALESCE(r.role, 'student') AS role
             FROM user_sessions s
             JOIN users u ON u.id = s.user_id
             LEFT JOIN user_roles r ON r.user_id = u.id
             WHERE s.token_hash = ? AND s.expires_at > NOW()
             LIMIT 1`,
            [hashToken(token)]
        );

        if (rows.length === 0) {
            res.setHeader("Set-Cookie", clearSessionCookie());
            return res.status(401).json({ message: "Your login expired. Please log in again." });
        }

        req.user = rows[0];
        next();
    } catch (error) {
        sendDatabaseError(res, "Session check error:", error, "Your login could not be checked.");
    }
}

function requireQueueAdmin(req, res, next) {
    if (!["main_admin", "temp_admin"].includes(req.user.role)) {
        return res.status(403).json({ message: "Only an admin can manage queues and results." });
    }
    next();
}

// ==========================================================
// HEALTH, LOGIN AND LOGOUT
// ==========================================================

app.get("/api/health", async (req, res) => {
    try {
        await db.query("SELECT 1");
        res.json({ message: "Dragon Queue server and database are running." });
    } catch (error) {
        res.status(503).json({ message: "The database is not available." });
    }
});

app.post("/api/login", loginLimiter, async (req, res) => {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const mode = req.body.mode === "login" ? "login" : "register";

    if (!looksLikeEmail(email) || password.length < 8 || password.length > 128) {
        return res.status(400).json({ message: "Enter a valid email and a password of 8 to 128 characters." });
    }
    if (mode === "register" && (username.length < 2 || username.length > 50)) {
        return res.status(400).json({ message: "Choose a username between 2 and 50 characters." });
    }

    try {
        if (mode === "login") {
            const [users] = await db.query(
                `SELECT u.id, u.username, u.email, u.title, u.password_hash,
                        COALESCE(r.role, 'student') AS role
                 FROM users u LEFT JOIN user_roles r ON r.user_id = u.id
                 WHERE u.email = ? LIMIT 1`,
                [email]
            );
            if (users.length === 0 || !verifyPassword(password, users[0].password_hash)) {
                return res.status(401).json({ message: "Email or password is incorrect." });
            }
            await createSession(res, users[0].id);
            return res.json(publicUser(users[0]));
        }

        const [existing] = await db.query(
            "SELECT id, email FROM users WHERE email = ? OR username = ? LIMIT 1",
            [email, username]
        );
        if (existing.length > 0) {
            const message = existing[0].email === email
                ? "An account already uses this email address."
                : "That username is already taken.";
            return res.status(409).json({ message });
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.query(
                "INSERT INTO users (username, email, password_hash, title) VALUES (?, ?, ?, 'Student')",
                [username, email, hashPassword(password)]
            );
            await connection.query(
                "INSERT INTO user_roles (user_id, role) VALUES (?, 'student')",
                [result.insertId]
            );
            await connection.commit();
            await createSession(res, result.insertId);
            return res.status(201).json({ id: result.insertId, username, email, title: "Student", role: "student" });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "That email or username is already taken." });
        sendDatabaseError(res, "Login/register error:", error, "The account could not be processed.");
    }
});

app.get("/api/me", requireUser, (req, res) => res.json(publicUser(req.user)));

app.post("/api/logout", async (req, res) => {
    const token = readCookie(req, COOKIE_NAME);
    if (token) await db.query("DELETE FROM user_sessions WHERE token_hash = ?", [hashToken(token)]).catch(() => {});
    res.setHeader("Set-Cookie", clearSessionCookie());
    res.json({ ok: true });
});

// ==========================================================
// SHARED DATA
// ==========================================================

app.get("/api/stations", requireUser, async (req, res) => {
    try {
        const [rows] = await db.query("SELECT id, name, slug, avg_game_minutes, current_players FROM stations ORDER BY id");
        res.json(rows.map((row) => ({ ...row, avg_game_minutes: toNumber(row.avg_game_minutes) || 10, current_players: row.current_players || "" })));
    } catch (error) { sendDatabaseError(res, "Station query error:", error, "Stations could not be loaded."); }
});

app.get("/api/queue", requireUser, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT q.id, q.station_id, q.user_id, q.status, q.joined_at, u.username
             FROM queue_entries q JOIN users u ON u.id = q.user_id
             WHERE q.status IN ('waiting', 'playing')
             ORDER BY (q.status = 'playing') DESC, q.joined_at ASC, q.id ASC`
        );
        res.json(rows);
    } catch (error) { sendDatabaseError(res, "Queue query error:", error, "The queue could not be loaded."); }
});

app.get("/api/news", requireUser, async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT MIN(id) AS id, title, DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date FROM news GROUP BY title, event_date ORDER BY event_date DESC, id DESC"
        );
        res.json(rows);
    } catch (error) { sendDatabaseError(res, "News query error:", error, "News could not be loaded."); }
});

app.get("/api/rules", requireUser, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT MIN(id) AS id, rule_key, TRIM(section) AS section, body,
                    MIN(section_order) AS section_order, MIN(rule_order) AS rule_order
             FROM rules
             GROUP BY rule_key, TRIM(section), body
             ORDER BY section_order, rule_order, id`
        );
        res.json(rows);
    } catch (error) { sendDatabaseError(res, "Rules query error:", error, "Rules could not be loaded."); }
});

app.get("/api/stats/:userId", requireUser, async (req, res) => {
    const requestedId = Number(req.params.userId);
    const userId = ["main_admin", "temp_admin"].includes(req.user.role) && requestedId ? requestedId : req.user.id;
    try {
        const [rows] = await db.query(
            `SELECT COUNT(*) AS played, COALESCE(SUM(m.winner_id = ?), 0) AS wins,
                    COALESCE(SUM(m.loser_id = ?), 0) AS losses,
                    COALESCE(SUM(m.winner_id = ? AND s.slug = 'pool'), 0) AS pool_wins,
                    COALESCE(SUM(m.loser_id = ? AND s.slug = 'pool'), 0) AS pool_losses,
                    COALESCE(SUM(m.winner_id = ? AND s.slug = 'table-tennis'), 0) AS tennis_wins,
                    COALESCE(SUM(m.loser_id = ? AND s.slug = 'table-tennis'), 0) AS tennis_losses
             FROM matches m JOIN stations s ON s.id = m.station_id
             WHERE m.winner_id = ? OR m.loser_id = ?`,
            [userId, userId, userId, userId, userId, userId, userId, userId]
        );
        const row = rows[0] || {};
        res.json(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, toNumber(value)])));
    } catch (error) { sendDatabaseError(res, "Stats query error:", error, "Statistics could not be loaded."); }
});

app.get("/api/matches/:userId", requireUser, async (req, res) => {
    const requestedId = Number(req.params.userId);
    const userId = ["main_admin", "temp_admin"].includes(req.user.role) && requestedId ? requestedId : req.user.id;
    try {
        const [rows] = await db.query(
            `SELECT m.id, s.name AS station, DATE_FORMAT(m.played_on, '%Y-%m-%d') AS played_on,
                    IF(m.winner_id = ?, loser.username, winner.username) AS opponent,
                    IF(m.winner_id = ?, 'Win', 'Loss') AS result
             FROM matches m JOIN stations s ON s.id = m.station_id
             JOIN users winner ON winner.id = m.winner_id JOIN users loser ON loser.id = m.loser_id
             WHERE m.winner_id = ? OR m.loser_id = ? ORDER BY m.played_on DESC, m.id DESC`,
            [userId, userId, userId, userId]
        );
        res.json(rows);
    } catch (error) { sendDatabaseError(res, "Match history query error:", error, "Match history could not be loaded."); }
});

// ==========================================================
// QUEUE ACTIONS
// ==========================================================

app.post("/api/queue/:action", requireUser, async (req, res) => {
    const action = req.params.action;
    const stationId = Number(req.body.stationId);
    const targetUserId = Number(req.body.userId) || req.user.id;
    const adminAction = ["send-to-back", "start-playing", "remove"].includes(action);

    if (!["join", "leave", "send-to-back", "start-playing", "remove"].includes(action) || !stationId) {
        return res.status(400).json({ message: "Invalid queue request." });
    }
    if (adminAction && !["main_admin", "temp_admin"].includes(req.user.role)) {
        return res.status(403).json({ message: "Only an admin can manage the queue." });
    }
    if (!adminAction && targetUserId !== req.user.id) {
        return res.status(403).json({ message: "You can only change your own queue place." });
    }

    try {
        const [stations] = await db.query("SELECT id FROM stations WHERE id = ?", [stationId]);
        if (stations.length === 0) return res.status(404).json({ message: "That game table no longer exists." });

        if (action === "join") {
            await db.query(
                `INSERT INTO queue_entries (station_id, user_id, status)
                 VALUES (?, ?, 'waiting')
                 ON DUPLICATE KEY UPDATE status = IF(status = 'playing', status, 'waiting')`,
                [stationId, req.user.id]
            );
        } else if (action === "leave" || action === "remove") {
            await db.query("DELETE FROM queue_entries WHERE station_id = ? AND user_id = ?", [stationId, targetUserId]);
        } else if (action === "send-to-back") {
            await db.query(
                "UPDATE queue_entries SET joined_at = CURRENT_TIMESTAMP, status = 'waiting' WHERE station_id = ? AND user_id = ?",
                [stationId, targetUserId]
            );
        } else if (action === "start-playing") {
            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();
                await connection.query("UPDATE queue_entries SET status = 'waiting' WHERE station_id = ? AND status = 'playing'", [stationId]);
                const [result] = await connection.query(
                    "UPDATE queue_entries SET status = 'playing' WHERE station_id = ? AND user_id = ?",
                    [stationId, targetUserId]
                );
                if (result.affectedRows === 0) throw new Error("Player is not in this queue.");
                await connection.commit();
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally { connection.release(); }
        }
        res.json({ ok: true });
    } catch (error) { sendDatabaseError(res, "Queue update error:", error, "The queue could not be updated."); }
});

app.post("/api/matches", requireUser, requireQueueAdmin, async (req, res) => {
    const stationId = Number(req.body.stationId);
    const winnerId = Number(req.body.winnerId);
    const loserId = Number(req.body.loserId);
    if (!stationId || !winnerId || !loserId || winnerId === loserId) {
        return res.status(400).json({ message: "Choose two different players and a game table." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [players] = await connection.query(
            "SELECT user_id FROM queue_entries WHERE station_id = ? AND user_id IN (?, ?) FOR UPDATE",
            [stationId, winnerId, loserId]
        );
        if (players.length !== 2) {
            await connection.rollback();
            return res.status(400).json({ message: "Both players must be in this queue." });
        }
        await connection.query("INSERT INTO matches (station_id, winner_id, loser_id) VALUES (?, ?, ?)", [stationId, winnerId, loserId]);
        await connection.query("DELETE FROM queue_entries WHERE station_id = ? AND user_id IN (?, ?)", [stationId, winnerId, loserId]);
        await connection.commit();
        res.status(201).json({ ok: true });
    } catch (error) {
        await connection.rollback();
        sendDatabaseError(res, "Match result error:", error, "The game result could not be recorded.");
    } finally { connection.release(); }
});

app.use("/api", (req, res) => res.status(404).json({ message: "That Dragon Queue address does not exist." }));
app.use((error, req, res, next) => {
    console.error("Unexpected server error:", error.message);
    if (res.headersSent) return next(error);
    res.status(500).json({ message: "Something unexpected happened. Please try again." });
});
app.listen(PORT, "0.0.0.0", () => console.log(`Dragon Queue server is running on port ${PORT}`));
