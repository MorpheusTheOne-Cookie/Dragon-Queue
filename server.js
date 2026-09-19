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
const ADMIN_ROLES = new Set(["temp_admin", "main_admin"]);

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
        title: user.title,
        role: user.title
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

async function getSessionUser(req) {
    const token = readCookie(req, COOKIE_NAME);
    if (!token) return null;

    const [rows] = await db.query(
        `SELECT u.id, u.username, u.title
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > NOW()
         LIMIT 1`,
        [hashToken(token)]
    );

    return rows[0] || null;
}

function isAdmin(user) {
    return Boolean(user && ADMIN_ROLES.has(user.title));
}

async function requireUser(req, res, next) {
    try {
        const user = await getSessionUser(req);

        if (!user) {
            res.setHeader("Set-Cookie", clearSessionCookie());
            return res.status(401).json({ message: "Please log in again." });
        }

        req.user = user;
        next();

    } catch (error) {
        sendDatabaseError(res, "Session check error:", error, "Your login could not be checked.");
    }
}

function requireAdmin(req, res, next) {
    requireUser(req, res, () => {
        if (!isAdmin(req.user)) {
            return res.status(403).json({ message: "Administrator access is required." });
        }

        next();
    });
}

async function requireAdminPage(req, res, next) {
    try {
        const user = await getSessionUser(req);

        if (!user) {
            res.setHeader("Set-Cookie", clearSessionCookie());
            return res.redirect("/admin-login.html");
        }

        if (!isAdmin(user)) {
            return res.redirect("/main.html");
        }

        req.user = user;
        next();

    } catch (error) {
        console.error("Admin page session check error:", error.message);
        res.status(500).send("The admin session could not be checked.");
    }
}

// ==========================================================
// HEALTH, LOGIN AND LOGOUT
// ==========================================================

app.get("/api/health", async (req, res) => {
    try {
        await db.query("SELECT 1");
        res.json({ message: "Dragon Queue server and database are running." });
    } catch (error) {

        console.error("Database health check failed:", error.message);

        res.status(503).json({ message: "The database is not available." });
    }
});

app.post("/api/login", loginLimiter, async (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const mode = req.body.mode === "login" ? "login" : "register";

    // Username is now the only account identifier.
    if (username.length < 2 || username.length > 50) {
        return res.status(400).json({ message: "Enter a username between 2 and 50 characters." });
    }

    if (password.length < 8 || password.length > 128) {
        return res.status(400).json({ message: "Enter a password of 8 to 128 characters." });
    }

    try {
        if (mode === "login") {
            const [users] = await db.query(
                `SELECT id, username, title, password_hash
                 FROM users
                 WHERE username = ?
                 LIMIT 1`,
                [username]
            );

            if (users.length === 0 || !verifyPassword(password, users[0].password_hash)) {
                return res.status(401).json({ message: "Username or password is incorrect." });
            }

            await createSession(res, users[0].id);
            return res.json(publicUser(users[0]));
        }

        const [existing] = await db.query(
            "SELECT id FROM users WHERE username = ? LIMIT 1",
            [username]
        );

        if (existing.length > 0) {
            return res.status(409).json({ message: "That username is already taken." });
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.query(
                "INSERT INTO users (username, password_hash, title) VALUES (?, ?, 'student')",
                [username, hashPassword(password)]
            );

            await connection.commit();
            await createSession(res, result.insertId);

            return res.status(201).json({
                id: result.insertId,
                username,
                title: "student",
                role: "student"
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "That username is already taken." });
        }

        sendDatabaseError(res, "Login/register error:", error, "The account could not be processed.");
    }
});

// ==========================================================
// ADMIN LOGIN AND ACCESS
// ==========================================================

app.post("/api/admin/login", loginLimiter, async (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (username.length < 2 || username.length > 50) {
        return res.status(400).json({ message: "Enter your admin username." });
    }

    if (password.length < 8 || password.length > 128) {
        return res.status(400).json({ message: "Enter your admin password." });
    }

    try {
        const [users] = await db.query(
            `SELECT id, username, title, password_hash
             FROM users
             WHERE username = ?
             LIMIT 1`,
            [username]
        );

        if (users.length === 0 || !verifyPassword(password, users[0].password_hash)) {
            return res.status(401).json({ message: "Admin username or password is incorrect." });
        }

        if (!isAdmin(users[0])) {
            return res.status(403).json({ message: "This account does not have administrator access." });
        }

        await createSession(res, users[0].id);
        return res.json(publicUser(users[0]));

    } catch (error) {
        sendDatabaseError(res, "Admin login error:", error, "The admin login could not be processed.");
    }
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
    res.json(publicUser(req.user));
});

