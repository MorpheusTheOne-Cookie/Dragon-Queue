// ==========================================================
// IMPORTS
// ==========================================================

require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");

const db = require("./database");


// ==========================================================
// EXPRESS SETUP
// ==========================================================

const app = express();

const PORT = process.env.PORT || 3000;


// ==========================================================
// MIDDLEWARE
// ==========================================================

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


// ==========================================================
// HELPERS
// ==========================================================

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sendDatabaseError(res, label, error, message) {
    console.error(label, error.message);
    res.status(500).json({ message: message });
}


// ==========================================================
// PASSWORD HASHING
// ==========================================================

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");

    return salt + ":" + hash;
}

function verifyPassword(password, savedPassword) {
    if (!savedPassword || !savedPassword.includes(":")) {
        return false;
    }

    const parts = savedPassword.split(":");
    const salt = parts[0];
    const savedHash = Buffer.from(parts[1], "hex");

    if (savedHash.length !== 64) {
        return false;
    }

    const suppliedHash = crypto.scryptSync(password, salt, 64);

    return crypto.timingSafeEqual(savedHash, suppliedHash);
}


// ==========================================================
// SERVER HEALTH ROUTE
// ==========================================================

app.get("/api/health", (req, res) => {
    res.json({ message: "Dragon Queue server is running!" });
});


// ==========================================================
// DATABASE TEST ROUTE
// ==========================================================

app.get("/api/db-test", async (req, res) => {
    try {
        const [result] = await db.query("SELECT 1 AS connected");

        res.json({
            message: "Dragon Queue database connected successfully!",
            result: result
        });
    } catch (error) {
        sendDatabaseError(res, "Database connection error:", error, "Could not connect to the database.");
    }
});


// ==========================================================
// LOGIN OR REGISTER
// ==========================================================

app.post("/api/login", async (req, res) => {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const mode = req.body.mode === "login" ? "login" : "register";

    if (!looksLikeEmail(email) || password.length < 8) {
        return res.status(400).json({
            message: "Enter a valid email and a password of at least 8 characters."
        });
    }

    if (mode === "register" && (username.length < 2 || username.length > 50)) {
        return res.status(400).json({ message: "Choose a username between 2 and 50 characters." });
    }

    try {
        // ------------------------------------------------------
        // Logging in to an existing account
        // ------------------------------------------------------
        if (mode === "login") {
            const [users] = await db.query(
                `SELECT id, username, email, title, password_hash
                 FROM users
                 WHERE email = ?
                 LIMIT 1`,
                [email]
            );

            if (users.length === 0) {
                return res.status(401).json({ message: "Email or password is incorrect." });
            }

            const existingUser = users[0];

            if (!verifyPassword(password, existingUser.password_hash)) {
                return res.status(401).json({ message: "Email or password is incorrect." });
            }

            return res.json({
                id: existingUser.id,
                username: existingUser.username,
                email: existingUser.email,
                title: existingUser.title
            });
        }

        // ------------------------------------------------------
        // Creating a new account
        // ------------------------------------------------------
        const [existingUsers] = await db.query(
            `SELECT id, username, email
             FROM users
             WHERE email = ? OR username = ?
             LIMIT 1`,
            [email, username]
        );

        if (existingUsers.length > 0) {
            const existingUser = existingUsers[0];

            if (existingUser.email === email) {
                return res.status(409).json({ message: "An account already uses this email address." });
            }

            return res.status(409).json({ message: "That username is already taken." });
        }

        const passwordHash = hashPassword(password);

        const [result] = await db.query(
            `INSERT INTO users (username, email, password_hash, title)
             VALUES (?, ?, ?, 'Student')`,
            [username, email, passwordHash]
        );

        return res.status(201).json({
            id: result.insertId,
            username: username,
            email: email,
            title: "Student"
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "That email or username is already taken." });
        }

        console.error("Login/register database error:", error.message);
        return res.status(500).json({ message: "The account could not be processed." });
    }
});


// ==========================================================
// STATIONS
// ==========================================================

app.get("/api/stations", async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, name, slug, avg_game_minutes, current_players
             FROM stations
             ORDER BY id`
        );

        const stations = rows.map((station) => ({
            id: station.id,
            name: station.name,
            slug: station.slug,
            avg_game_minutes: toNumber(station.avg_game_minutes) || 10,
            current_players: station.current_players || ""
        }));

        res.json(stations);
    } catch (error) {
        sendDatabaseError(res, "Station query error:", error, "Stations could not be loaded.");
    }
});


// ==========================================================
// THE QUEUE
// ==========================================================

app.get("/api/queue", async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT q.id, q.station_id, q.user_id, q.status, q.joined_at, u.username
             FROM queue_entries q
             JOIN users u ON u.id = q.user_id
             WHERE q.status IN ('waiting', 'playing')
             ORDER BY (q.status = 'playing') DESC, q.joined_at ASC, q.id ASC`
        );

        res.json(rows);
    } catch (error) {
        sendDatabaseError(res, "Queue query error:", error, "The queue could not be loaded.");
    }
});


// ==========================================================
// NEWS AND RULES
// ==========================================================

