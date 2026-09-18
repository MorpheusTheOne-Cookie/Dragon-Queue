// ==========================================================
// DRAGON QUEUE - DASHBOARD PAGE
// ==========================================================


// ==========================================================
// HTML ELEMENTS
// ==========================================================

const dashboardBtn = document.getElementById("dashboard-btn");
const rulesBtn = document.getElementById("rules-btn");

const dashboardWindow = document.getElementById("dashboard-Window");
const rulesWindow = document.getElementById("rules-Window");
const queueWindow = document.getElementById("queue-Window");

const backBtn = document.getElementById("back-btn");
const logoutBtn = document.getElementById("logout-btn");

const poolQueueBtn = document.getElementById("pool-queue-btn");
const tableTennisQueueBtn = document.getElementById("table-tennis-queue-btn");

const poolViewQueueBtn = document.getElementById("pool-view-queue-btn");
const tableTennisViewQueueBtn = document.getElementById("table-tennis-view-queue-btn");


// ==========================================================
// STATION NUMBERS
// ==========================================================

let poolStationId = 1;
let tableTennisStationId = 2;


// ==========================================================
// CURRENTLY VIEWED FULL QUEUE
// ==========================================================

let activeQueueStationId = null;
let activeQueueStationName = "";


// ==========================================================
// CURRENT USER
// ==========================================================

let user = getSavedUser();

if (!user || !user.username) {
    window.location.replace("index.html");
} else {
    initializePage();
}


// ==========================================================
// PAGE INITIALIZATION
// ==========================================================

function initializePage() {
    displayUserInformation();
    setupNavigation();
    setupQueueButtons();
    setupLogout();
    refreshLoop();
}


// ==========================================================
// USER INFORMATION
// ==========================================================

function displayUserInformation() {
    const initials = user.username.slice(0, 2).toUpperCase();
    const role = user.title || "Student";

    document.getElementById("user_avatar").textContent = initials;
    document.getElementById("Username").textContent = user.username;
    document.getElementById("Role").textContent = role;

    document.getElementById("profile-avatar").textContent = initials;
    document.getElementById("profile-username").textContent = user.username;
    document.getElementById("profile-role").textContent = role;
}


// ==========================================================
// NAVIGATION SETUP
// ==========================================================

function setupNavigation() {
    dashboardBtn.addEventListener("click", showDashboard);
    rulesBtn.addEventListener("click", showRules);
    backBtn.addEventListener("click", showDashboard);
}


// ==========================================================
// SHOW DASHBOARD
// ==========================================================

function showDashboard() {
    activeQueueStationId = null;
    activeQueueStationName = "";

    dashboardWindow.classList.remove("hidden-dashboard");
    rulesWindow.classList.add("hidden-rules");
    queueWindow.classList.add("hidden-queue");

    dashboardBtn.classList.remove("disable");
    rulesBtn.classList.add("disable");
}


// ==========================================================
// SHOW RULES
// ==========================================================

function showRules() {
    activeQueueStationId = null;
    activeQueueStationName = "";

    dashboardWindow.classList.add("hidden-dashboard");
    rulesWindow.classList.remove("hidden-rules");
    queueWindow.classList.add("hidden-queue");

    dashboardBtn.classList.add("disable");
    rulesBtn.classList.remove("disable");
}


// ==========================================================
// LOGOUT
// ==========================================================

function setupLogout() {
    logoutBtn.addEventListener("click", logout);
}

async function logout() {
    await postJson("/api/logout", {});
    localStorage.removeItem("dragon-user");
    window.location.replace("index.html");
}


// ==========================================================
// QUEUE BUTTON SETUP
// ==========================================================

