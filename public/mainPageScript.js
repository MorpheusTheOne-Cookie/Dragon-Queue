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

function logout() {
    localStorage.removeItem("dragon-user");
    window.location.replace("index.html");
}


// ==========================================================
// QUEUE BUTTON SETUP
// ==========================================================

function setupQueueButtons() {
    poolQueueBtn.addEventListener("click", function () {
        joinOrLeave(poolStationId);
    });

    tableTennisQueueBtn.addEventListener("click", function () {
        joinOrLeave(tableTennisStationId);
    });

    poolViewQueueBtn.addEventListener("click", function () {
        showFullQueue(poolStationId, "Pool Table");
    });

    tableTennisViewQueueBtn.addEventListener("click", function () {
        showFullQueue(tableTennisStationId, "Table Tennis");
    });
}


// ==========================================================
// JOIN OR LEAVE QUEUE
// ==========================================================

async function joinOrLeave(stationId) {
    try {
        const action = isInQueue(stationId, user.id) ? "leave" : "join";

        const saved = await queueAction(action, stationId, user);

        if (!saved) {
            console.error("The queue change was not saved by the server.");
        }

        await refresh();
    } catch (error) {
        console.error("Queue action failed:", error);
    }
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

    queueList.replaceChildren();

    if (people.length === 0) {
        const message = document.createElement("p");
        message.textContent = "Nobody is waiting yet.";
        queueList.appendChild(message);
        return;
    }

    people.forEach(function (person, index) {
        const queueItem = document.createElement("p");

        queueItem.textContent = `${index + 1}. ${person.username} (${person.status})`;

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
// ORDINAL NUMBERS
// ==========================================================

function ordinal(number) {
    const lastTwoDigits = number % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
        return `${number}th`;
    }

    const lastDigit = number % 10;

    if (lastDigit === 1) {
        return `${number}st`;
    }

    if (lastDigit === 2) {
        return `${number}nd`;
    }

    if (lastDigit === 3) {
        return `${number}rd`;
    }

    return `${number}th`;
}


// ==========================================================
// DRAW STATION
// ==========================================================

function drawStation(stationId, prefix) {
    const station = stationById(stationId);
    const people = queueFor(stationId);

    if (!station) {
        console.error(`Station ${stationId} not found.`);
        return;
    }

    // ------------------------------------------------------
    // Who is playing right now
    // ------------------------------------------------------
    const playing = people.find(function (person) {
        return person.status === "playing";
    });

    let currentText = "Nobody is playing";

    if (playing) {
        currentText = `Now playing: ${playing.username}`;
    } else if (station.current_players) {
        currentText = `Now playing: ${station.current_players}`;
    }

    const currentPlayerElement = document.getElementById(`${prefix}-current-player`);

    if (currentPlayerElement) {
        currentPlayerElement.textContent = currentText;
    }

    // ------------------------------------------------------
    // How many people are in the queue
    // ------------------------------------------------------
    document.getElementById(`${prefix}-waiting`).textContent = people.length;

    // ------------------------------------------------------
    // Where the signed-in player is standing
    // ------------------------------------------------------

    const userIndex = people.findIndex(function (person) {
        return isSamePerson(person, user.id);
    });

    const positionElement = document.getElementById(`${prefix}-position`);
    const waitElement = document.getElementById(`${prefix}-est-wait`);

    if (userIndex !== -1) {
        positionElement.textContent = ordinal(userIndex + 1);

        waitElement.textContent = `${userIndex * station.avg_game_minutes} min`;
    } else {
        positionElement.textContent = "-";

        waitElement.textContent = `${people.length * station.avg_game_minutes} min`;
    }

    // ------------------------------------------------------
    // Join or Leave button
    // ------------------------------------------------------
    const button = prefix === "pool" ? poolQueueBtn : tableTennisQueueBtn;

    if (isInQueue(stationId, user.id)) {
        button.textContent = "Leave Queue";
        button.classList.add("leave");
    } else {
        button.textContent = "Join Queue";
        button.classList.remove("leave");
    }
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

    // ------------------------------------------------------
    // Orange strip at the top of the dashboard
    // ------------------------------------------------------
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

    let message = "";

    if (isNext(poolStationId, user.id)) {
        message = "You are next on the Pool Table.";
    } else if (isNext(tableTennisStationId, user.id)) {
        message = "You are next on Table Tennis.";
    }

    if (message === "") {
        banner.classList.add("hidden-dashboard");
        return;
    }

    banner.classList.remove("hidden-dashboard");
    turnText.textContent = message;
}
