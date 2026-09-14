-- ==========================================================
-- Database Creation
-- ==========================================================
-- CREATE DATABASE IF NOT EXISTS dragon_queue;

-- USE dragon_queue;

-- ==========================================================
-- Users
-- ==========================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    title ENUM(
        'student',
        'temp_admin',
        'main_admin'
    ) NOT NULL DEFAULT 'student',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- USER SESSIONS
-- ==========================================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    token_hash CHAR(64) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY session_expiry (expires_at),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ==========================================================
-- Stations (the Pool Table and the Table Tennis table)
-- ==========================================================
CREATE TABLE IF NOT EXISTS stations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    avg_game_minutes INT NOT NULL DEFAULT 10,
    current_players VARCHAR(120) NULL
);

-- ==========================================================
-- Queue entries (one row per person waiting or playing)
-- ==========================================================
CREATE TABLE IF NOT EXISTS queue_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    station_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('waiting', 'playing') NOT NULL DEFAULT 'waiting',
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY one_place_per_station (station_id, user_id),
    KEY queue_order (station_id, status, joined_at),
    FOREIGN KEY (station_id) REFERENCES stations (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ==========================================================
-- Finished games (used for the profile statistics)
-- ==========================================================
CREATE TABLE IF NOT EXISTS matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    station_id INT NOT NULL,
    winner_id INT NOT NULL,
    loser_id INT NOT NULL,
    played_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY winner_lookup (winner_id),
    KEY loser_lookup (loser_id),
    FOREIGN KEY (station_id) REFERENCES stations (id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (loser_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ==========================================================
-- Dragon News
-- ==========================================================
CREATE TABLE IF NOT EXISTS news (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    event_date DATE NOT NULL,
    UNIQUE KEY one_news_item (title, event_date)
);

-- ==========================================================
-- Rules
-- ==========================================================
CREATE TABLE IF NOT EXISTS rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rule_key VARCHAR(80) NOT NULL UNIQUE,
    section VARCHAR(80) NOT NULL,
    body VARCHAR(255) NOT NULL,
    section_order INT NOT NULL DEFAULT 0,
    rule_order INT NOT NULL DEFAULT 0
);

-- ============================================================
-- STARTING DATA
-- The IGNORE keyword means running this file twice never
-- creates a second copy of the same row.
-- ============================================================

INSERT IGNORE INTO
    stations (name, slug, avg_game_minutes)
VALUES ('Pool Table', 'pool', 15),
    (
        'Table Tennis',
        'table-tennis',
        10
    );

INSERT IGNORE INTO
    news (title, event_date)
VALUES (
        'Welcome to Dragon Queue! Join a table from the dashboard.',
        '2026-09-11'
    ),
    (
        'Singles pool tournament sign-ups open this Friday.',
        '2026-09-20'
    ),
    (
        'Table Tennis tournament sign-ups open this Friday.',
        '2026-10-14'
    );

INSERT INTO
    rules (
        rule_key,
        section,
        body,
        section_order,
        rule_order
    )
VALUES (
        'house-respect',
        'House Rules',
        'Respect other players and the equipment at all times.',
        1,
        1
    ),
    (
        'house-one-game',
        'House Rules',
        'One game per turn while other people are waiting.',
        1,
        2
    ),
    (
        'house-missed-turn',
        'House Rules',
        'Miss your turn and you go to the back of the queue.',
        1,
        3
    ),
    (
        'house-multiple-queues',
        'House Rules',
        'You may queue for both tables at the same time.',
        1,
        4
    ),
    (
        'Equipment-care',
        'House Rules',
        'Please do not break the Pool Cues, Table Tennis paddles, or any other equipment. pls',
        1,
        5
    ),
    (
        'pool-winner-stays',
        'Pool Table Rules',
        'Winner stays on for as long as they keep winning, loser goes to the back of the queue.',
        2,
        1
    ),
    (
        '8-ball-break',
        'Pool Table Rules',
        'If u get the 8 ball in off break then you win right away',
        2,
        2
    ),
    (
        'pool-return-equipment',
        'Pool Table Rules',
        'Return all cues and balls when your game ends.',
        2,
        2
    ),
    (
        'tennis-scoring',
        'Table Tennis Rules',
        'Games are first to 11 points, win by two. cap at 15 points. or first to 21 points cap at 25.',
        3,
        1
    ),
    (
        'tennis-return-equipment',
        'Table Tennis Rules',
        'Return the paddles and balls when your game ends.',
        3,
        2
    ),
    (
        '8-ball-pocket',
        'Bethune Pool Table Rules',
        'Anytime during the game if the 8 ball enters the wrong hole it doesnt mean u lose, it is ball in hand for the other person, and the 8 ball is placed on the dot (sticker) where the triangle was initially',
        4,
        1
    ),
    (
        '8-ball-bank',
        'Bethune Pool Table Rules',
        'When all you balls are pocketed and you are on the 8 ball, you perform 3 banks (hitting the 8 ball or cue ball of a wall) which range for 3 of your turns before u can take the ball straight into the pocket.',
        4,
        2
    )
ON DUPLICATE KEY UPDATE
    section = VALUES(section),
    body = VALUES(body),
    section_order = VALUES(section_order),
    rule_order = VALUES(rule_order);

UPDATE users SET title = 'temp_admin' WHERE username = 'Dragons';

-- UPDATE rules SET rule_key = 'Equipment-care' WHERE rule_key = 'house-hello';
-- UPDATE rules SET body = 'Please do not break the Pool Cues, Table Tennis paddles, or any other equipment. pls' WHERE rule_key = 'Equipment-care';