app.get("/api/news", async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT MIN(id) AS id, title, DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date
             FROM news
             GROUP BY title, event_date
             ORDER BY event_date DESC, id DESC`
        );

        res.json(rows);
    } catch (error) {
        sendDatabaseError(res, "News query error:", error, "News could not be loaded.");
    }
});

app.get(
    "/api/rules",
    async (req, res) => {

        try {

            const [rows] =
                await db.query(
                    `SELECT
                        id,
                        rule_key,
                        section,
                        body,
                        section_order,
                        rule_order
                     FROM rules
                     ORDER BY
                        section_order ASC,
                        rule_order ASC,
                        id ASC`
                );


            res.json(
                rows
            );

        } catch (error) {

            sendDatabaseError(
                res,
                "Rules query error:",
                error,
                "Rules could not be loaded."
            );

        }

    }
);


// ==========================================================
// PROFILE STATISTICS
// ==========================================================

app.get("/api/stats/:userId", async (req, res) => {
    const userId = Number(req.params.userId);

    if (!userId) {
        return res.status(400).json({ message: "A valid user id is required." });
    }

    try {
        const [rows] = await db.query(
            `SELECT
                COUNT(*) AS played,
                SUM(m.winner_id = ?) AS wins,
                SUM(m.loser_id = ?) AS losses,
                SUM(m.winner_id = ? AND s.slug = 'pool') AS pool_wins,
                SUM(m.loser_id  = ? AND s.slug = 'pool') AS pool_losses,
                SUM(m.winner_id = ? AND s.slug = 'table-tennis') AS tennis_wins,
                SUM(m.loser_id  = ? AND s.slug = 'table-tennis') AS tennis_losses
             FROM matches m
             JOIN stations s ON s.id = m.station_id
             WHERE m.winner_id = ? OR m.loser_id = ?`,
            [userId, userId, userId, userId, userId, userId, userId, userId]
        );

        const stats = rows[0] || {};

        res.json({
            played: toNumber(stats.played),
            wins: toNumber(stats.wins),
            losses: toNumber(stats.losses),
            pool_wins: toNumber(stats.pool_wins),
            pool_losses: toNumber(stats.pool_losses),
            tennis_wins: toNumber(stats.tennis_wins),
            tennis_losses: toNumber(stats.tennis_losses)
        });
    } catch (error) {
        sendDatabaseError(res, "Stats query error:", error, "Statistics could not be loaded.");
    }
});


// ==========================================================
// MATCH HISTORY
// ==========================================================

app.get("/api/matches/:userId", async (req, res) => {
    const userId = Number(req.params.userId);

    if (!userId) {
        return res.status(400).json({ message: "A valid user id is required." });
    }

    try {
        const [rows] = await db.query(
            `SELECT
                m.id,
                s.name AS station,
                DATE_FORMAT(m.played_on, '%Y-%m-%d') AS played_on,
                IF(m.winner_id = ?, loser.username, winner.username) AS opponent,
                IF(m.winner_id = ?, 'Win', 'Loss') AS result
             FROM matches m
             JOIN stations s ON s.id = m.station_id
             JOIN users winner ON winner.id = m.winner_id
             JOIN users loser ON loser.id = m.loser_id
             WHERE m.winner_id = ? OR m.loser_id = ?
             ORDER BY m.played_on DESC, m.id DESC`,
            [userId, userId, userId, userId]
        );

        res.json(rows);
    } catch (error) {
        sendDatabaseError(res, "Match history query error:", error, "Match history could not be loaded.");
    }
});


// ==========================================================
// QUEUE ACTIONS
// ==========================================================

app.post("/api/queue/:action", async (req, res) => {
    const action = req.params.action;
    const stationId = Number(req.body.stationId);
    const userId = Number(req.body.userId);

    if (!["join", "leave", "send-to-back"].includes(action) || !stationId || !userId) {
        return res.status(400).json({ message: "Invalid queue request." });
    }

    try {
        if (action === "join") {
            const [stations] = await db.query("SELECT id FROM stations WHERE id = ?", [stationId]);
            const [users] = await db.query("SELECT id FROM users WHERE id = ?", [userId]);

            if (stations.length === 0 || users.length === 0) {
                return res.status(404).json({ message: "That table or account no longer exists." });
            }

            const [existing] = await db.query(
                "SELECT id FROM queue_entries WHERE station_id = ? AND user_id = ?",
                [stationId, userId]
            );

            if (existing.length === 0) {
                await db.query(
                    "INSERT INTO queue_entries (station_id, user_id, status) VALUES (?, ?, 'waiting')",
                    [stationId, userId]
                );
            }
        }

        if (action === "leave") {
            await db.query(
                "DELETE FROM queue_entries WHERE station_id = ? AND user_id = ?",
                [stationId, userId]
            );
        }

        if (action === "send-to-back") {
            await db.query(
                `UPDATE queue_entries
                 SET joined_at = CURRENT_TIMESTAMP, status = 'waiting'
                 WHERE station_id = ? AND user_id = ?`,
                [stationId, userId]
            );
        }

        return res.json({ ok: true });
    } catch (error) {
        console.error("Queue update error:", error.message);
        return res.status(500).json({ message: "The queue could not be updated." });
    }
});


// ==========================================================
// UNKNOWN API ROUTES
// ==========================================================

app.use("/api", (req, res) => {
    res.status(404).json({ message: "That Dragon Queue address does not exist." });
});


// ==========================================================
// START SERVER
// ==========================================================

app.listen(PORT, () => {
    console.log(`Dragon Queue server running at http://localhost:${PORT}`);
});
