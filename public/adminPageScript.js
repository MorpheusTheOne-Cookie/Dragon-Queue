// ==========================================================
// DRAGON QUEUE - ADMIN DASHBOARD (GOAL 4)
// ==========================================================

const stationGrid = document.getElementById("station-grid");
const adminName = document.getElementById("admin-name");
const adminRole = document.getElementById("admin-role");
const refreshButton = document.getElementById("refresh-btn");
const logoutButton = document.getElementById("logout-btn");
const lastUpdated = document.getElementById("last-updated");
const dashboardMessage = document.getElementById("dashboard-message");
const dashboardError = document.getElementById("dashboard-error");

const REFRESH_EVERY_MS = 5000;
let dashboardState = null;
let nextRefreshTimer = null;
let countdownTimer = null;
let actionInProgress = false;

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function roleLabel(role) {
    if (role === "main_admin") return "Main Admin";
    if (role === "temp_admin") return "Temporary Admin";
    return role || "Administrator";
}

function statusLabel(game) {
    if (!game) return "Idle";
    if (game.status === "playing") return "Match in progress";
    if (game.status === "confirming") return "Confirming players";
    if (game.status === "waiting_for_opponent") return "Waiting for challenger";
    return game.status;
}

function formatSeconds(totalSeconds) {
    const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function showMessage(message) {
    dashboardError.hidden = true;
    dashboardMessage.textContent = message;
    dashboardMessage.hidden = false;
}

function showError(message) {
    dashboardMessage.hidden = true;
    dashboardError.textContent = message;
    dashboardError.hidden = false;
}

function clearNotices() {
    dashboardMessage.hidden = true;
    dashboardError.hidden = true;
}

function confirmationBadge(confirmed, gameStatus, result) {
    if (gameStatus === "playing" && result === "win") {
        return '<span class="badge confirmed">Win submitted</span>';
    }

    if (gameStatus === "playing" && result === "loss") {
        return '<span class="badge postgame">Loss submitted</span>';
    }

    if (gameStatus === "playing") {
        return '<span class="badge playing">Playing</span>';
    }

    if (confirmed) {
        return '<span class="badge confirmed">Confirmed</span>';
    }

    return '<span class="badge pending">Waiting</span>';
}

function playerControls(stationId, userId, username, confirmed, gameStatus) {
    if (!userId || !username || gameStatus !== "confirming" || confirmed) {
        return "";
    }

    return `
        <div class="admin-actions">
            <button
                type="button"
                class="action-button confirm-button"
                data-admin-action="confirm"
                data-station-id="${Number(stationId)}"
                data-user-id="${Number(userId)}"
                data-username="${escapeHtml(username)}">
                Confirm
            </button>
            <button
                type="button"
                class="action-button skip-button"
                data-admin-action="skip"
                data-station-id="${Number(stationId)}"
                data-user-id="${Number(userId)}"
                data-username="${escapeHtml(username)}">
                Skip
            </button>
        </div>
    `;
}

function playerRow(stationId, label, userId, username, confirmed, gameStatus, result) {
    if (!username) {
        return `
            <div class="player-row">
                <div>
                    <div class="player-name">No challenger yet</div>
                    <div class="player-side">${escapeHtml(label)}</div>
                </div>
                <span class="badge waiting">Waiting</span>
            </div>
        `;
    }

    return `
        <div class="player-row">
            <div class="player-info">
                <div class="player-name">${escapeHtml(username)}</div>
                <div class="player-side">${escapeHtml(label)}</div>
            </div>
            <div class="player-state-and-actions">
                ${confirmationBadge(confirmed, gameStatus, result)}
                ${playerControls(stationId, userId, username, confirmed, gameStatus)}
            </div>
        </div>
    `;
}

function queueBadge(status) {
    if (status === "postgame") return '<span class="badge postgame">Awaiting decision</span>';
    if (status === "called") return '<span class="badge pending">Called</span>';
    if (status === "playing") return '<span class="badge playing">Playing</span>';
    return '<span class="badge waiting">Waiting</span>';
}

function queueControls(stationId, entry) {
    if (entry.status !== "waiting") return "";

    return `
        <button
            type="button"
            class="action-button remove-button"
            data-admin-action="remove"
            data-station-id="${Number(stationId)}"
            data-user-id="${Number(entry.user_id)}"
            data-username="${escapeHtml(entry.username)}">
            Remove
        </button>
    `;
}

function renderQueue(stationId, queue) {
    if (!queue.length) {
        return '<p class="queue-empty">Nobody else is waiting.</p>';
    }

    let waitingPosition = 0;

    return `
        <div class="queue-list">
            ${queue.map((entry) => {
                if (entry.status === "waiting") waitingPosition += 1;
                const positionText = entry.status === "waiting" ? waitingPosition : "•";

                return `
                    <div class="queue-row">
                        <div class="queue-person">
                            <span class="queue-position">${positionText}</span>
                            <span class="queue-name">${escapeHtml(entry.username)}</span>
                        </div>
                        <div class="queue-state-and-actions">
                            ${queueBadge(entry.status)}
                            ${queueControls(stationId, entry)}
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function timerMarkup(game, stationId) {
    if (!game || game.status !== "confirming" || game.confirmation_seconds_left === null) {
        return "";
    }

    const urgentClass = Number(game.confirmation_seconds_left) <= 120 ? " urgent" : "";

    return `
        <div class="timer-box${urgentClass}" data-station-timer="${stationId}">
            Confirmation time left: <span>${formatSeconds(game.confirmation_seconds_left)}</span>
        </div>
    `;
}

function renderStation(station) {
    const game = station.game;
    const stationClass = station.slug === "table-tennis" ? "table-tennis" : "pool";

    const matchContent = game
        ? `
            ${playerRow(station.id, "Player A", game.player_a_id, game.player_a_username, game.player_a_confirmed, game.status, game.player_a_result)}
            ${playerRow(station.id, "Player B", game.player_b_id, game.player_b_username, game.player_b_confirmed, game.status, game.player_b_result)}
            ${timerMarkup(game, station.id)}
          `
        : '<p class="match-empty">No game is currently scheduled.</p>';

    return `
        <article class="station-card ${stationClass}">
            <header class="station-header">
                <div class="station-title-row">
                    <h2>${escapeHtml(station.name)}</h2>
                    <span class="station-status">${escapeHtml(statusLabel(game))}</span>
                </div>
                <div class="station-meta">
                    <span>${Number(station.waiting_count) || 0} waiting</span>
                    <span>Avg. game ${Number(station.avg_game_minutes) || 0} min</span>
                </div>
            </header>

            <div class="station-body">
                <p class="section-label">CURRENT / UPCOMING GAME</p>
                <div class="match-panel">
                    ${matchContent}
                </div>

                <section class="queue-section">
                    <div class="queue-summary">
                        <strong>Queue</strong>
                        <span>${station.queue.length} additional ${station.queue.length === 1 ? "person" : "people"}</span>
                    </div>
                    ${renderQueue(station.id, station.queue)}
                </section>
            </div>
        </article>
    `;
}

function renderDashboard(data) {
    dashboardState = data;

    adminName.textContent = data.admin.username;
    adminRole.textContent = roleLabel(data.admin.role);

    if (!Array.isArray(data.stations) || data.stations.length === 0) {
        stationGrid.innerHTML = `
            <article class="loading-card">
                <strong>No stations found.</strong>
                <p>Check the stations table in the Dragon Queue database.</p>
            </article>
        `;
        return;
    }

    stationGrid.innerHTML = data.stations.map(renderStation).join("");

    const updatedDate = new Date(data.refreshed_at);
    lastUpdated.textContent = `Last updated ${updatedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} • auto-refreshes every 5 sec`;
}

function tickCountdowns() {
    if (!dashboardState?.stations) return;

    for (const station of dashboardState.stations) {
        const game = station.game;
        if (!game || game.status !== "confirming" || game.confirmation_seconds_left === null) continue;

        game.confirmation_seconds_left = Math.max(0, Number(game.confirmation_seconds_left) - 1);

        const timer = document.querySelector(`[data-station-timer="${station.id}"]`);
        if (!timer) continue;

        const value = timer.querySelector("span");
        if (value) value.textContent = formatSeconds(game.confirmation_seconds_left);
        timer.classList.toggle("urgent", game.confirmation_seconds_left <= 120);
    }
}

async function loadDashboard({ keepNotice = false } = {}) {
    clearTimeout(nextRefreshTimer);
    refreshButton.disabled = true;

    if (!keepNotice) clearNotices();
    else dashboardError.hidden = true;

    try {
        const response = await fetch("/api/admin/dashboard", {
            headers: { "Accept": "application/json" }
        });

        if (response.status === 401 || response.status === 403) {
            window.location.href = "/admin-login.html";
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "The admin dashboard could not be loaded.");
        }

        renderDashboard(data);

    } catch (error) {
        console.error("Admin dashboard load failed:", error);
        showError(error.message || "The admin dashboard could not be loaded.");

    } finally {
        refreshButton.disabled = false;
        nextRefreshTimer = setTimeout(() => loadDashboard(), REFRESH_EVERY_MS);
    }
}

async function performAdminAction(action, stationId, userId, username, button) {
    if (actionInProgress) return;

    const endpointByAction = {
        confirm: "/api/admin/queue/confirm",
        skip: "/api/admin/queue/skip",
        remove: "/api/admin/queue/remove"
    };

    const endpoint = endpointByAction[action];
    if (!endpoint) return;

    actionInProgress = true;
    clearTimeout(nextRefreshTimer);
    clearNotices();

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Working...";

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ stationId, userId })
        });

        if (response.status === 401 || response.status === 403) {
            if (response.status === 401) {
                window.location.href = "/admin-login.html";
                return;
            }
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "The admin action could not be completed.");
        }

        const actionMessage = {
            confirm: `${username} was confirmed as available.`,
            skip: `${username} was skipped and moved to the back of the queue.`,
            remove: `${username} was removed from the waiting queue.`
        };

        showMessage(actionMessage[action] || "Admin action completed.");
        await loadDashboard({ keepNotice: true });

    } catch (error) {
        console.error("Admin queue action failed:", error);
        showError(error.message || "The admin action could not be completed.");
        nextRefreshTimer = setTimeout(() => loadDashboard(), REFRESH_EVERY_MS);

    } finally {
        actionInProgress = false;
        if (button.isConnected) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }
}

stationGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-admin-action]");
    if (!button) return;

    const action = button.dataset.adminAction;
    const stationId = Number(button.dataset.stationId);
    const userId = Number(button.dataset.userId);
    const username = button.dataset.username || "Player";

    if (!stationId || !userId) {
        showError("The selected player or station is invalid.");
        return;
    }

    performAdminAction(action, stationId, userId, username, button);
});

refreshButton.addEventListener("click", () => loadDashboard());

logoutButton.addEventListener("click", async function () {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("dragon-user");
    window.location.href = "/admin-login.html";
});

// Update only the visual timer each second. The server remains the authority and
// the complete state is re-fetched every five seconds.
countdownTimer = setInterval(tickCountdowns, 1000);

loadDashboard();