// Goal 3: one protected, read-only endpoint for the admin dashboard.
// It returns the current station, game and queue state but does not modify anything
// other than the normal queue scheduler/expired-confirmation housekeeping that the
// student dashboard already performs when it reads current games.
app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
    try {
        // Keep the data current before we show it to an administrator.
        await processExpiredConfirmations();
        await ensureStationsScheduled();

        const [stations] = await db.query(
            `SELECT id, name, slug, avg_game_minutes
             FROM stations
             ORDER BY id`
        );

        const [games] = await db.query(
            `SELECT g.station_id,
                    g.status,
                    g.player_a_id,
                    player_a.username AS player_a_username,
                    g.player_b_id,
                    player_b.username AS player_b_username,
                    g.player_a_confirmed,
                    g.player_b_confirmed,
                    g.player_a_result,
                    g.player_b_result,
                    g.confirmation_deadline,
                    g.started_at,
                    CASE
                        WHEN g.confirmation_deadline IS NULL THEN NULL
                        ELSE GREATEST(TIMESTAMPDIFF(SECOND, NOW(), g.confirmation_deadline), 0)
                    END AS confirmation_seconds_left
             FROM active_games g
             JOIN users player_a ON player_a.id = g.player_a_id
             LEFT JOIN users player_b ON player_b.id = g.player_b_id
             ORDER BY g.station_id`
        );

        const [queueEntries] = await db.query(
            `SELECT q.id, q.station_id, q.user_id, q.status, q.joined_at, u.username
             FROM queue_entries q
             JOIN users u ON u.id = q.user_id
             WHERE q.status IN ('waiting', 'called', 'playing', 'postgame')
             ORDER BY q.station_id,
                      FIELD(q.status, 'playing', 'called', 'waiting', 'postgame'),
                      q.joined_at ASC,
                      q.id ASC`
        );

        const gameByStation = new Map();

        for (const row of games) {
            gameByStation.set(toNumber(row.station_id), {
                station_id: toNumber(row.station_id),
                status: row.status,
                player_a_id: toNumber(row.player_a_id),
                player_a_username: row.player_a_username,
                player_b_id: row.player_b_id === null ? null : toNumber(row.player_b_id),
                player_b_username: row.player_b_username || null,
                player_a_confirmed: Boolean(toNumber(row.player_a_confirmed)),
                player_b_confirmed: Boolean(toNumber(row.player_b_confirmed)),
                player_a_result: row.player_a_result || null,
                player_b_result: row.player_b_result || null,
                confirmation_deadline: row.confirmation_deadline || null,
                started_at: row.started_at || null,
                confirmation_seconds_left: row.confirmation_seconds_left === null
                    ? null
                    : toNumber(row.confirmation_seconds_left)
            });
        }

        const stationData = stations.map((station) => {
            const stationId = toNumber(station.id);
            const game = gameByStation.get(stationId) || null;
            const playerIds = new Set();

            if (game) {
                if (game.player_a_id) playerIds.add(game.player_a_id);
                if (game.player_b_id) playerIds.add(game.player_b_id);
            }

            // Current/called players already appear in the match panel, so do not
            // duplicate them in the waiting-list portion of the admin dashboard.
            const queue = queueEntries
                .filter((entry) => toNumber(entry.station_id) === stationId)
                .filter((entry) => !playerIds.has(toNumber(entry.user_id)))
                .map((entry) => ({
                    id: toNumber(entry.id),
                    user_id: toNumber(entry.user_id),
                    username: entry.username,
                    status: entry.status,
                    joined_at: entry.joined_at
                }));

            const waitingCount = queueEntries.filter((entry) =>
                toNumber(entry.station_id) === stationId && entry.status === "waiting"
            ).length;

            return {
                id: stationId,
                name: station.name,
                slug: station.slug,
                avg_game_minutes: toNumber(station.avg_game_minutes) || 10,
                waiting_count: waitingCount,
                game,
                queue
            };
        });

        res.json({
            admin: publicUser(req.user),
            refreshed_at: new Date().toISOString(),
            stations: stationData
        });

    } catch (error) {
        sendDatabaseError(
            res,
            "Admin dashboard query error:",
            error,
            "The admin dashboard could not be loaded."
        );
    }
});