function setupQueueButtons() {
    poolQueueBtn.addEventListener("click", function () {
        handleStationButton(poolQueueBtn, poolStationId, "Pool Table");
    });

    poolViewQueueBtn.addEventListener("click", function () {
        handleStationButton(poolViewQueueBtn, poolStationId, "Pool Table");
    });

    tableTennisQueueBtn.addEventListener("click", function () {
        handleStationButton(tableTennisQueueBtn, tableTennisStationId, "Table Tennis");
    });

    tableTennisViewQueueBtn.addEventListener("click", function () {
        handleStationButton(tableTennisViewQueueBtn, tableTennisStationId, "Table Tennis");
    });
}


// ==========================================================
// STATION BUTTON ACTIONS
// ==========================================================

async function handleStationButton(button, stationId, stationName) {
    if (button.disabled) {
        return;
    }

    const action = button.dataset.action || "view";

    if (action === "view") {
        await showFullQueue(stationId, stationName);
        return;
    }

    let result;

    if (["join", "leave", "requeue"].includes(action)) {
        result = await postJson(`/api/queue/${action}`, { stationId: stationId });
    } else if (action === "confirm") {
        result = await postJson("/api/games/availability", {
            stationId: stationId,
            available: true
        });
    } else if (action === "unavailable") {
        result = await postJson("/api/games/availability", {
            stationId: stationId,
            available: false
        });
    } else if (action === "win" || action === "loss") {
        result = await postJson("/api/games/result", {
            stationId: stationId,
            result: action
        });
    } else {
        return;
    }

    if (!result.ok) {
        window.alert(result.message || "That action could not be completed.");
    }

    await refresh();
}


// ==========================================================
// SHOW FULL QUEUE
// ==========================================================

async function showFullQueue(stationId, stationName) {
    try {
        activeQueueStationId = stationId;
        activeQueueStationName = stationName;

        await loadData();

        dashboardWindow.classList.add("hidden-dashboard");
        rulesWindow.classList.add("hidden-rules");
        queueWindow.classList.remove("hidden-queue");

        document.getElementById("full-queue-title").textContent = `${stationName} - Full Queue`;

        drawFullQueue(queueFor(stationId));
    } catch (error) {
        console.error("Unable to display queue:", error);
    }
}


// ==========================================================
// DRAW FULL QUEUE
// ==========================================================

function drawFullQueue(people) {
    const queueList = document.getElementById("queue-list");
    const visiblePeople = people.filter(function (person) {
        return person.status !== "postgame";
    });

    queueList.replaceChildren();

    if (visiblePeople.length === 0) {
        const message = document.createElement("p");
        message.textContent = "Nobody is waiting yet.";
        queueList.appendChild(message);
        return;
    }

    let waitingPosition = 0;

    visiblePeople.forEach(function (person) {
        const queueItem = document.createElement("p");
        let statusText = "";

        if (person.status === "playing") {
            statusText = "Playing now";
        } else if (person.status === "called") {
            statusText = "Called - confirming availability";
        } else {
            waitingPosition += 1;
            statusText = `${ordinal(waitingPosition)} waiting`;
        }

        queueItem.textContent = `${person.username} - ${statusText}`;

        if (isSamePerson(person, user.id)) {
            queueItem.textContent += " - you";
        }

        queueList.appendChild(queueItem);
    });
}


// ==========================================================
// REFRESH DATA
// ==========================================================

async function refresh() {
    try {
        await loadData();

        const poolStation = stationBySlug("pool");
        const tableTennisStation = stationBySlug("table-tennis");

        if (poolStation) {
            poolStationId = poolStation.id;
        }

        if (tableTennisStation) {
            tableTennisStationId = tableTennisStation.id;
        }

        drawStation(poolStationId, "pool");
        drawStation(tableTennisStationId, "table-tennis");

        drawNews();
        drawProfile();
        drawRules();
        drawTurnBanner();

        if (activeQueueStationId !== null) {
            drawFullQueue(queueFor(activeQueueStationId));

            document.getElementById("full-queue-title").textContent =
                `${activeQueueStationName} - Full Queue`;
        }
    } catch (error) {
        console.error("Unable to refresh Dragon Queue:", error);
    }
}