app.get("/admin", requireAdminPage, (req, res) => {
    res.sendFile(path.join(__dirname, "private", "admin.html"));
});

app.get("/api/me", requireUser, (req, res) => res.json(publicUser(req.user)));

app.post("/api/logout", async (req, res) => {
    const token = readCookie(req, COOKIE_NAME);
    if (token) await db.query("DELETE FROM user_sessions WHERE token_hash = ?", [hashToken(token)]).catch(() => { });
    res.setHeader("Set-Cookie", clearSessionCookie());
    res.json({ ok: true });
});

// ==========================================================
// DATABASE TEST
// ==========================================================

app.get("/api/db-test", async (req, res) => {
    try {
        const [result] = await db.query(
            "SELECT 1 AS connected"
        );

        res.json({
            message:
                "Dragon Queue database connected successfully!",
            result: result
        });

    } catch (error) {
        console.error(
            "Database connection error:",
            error.message
        );

        res.status(500).json({
            message:
                "Could not connect to the database."
        });
    }
});

// ==========================================================
// GAME / QUEUE HELPERS
// ==========================================================

const CONFIRMATION_MINUTES = 10;

async function getActiveGame(connection, stationId) {
    const [rows] = await connection.query(
        "SELECT * FROM active_games WHERE station_id = ? FOR UPDATE",
        [stationId]
    );

    return rows[0] || null;
}

async function getWaitingPlayers(connection, stationId, excludedUserIds = []) {
    const parameters = [stationId];
    let sql = `SELECT id, user_id, joined_at
               FROM queue_entries
               WHERE station_id = ? AND status = 'waiting'`;

    if (excludedUserIds.length > 0) {
        sql += ` AND user_id NOT IN (${excludedUserIds.map(() => "?").join(", ")})`;
        parameters.push(...excludedUserIds);
    }

    sql += " ORDER BY joined_at ASC, id ASC FOR UPDATE";

    const [rows] = await connection.query(sql, parameters);
    return rows;
}

async function scheduleStation(connection, stationId) {
    const game = await getActiveGame(connection, stationId);

    if (!game) {
        const waiting = await getWaitingPlayers(connection, stationId);

        if (waiting.length < 2) {
            return;
        }

        const playerA = waiting[0].user_id;
        const playerB = waiting[1].user_id;

        await connection.query(
            "UPDATE queue_entries SET status = 'called' WHERE station_id = ? AND user_id IN (?, ?)",
            [stationId, playerA, playerB]
        );

        await connection.query(
            `INSERT INTO active_games (
                station_id,
                player_a_id,
                player_b_id,
                status,
                player_a_confirmed,
                player_b_confirmed,
                confirmation_deadline
             ) VALUES (?, ?, ?, 'confirming', 0, 0, DATE_ADD(NOW(), INTERVAL ${CONFIRMATION_MINUTES} MINUTE))`,
            [stationId, playerA, playerB]
        );

        return;
    }

    if (game.status !== "waiting_for_opponent") {
        return;
    }

    const waiting = await getWaitingPlayers(connection, stationId, [game.player_a_id]);

    if (waiting.length === 0) {
        return;
    }

    const challengerId = waiting[0].user_id;

    await connection.query(
        "UPDATE queue_entries SET status = 'called' WHERE station_id = ? AND user_id = ?",
        [stationId, challengerId]
    );

    await connection.query(
        `UPDATE active_games
         SET player_b_id = ?,
             status = 'confirming',
             player_a_confirmed = 1,
             player_b_confirmed = 0,
             player_a_result = NULL,
             player_b_result = NULL,
             confirmation_deadline = DATE_ADD(NOW(), INTERVAL ${CONFIRMATION_MINUTES} MINUTE),
             started_at = NULL
         WHERE station_id = ?`,
        [challengerId, stationId]
    );
}