// ==========================================================
// AUTOMATIC REFRESH LOOP
// ==========================================================

async function refreshLoop() {
    await refresh();
    setTimeout(refreshLoop, 5000);
}


// ==========================================================
// DISPLAY HELPERS
// ==========================================================

function ordinal(number) {
    const lastTwoDigits = number % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
        return `${number}th`;
    }

    const lastDigit = number % 10;

    if (lastDigit === 1) return `${number}st`;
    if (lastDigit === 2) return `${number}nd`;
    if (lastDigit === 3) return `${number}rd`;

    return `${number}th`;
}

function formatCountdown(seconds) {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function queueEntryFor(stationId, userId) {
    return queueFor(stationId).find(function (person) {
        return isSamePerson(person, userId);
    }) || null;
}

function gameIncludesUser(game, userId) {
    if (!game) {
        return false;
    }

    return Number(game.player_a_id) === Number(userId) ||
        Number(game.player_b_id) === Number(userId);
}

function userConfirmedForGame(game, userId) {
    if (!game) {
        return false;
    }

    if (Number(game.player_a_id) === Number(userId)) {
        return Boolean(game.player_a_confirmed);
    }

    if (Number(game.player_b_id) === Number(userId)) {
        return Boolean(game.player_b_confirmed);
    }

    return false;
}

function userResultForGame(game, userId) {
    if (!game) {
        return "";
    }

    if (Number(game.player_a_id) === Number(userId)) {
        return game.player_a_result || "";
    }

    if (Number(game.player_b_id) === Number(userId)) {
        return game.player_b_result || "";
    }

    return "";
}

function opponentNameForGame(game, userId) {
    if (!game) {
        return "your opponent";
    }

    if (Number(game.player_a_id) === Number(userId)) {
        return game.player_b_username || "your opponent";
    }

    return game.player_a_username || "your opponent";
}


// ==========================================================
// DRAW STATION
// ==========================================================

function drawStation(stationId, prefix) {
    const station = stationById(stationId);
    const people = queueFor(stationId);
    const game = gameFor(stationId);
    const userEntry = queueEntryFor(stationId, user.id);
    const waiting = people.filter(function (person) {
        return person.status === "waiting";
    });

    if (!station) {
        console.error(`Station ${stationId} not found.`);
        return;
    }

    let currentText = "Nobody is playing";

    if (game && game.status === "playing") {
        currentText = `Now playing: ${game.player_a_username} vs ${game.player_b_username}`;
    } else if (game && game.status === "confirming") {
        const playerAEntry = queueEntryFor(stationId, game.player_a_id);
        const winnerIsStaying = playerAEntry && playerAEntry.status === "playing";

        if (winnerIsStaying) {
            currentText = `Winner stays: ${game.player_a_username} • ${game.player_b_username} confirming`;
        } else {
            currentText = `Up next: ${game.player_a_username} vs ${game.player_b_username} • confirming`;
        }
    } else if (game && game.status === "waiting_for_opponent") {
        currentText = `Winner stays: ${game.player_a_username} • waiting for challenger`;
    }

    const currentPlayerElement = document.getElementById(`${prefix}-current-player`);

    if (currentPlayerElement) {
        currentPlayerElement.textContent = currentText;
    }

    document.getElementById(`${prefix}-waiting`).textContent = waiting.length;

    const positionElement = document.getElementById(`${prefix}-position`);
    const waitElement = document.getElementById(`${prefix}-est-wait`);

    if (userEntry && userEntry.status === "waiting") {
        const waitingIndex = waiting.findIndex(function (person) {
            return isSamePerson(person, user.id);
        });
        const activeGameAhead = game && ["confirming", "playing"].includes(game.status) ? 1 : 0;

        positionElement.textContent = ordinal(waitingIndex + 1);
        waitElement.textContent = `${(waitingIndex + activeGameAhead) * station.avg_game_minutes} min`;
    } else if (userEntry && userEntry.status === "called") {
        positionElement.textContent = "Up Next";
        waitElement.textContent = "0 min";
    } else if (userEntry && userEntry.status === "playing") {
        positionElement.textContent = game && game.status === "playing" ? "Playing" : "Stays";
        waitElement.textContent = "0 min";
    } else if (userEntry && userEntry.status === "postgame") {
        positionElement.textContent = "Finished";
        waitElement.textContent = "-";
    } else {
        const activeGameAhead = game && ["confirming", "playing"].includes(game.status) ? 1 : 0;

        positionElement.textContent = "-";
        waitElement.textContent = `${(waiting.length + activeGameAhead) * station.avg_game_minutes} min`;
    }

    configureStationButtons(stationId, prefix, userEntry, game);
}


// ==========================================================
// DYNAMIC STATION BUTTONS
// ==========================================================

function configureStationButtons(stationId, prefix, userEntry, game) {
    const primaryButton = prefix === "pool" ? poolQueueBtn : tableTennisQueueBtn;
    const secondaryButton = prefix === "pool" ? poolViewQueueBtn : tableTennisViewQueueBtn;

    resetStationButton(primaryButton);
    resetStationButton(secondaryButton);

    if (!userEntry) {
        setStationButton(primaryButton, "Join Queue", "join");
        setStationButton(secondaryButton, "View Queue", "view", "ghost");
        return;
    }

    if (userEntry.status === "waiting") {
        setStationButton(primaryButton, "Leave Queue", "leave", "leave");
        setStationButton(secondaryButton, "View Queue", "view", "ghost");
        return;
    }

    if (userEntry.status === "called") {
        const confirmed = userConfirmedForGame(game, user.id);

        if (confirmed) {
            setStationButton(primaryButton, "Confirmed ✓", "none", "action-confirmed", true);
            setStationButton(secondaryButton, "Leave Queue", "leave", "action-loss");
        } else {
            setStationButton(primaryButton, "Confirm Available", "confirm", "action-confirm");
            setStationButton(secondaryButton, "Can't Play", "unavailable", "action-loss");
        }

        return;
    }

    if (userEntry.status === "playing") {
        if (game && game.status === "playing" && gameIncludesUser(game, user.id)) {
            const selectedResult = userResultForGame(game, user.id);

            setStationButton(
                primaryButton,
                selectedResult === "win" ? "Win ✓" : "Win",
                "win",
                selectedResult === "win" ? "action-win result-selected" : "action-win"
            );

            setStationButton(
                secondaryButton,
                selectedResult === "loss" ? "Loss ✓" : "Loss",
                "loss",
                selectedResult === "loss" ? "action-loss result-selected" : "action-loss"
            );
        } else {
            setStationButton(primaryButton, "Leave Table", "leave", "leave");
            setStationButton(secondaryButton, "View Queue", "view", "ghost");
        }

        return;
    }

    if (userEntry.status === "postgame") {
        setStationButton(primaryButton, "Requeue", "requeue", "action-requeue");
        setStationButton(secondaryButton, "Leave Queue", "leave", "action-loss");
    }
}

function resetStationButton(button) {
    button.disabled = false;
    button.dataset.action = "";
    button.classList.remove(
        "leave",
        "action-win",
        "action-loss",
        "action-confirm",
        "action-confirmed",
        "action-requeue",
        "result-selected",
        "ghost"
    );
}

function setStationButton(button, text, action, classes = "", disabled = false) {
    button.textContent = text;
    button.dataset.action = action;
    button.disabled = disabled;

    classes.split(" ").filter(Boolean).forEach(function (className) {
        button.classList.add(className);
    });
}


// ==========================================================
// DRAGON NEWS
// ==========================================================

function drawNews() {
    const newsList = document.getElementById("news-list");

    newsList.replaceChildren();

    news.forEach(function (item) {
        const newsItem = document.createElement("div");
        newsItem.classList.add("news-item");

        const date = document.createElement("span");
        date.textContent = formatNewsDate(item.event_date);

        const title = document.createElement("p");
        title.textContent = item.title;

        newsItem.append(date, title);
        newsList.appendChild(newsItem);
    });

    const noticeText = document.getElementById("notice-text");

    if (!serverIsOnline) {
        noticeText.textContent = "The Dragon Queue server is not responding. Start it and refresh the page.";
        return;
    }

    if (news.length > 0) {
        noticeText.textContent = news[0].title;
    } else {
        noticeText.textContent = "No new announcements.";
    }
}


// ==========================================================
// PROFILE
// ==========================================================

function drawProfile() {
    const profileBody = document.getElementById("profile-body");

    profileBody.replaceChildren();

    const profileStats = [
        { label: "Games Played", value: stats.played },
        { label: "Pool Wins", value: stats.pool_wins },
        { label: "Table Tennis Wins", value: stats.tennis_wins }
    ];

    profileStats.forEach(function (stat) {
        const statElement = document.createElement("div");
        statElement.classList.add("profile-stat");

        const value = document.createElement("strong");
        value.textContent = stat.value || 0;

        statElement.append(`${stat.label} `, value);
        profileBody.appendChild(statElement);
    });
}


// ==========================================================
// RULES
// ==========================================================

function drawRules() {
    const rulesBody = document.getElementById("rules-bdy");

    rulesBody.replaceChildren();

    let lastSection = "";

    rules.forEach(function (rule) {
        if (rule.section !== lastSection) {
            const sectionTitle = document.createElement("h2");
            sectionTitle.textContent = rule.section;
            rulesBody.appendChild(sectionTitle);

            lastSection = rule.section;
        }

        const ruleText = document.createElement("p");
        ruleText.textContent = rule.body;
        rulesBody.appendChild(ruleText);
    });
}


// ==========================================================
// TURN BANNER
// ==========================================================

function drawTurnBanner() {
    const banner = document.getElementById("turn-banner");
    const turnText = document.getElementById("turn-text");

    const stationStates = [
        stationTurnState(poolStationId, "Pool Table"),
        stationTurnState(tableTennisStationId, "Table Tennis")
    ].filter(Boolean);

    if (stationStates.length === 0) {
        banner.classList.add("hidden-dashboard");
        return;
    }

    stationStates.sort(function (a, b) {
        return b.priority - a.priority;
    });

    banner.classList.remove("hidden-dashboard");
    turnText.textContent = stationStates[0].message;
}

function stationTurnState(stationId, stationName) {
    const entry = queueEntryFor(stationId, user.id);
    const game = gameFor(stationId);

    if (!entry) {
        return null;
    }

    if (entry.status === "playing" && game && game.status === "playing" && gameIncludesUser(game, user.id)) {
        return {
            priority: 4,
            message: `Your ${stationName} game against ${opponentNameForGame(game, user.id)} is live. Choose Win or Loss when the game ends.`
        };
    }

    if (entry.status === "called" && game && game.status === "confirming") {
        const confirmed = userConfirmedForGame(game, user.id);

        if (confirmed) {
            return {
                priority: 3,
                message: `You confirmed for ${stationName}. Waiting for ${opponentNameForGame(game, user.id)} to confirm.`
            };
        }

        return {
            priority: 3,
            message: `Your ${stationName} turn is ready. Confirm availability within ${formatCountdown(game.confirmation_seconds_left)} or your turn will be skipped.`
        };
    }

    if (entry.status === "postgame") {
        return {
            priority: 2,
            message: `Your ${stationName} game is recorded. Choose Requeue to go to the back, or Leave Queue.`
        };
    }

    if (entry.status === "playing" && game && game.status !== "playing") {
        const message = game.status === "waiting_for_opponent"
            ? `You won on ${stationName}. Winner stays, and you are waiting for the next challenger.`
            : `You won on ${stationName}. Winner stays while the next challenger confirms.`;

        return {
            priority: 1,
            message: message
        };
    }

    return null;
}