async function expireConfirmationForStation(stationId) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const game = await getActiveGame(connection, stationId);

        if (!game || game.status !== "confirming" || !game.confirmation_deadline) {
            await connection.commit();
            return;
        }

        const [deadlineRows] = await connection.query(
            "SELECT confirmation_deadline <= NOW() AS expired FROM active_games WHERE station_id = ?",
            [stationId]
        );

        if (!deadlineRows[0] || !toNumber(deadlineRows[0].expired)) {
            await connection.commit();
            return;
        }

        const unconfirmedIds = [];
        const confirmed = [];

        if (game.player_a_id) {
            if (toNumber(game.player_a_confirmed)) {
                confirmed.push(game.player_a_id);
            } else {
                unconfirmedIds.push(game.player_a_id);
            }
        }

        if (game.player_b_id) {
            if (toNumber(game.player_b_confirmed)) {
                confirmed.push(game.player_b_id);
            } else {
                unconfirmedIds.push(game.player_b_id);
            }
        }

        for (const userId of unconfirmedIds) {
            await connection.query(
                `UPDATE queue_entries
                 SET status = 'waiting', joined_at = CURRENT_TIMESTAMP
                 WHERE station_id = ? AND user_id = ?`,
                [stationId, userId]
            );
        }

        if (confirmed.length === 0) {
            await connection.query("DELETE FROM active_games WHERE station_id = ?", [stationId]);
            await scheduleStation(connection, stationId);
            await connection.commit();
            return;
        }

        const keeperId = confirmed[0];
        const [keeperRows] = await connection.query(
            "SELECT status FROM queue_entries WHERE station_id = ? AND user_id = ? FOR UPDATE",
            [stationId, keeperId]
        );
        const keeperStatus = keeperRows[0] ? keeperRows[0].status : "waiting";
        const waiting = await getWaitingPlayers(connection, stationId, [keeperId]);

        if (waiting.length > 0) {
            const challengerId = waiting[0].user_id;

            await connection.query(
                "UPDATE queue_entries SET status = 'called' WHERE station_id = ? AND user_id = ?",
                [stationId, challengerId]
            );

            if (keeperStatus !== "playing") {
                await connection.query(
                    "UPDATE queue_entries SET status = 'called' WHERE station_id = ? AND user_id = ?",
                    [stationId, keeperId]
                );
            }

            await connection.query(
                `UPDATE active_games
                 SET player_a_id = ?,
                     player_b_id = ?,
                     status = 'confirming',
                     player_a_confirmed = 1,
                     player_b_confirmed = 0,
                     player_a_result = NULL,
                     player_b_result = NULL,
                     confirmation_deadline = DATE_ADD(NOW(), INTERVAL ${CONFIRMATION_MINUTES} MINUTE),
                     started_at = NULL
                 WHERE station_id = ?`,
                [keeperId, challengerId, stationId]
            );
        } else if (keeperStatus === "playing") {
            await connection.query(
                `UPDATE active_games
                 SET player_a_id = ?,
                     player_b_id = NULL,
                     status = 'waiting_for_opponent',
                     player_a_confirmed = 1,
                     player_b_confirmed = 0,
                     player_a_result = NULL,
                     player_b_result = NULL,
                     confirmation_deadline = NULL,
                     started_at = NULL
                 WHERE station_id = ?`,
                [keeperId, stationId]
            );
        } else {
            await connection.query(
                "UPDATE queue_entries SET status = 'waiting' WHERE station_id = ? AND user_id = ?",
                [stationId, keeperId]
            );
            await connection.query("DELETE FROM active_games WHERE station_id = ?", [stationId]);
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function processExpiredConfirmations() {
    const [rows] = await db.query(
        `SELECT station_id
         FROM active_games
         WHERE status = 'confirming'
           AND confirmation_deadline IS NOT NULL
           AND confirmation_deadline <= NOW()`
    );

    for (const row of rows) {
        await expireConfirmationForStation(row.station_id);
    }
}

async function ensureStationsScheduled() {
    const [stations] = await db.query("SELECT id FROM stations ORDER BY id");

    for (const station of stations) {
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();
            await scheduleStation(connection, station.id);
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

async function removePlayerFromActiveGame(connection, stationId, userId) {
    const game = await getActiveGame(connection, stationId);

    if (!game || (Number(game.player_a_id) !== Number(userId) && Number(game.player_b_id) !== Number(userId))) {
        return;
    }

    if (game.status === "playing") {
        throw new Error("ACTIVE_GAME_IN_PROGRESS");
    }

    const otherId = Number(game.player_a_id) === Number(userId)
        ? game.player_b_id
        : game.player_a_id;

    if (otherId) {
        const [otherRows] = await connection.query(
            "SELECT status FROM queue_entries WHERE station_id = ? AND user_id = ? FOR UPDATE",
            [stationId, otherId]
        );

        if (otherRows[0] && otherRows[0].status === "playing") {
            await connection.query(
                `UPDATE active_games
                 SET player_a_id = ?,
                     player_b_id = NULL,
                     status = 'waiting_for_opponent',
                     player_a_confirmed = 1,
                     player_b_confirmed = 0,
                     player_a_result = NULL,
                     player_b_result = NULL,
                     confirmation_deadline = NULL,
                     started_at = NULL
                 WHERE station_id = ?`,
                [otherId, stationId]
            );
            return;
        }

        await connection.query(
            "UPDATE queue_entries SET status = 'waiting' WHERE station_id = ? AND user_id = ?",
            [stationId, otherId]
        );
    }

    await connection.query("DELETE FROM active_games WHERE station_id = ?", [stationId]);
    await scheduleStation(connection, stationId);
}

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
             FROM queue_entries q
             JOIN users u ON u.id = q.user_id
             WHERE q.status IN ('waiting', 'called', 'playing', 'postgame')
             ORDER BY q.station_id,
                      FIELD(q.status, 'playing', 'called', 'waiting', 'postgame'),
                      q.joined_at ASC,
                      q.id ASC`
        );
        res.json(rows);
    } catch (error) { sendDatabaseError(res, "Queue query error:", error, "The queue could not be loaded."); }
});

app.get("/api/games", requireUser, async (req, res) => {
    try {
        await processExpiredConfirmations();
        await ensureStationsScheduled();

        const [rows] = await db.query(
            `SELECT g.station_id,
                    g.status,
                    g.player_a_id,
                    player_a.username AS player_a_username,
                    g.player_b_id,
                    player_b.username AS player_b_username,
                    g.player_a_confirmed,
                    g.player_b_confirmed,
                    g.player_a_result,
                    g.player_b_result,
                    g.confirmation_deadline,
                    g.started_at,
                    CASE
                        WHEN g.confirmation_deadline IS NULL THEN NULL
                        ELSE GREATEST(TIMESTAMPDIFF(SECOND, NOW(), g.confirmation_deadline), 0)
                    END AS confirmation_seconds_left
             FROM active_games g
             JOIN users player_a ON player_a.id = g.player_a_id
             LEFT JOIN users player_b ON player_b.id = g.player_b_id
             ORDER BY g.station_id`
        );

        res.json(rows.map((row) => ({
            ...row,
            player_a_confirmed: Boolean(toNumber(row.player_a_confirmed)),
            player_b_confirmed: Boolean(toNumber(row.player_b_confirmed)),
            confirmation_seconds_left: row.confirmation_seconds_left === null
                ? null
                : toNumber(row.confirmation_seconds_left)
        })));
    } catch (error) { sendDatabaseError(res, "Game query error:", error, "Current games could not be loaded."); }
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
    const userId = ["main_admin", "temp_admin"].includes(req.user.title) && requestedId ? requestedId : req.user.id;
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
    const userId = ["main_admin", "temp_admin"].includes(req.user.title) && requestedId ? requestedId : req.user.id;
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

    if (!["join", "leave", "requeue"].includes(action) || !stationId) {
        return res.status(400).json({ message: "Invalid queue request." });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [stations] = await connection.query("SELECT id FROM stations WHERE id = ? FOR UPDATE", [stationId]);
        if (stations.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "That game table no longer exists." });
        }

        const [entries] = await connection.query(
            "SELECT id, status FROM queue_entries WHERE station_id = ? AND user_id = ? FOR UPDATE",
            [stationId, req.user.id]
        );
        const entry = entries[0] || null;

        if (action === "join") {
            if (!entry) {
                await connection.query(
                    "INSERT INTO queue_entries (station_id, user_id, status) VALUES (?, ?, 'waiting')",
                    [stationId, req.user.id]
                );
            } else if (entry.status === "postgame") {
                await connection.query(
                    "UPDATE queue_entries SET status = 'waiting', joined_at = CURRENT_TIMESTAMP WHERE station_id = ? AND user_id = ?",
                    [stationId, req.user.id]
                );
            }

            await scheduleStation(connection, stationId);
        }

        if (action === "requeue") {
            if (!entry || entry.status !== "postgame") {
                await connection.rollback();
                return res.status(400).json({ message: "You can only requeue after your game has finished." });
            }

            await connection.query(
                "UPDATE queue_entries SET status = 'waiting', joined_at = CURRENT_TIMESTAMP WHERE station_id = ? AND user_id = ?",
                [stationId, req.user.id]
            );

            await scheduleStation(connection, stationId);
        }

        if (action === "leave") {
            if (!entry) {
                await connection.commit();
                return res.json({ ok: true });
            }

            if (entry.status === "playing") {
                const game = await getActiveGame(connection, stationId);

                if (game && game.status === "playing") {
                    await connection.rollback();
                    return res.status(409).json({ message: "Finish the current game and submit Win or Loss before leaving." });
                }
            }

            await removePlayerFromActiveGame(connection, stationId, req.user.id);
            await connection.query(
                "DELETE FROM queue_entries WHERE station_id = ? AND user_id = ?",
                [stationId, req.user.id]
            );
            await scheduleStation(connection, stationId);
        }

        await connection.commit();
        res.json({ ok: true });
    } catch (error) {
        await connection.rollback();

        if (error.message === "ACTIVE_GAME_IN_PROGRESS") {
            return res.status(409).json({ message: "Finish the current game and submit Win or Loss before leaving." });
        }

        sendDatabaseError(res, "Queue update error:", error, "The queue could not be updated.");
    } finally {
        connection.release();
    }
});

// ==========================================================
// PLAYER AVAILABILITY
// ==========================================================

app.post("/api/games/availability", requireUser, async (req, res) => {
    const stationId = Number(req.body.stationId);
    const available = req.body.available === true;

    if (!stationId) {
        return res.status(400).json({ message: "Choose a valid game table." });
    }

    await processExpiredConfirmations().catch(() => { });

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const game = await getActiveGame(connection, stationId);

        if (!game || game.status !== "confirming") {
            await connection.rollback();
            return res.status(409).json({ message: "This game is no longer waiting for confirmation." });
        }

        const isPlayerA = Number(game.player_a_id) === Number(req.user.id);
        const isPlayerB = Number(game.player_b_id) === Number(req.user.id);

        if (!isPlayerA && !isPlayerB) {
            await connection.rollback();
            return res.status(403).json({ message: "You are not one of the players called for this game." });
        }

        const alreadyConfirmed = isPlayerA
            ? Boolean(toNumber(game.player_a_confirmed))
            : Boolean(toNumber(game.player_b_confirmed));

        if (alreadyConfirmed && !available) {
            await connection.rollback();
            return res.status(409).json({ message: "You already confirmed that you are available." });
        }

        if (!available) {
            const otherId = isPlayerA ? game.player_b_id : game.player_a_id;
            const otherConfirmed = isPlayerA
                ? Boolean(toNumber(game.player_b_confirmed))
                : Boolean(toNumber(game.player_a_confirmed));

            await connection.query(
                `UPDATE queue_entries
                 SET status = 'waiting', joined_at = CURRENT_TIMESTAMP
                 WHERE station_id = ? AND user_id = ?`,
                [stationId, req.user.id]
            );

            const [otherRows] = await connection.query(
                "SELECT status FROM queue_entries WHERE station_id = ? AND user_id = ? FOR UPDATE",
                [stationId, otherId]
            );
            const otherStatus = otherRows[0] ? otherRows[0].status : "waiting";
            const waiting = await getWaitingPlayers(connection, stationId, [otherId, req.user.id]);

            if (waiting.length > 0) {
                const replacementId = waiting[0].user_id;

                await connection.query(
                    "UPDATE queue_entries SET status = 'called' WHERE station_id = ? AND user_id = ?",
                    [stationId, replacementId]
                );

                if (otherStatus !== "playing") {
                    await connection.query(
                        "UPDATE queue_entries SET status = 'called' WHERE station_id = ? AND user_id = ?",
                        [stationId, otherId]
                    );
                }

                await connection.query(
                    `UPDATE active_games
                     SET player_a_id = ?,
                         player_b_id = ?,
                         status = 'confirming',
                         player_a_confirmed = ?,
                         player_b_confirmed = 0,
                         player_a_result = NULL,
                         player_b_result = NULL,
                         confirmation_deadline = DATE_ADD(NOW(), INTERVAL ${CONFIRMATION_MINUTES} MINUTE),
                         started_at = NULL
                     WHERE station_id = ?`,
                    [otherId, replacementId, otherConfirmed ? 1 : 0, stationId]
                );
            } else if (otherStatus === "playing") {
                await connection.query(
                    `UPDATE active_games
                     SET player_a_id = ?,
                         player_b_id = NULL,
                         status = 'waiting_for_opponent',
                         player_a_confirmed = 1,
                         player_b_confirmed = 0,
                         player_a_result = NULL,
                         player_b_result = NULL,
                         confirmation_deadline = NULL,
                         started_at = NULL
                     WHERE station_id = ?`,
                    [otherId, stationId]
                );
            } else {
                await connection.query(
                    "UPDATE queue_entries SET status = 'waiting' WHERE station_id = ? AND user_id = ?",
                    [stationId, otherId]
                );
                await connection.query("DELETE FROM active_games WHERE station_id = ?", [stationId]);
            }

            await connection.commit();
            return res.json({ ok: true, skipped: true });
        }

        if (isPlayerA) {
            await connection.query(
                "UPDATE active_games SET player_a_confirmed = 1 WHERE station_id = ?",
                [stationId]
            );
        } else {
            await connection.query(
                "UPDATE active_games SET player_b_confirmed = 1 WHERE station_id = ?",
                [stationId]
            );
        }

        const [updatedRows] = await connection.query(
            "SELECT player_a_id, player_b_id, player_a_confirmed, player_b_confirmed FROM active_games WHERE station_id = ? FOR UPDATE",
            [stationId]
        );
        const updated = updatedRows[0];

        if (updated && updated.player_b_id && toNumber(updated.player_a_confirmed) && toNumber(updated.player_b_confirmed)) {
            await connection.query(
                `UPDATE active_games
                 SET status = 'playing', confirmation_deadline = NULL, started_at = NOW()
                 WHERE station_id = ?`,
                [stationId]
            );

            await connection.query(
                "UPDATE queue_entries SET status = 'playing' WHERE station_id = ? AND user_id IN (?, ?)",
                [stationId, updated.player_a_id, updated.player_b_id]
            );
        }

        await connection.commit();
        res.json({ ok: true, confirmed: true });
    } catch (error) {
        await connection.rollback();
        sendDatabaseError(res, "Availability update error:", error, "Your availability could not be saved.");
    } finally {
        connection.release();
    }
});

// ==========================================================
// MATCH RESULT - WINNER STAYS
// ==========================================================

app.post("/api/games/result", requireUser, async (req, res) => {
    const stationId = Number(req.body.stationId);
    const result = req.body.result === "win" ? "win" : req.body.result === "loss" ? "loss" : "";

    if (!stationId || !result) {
        return res.status(400).json({ message: "Choose Win or Loss for a valid game table." });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const game = await getActiveGame(connection, stationId);

        if (!game || game.status !== "playing" || !game.player_b_id) {
            await connection.rollback();
            return res.status(409).json({ message: "There is no active two-player game to report." });
        }

        const isPlayerA = Number(game.player_a_id) === Number(req.user.id);
        const isPlayerB = Number(game.player_b_id) === Number(req.user.id);

        if (!isPlayerA && !isPlayerB) {
            await connection.rollback();
            return res.status(403).json({ message: "Only the two current players can report this result." });
        }

        const otherResult = isPlayerA ? game.player_b_result : game.player_a_result;

        if (otherResult && otherResult === result) {
            await connection.rollback();
            return res.status(409).json({
                message: result === "win"
                    ? "Both players cannot report a win. One player must choose Loss."
                    : "Both players cannot report a loss. One player must choose Win."
            });
        }

        if (isPlayerA) {
            await connection.query(
                "UPDATE active_games SET player_a_result = ? WHERE station_id = ?",
                [result, stationId]
            );
        } else {
            await connection.query(
                "UPDATE active_games SET player_b_result = ? WHERE station_id = ?",
                [result, stationId]
            );
        }

        const [updatedRows] = await connection.query(
            "SELECT * FROM active_games WHERE station_id = ? FOR UPDATE",
            [stationId]
        );
        const updated = updatedRows[0];

        if (!updated.player_a_result || !updated.player_b_result) {
            await connection.commit();
            return res.json({ ok: true, finalized: false, message: "Result saved. Waiting for the other player." });
        }

        if (updated.player_a_result === updated.player_b_result) {
            await connection.rollback();
            return res.status(409).json({ message: "The players must submit opposite results: one Win and one Loss." });
        }

        const winnerId = updated.player_a_result === "win" ? updated.player_a_id : updated.player_b_id;
        const loserId = updated.player_a_result === "loss" ? updated.player_a_id : updated.player_b_id;

        await connection.query(
            "INSERT INTO matches (station_id, winner_id, loser_id) VALUES (?, ?, ?)",
            [stationId, winnerId, loserId]
        );

        await connection.query(
            "UPDATE queue_entries SET status = 'playing' WHERE station_id = ? AND user_id = ?",
            [stationId, winnerId]
        );

        await connection.query(
            "UPDATE queue_entries SET status = 'postgame' WHERE station_id = ? AND user_id = ?",
            [stationId, loserId]
        );

        const waiting = await getWaitingPlayers(connection, stationId, [winnerId, loserId]);

        if (waiting.length > 0) {
            const challengerId = waiting[0].user_id;

            await connection.query(
                "UPDATE queue_entries SET status = 'called' WHERE station_id = ? AND user_id = ?",
                [stationId, challengerId]
            );

            await connection.query(
                `UPDATE active_games
                 SET player_a_id = ?,
                     player_b_id = ?,
                     status = 'confirming',
                     player_a_confirmed = 1,
                     player_b_confirmed = 0,
                     player_a_result = NULL,
                     player_b_result = NULL,
                     confirmation_deadline = DATE_ADD(NOW(), INTERVAL ${CONFIRMATION_MINUTES} MINUTE),
                     started_at = NULL
                 WHERE station_id = ?`,
                [winnerId, challengerId, stationId]
            );
        } else {
            await connection.query(
                `UPDATE active_games
                 SET player_a_id = ?,
                     player_b_id = NULL,
                     status = 'waiting_for_opponent',
                     player_a_confirmed = 1,
                     player_b_confirmed = 0,
                     player_a_result = NULL,
                     player_b_result = NULL,
                     confirmation_deadline = NULL,
                     started_at = NULL
                 WHERE station_id = ?`,
                [winnerId, stationId]
            );
        }

        await connection.commit();
        res.json({
            ok: true,
            finalized: true,
            winnerId,
            loserId,
            outcome: Number(req.user.id) === Number(winnerId) ? "win" : "loss"
        });
    } catch (error) {
        await connection.rollback();
        sendDatabaseError(res, "Match result error:", error, "The game result could not be recorded.");
    } finally {
        connection.release();
    }
});

app.use("/api", (req, res) => res.status(404).json({ message: "That Dragon Queue address does not exist." }));
app.use((error, req, res, next) => {
    console.error("Unexpected server error:", error.message);
    if (res.headersSent) return next(error);
    res.status(500).json({ message: "Something unexpected happened. Please try again." });
});

const confirmationTimer = setInterval(async () => {
    try {
        await processExpiredConfirmations();
        await ensureStationsScheduled();
    } catch (error) {
        console.error("Confirmation timer error:", error.message);
    }
}, 30000);

confirmationTimer.unref();

app.listen(PORT, "0.0.0.0", () => console.log(`Dragon Queue server is running on port ${PORT}`));
