const dashboardBtn = document.getElementById("dashboard-btn");
const rulesBtn = document.getElementById("rules-btn");

const dashboardWindow = document.getElementById("dashboard-Window");
const rulesWindow = document.getElementById("rules-Window");

const queueWindow = document.getElementById("queue-Window");
const backBtn = document.getElementById("back-btn");


let user = JSON.parse(localStorage.getItem("dragon-user"));

if (user === null) {
    window.location.href = "index.html";
}


document.getElementById("user_avatar").innerHTML =
    user.username.slice(0, 2).toUpperCase();

document.getElementById("Username").innerHTML =
    user.username;

document.getElementById("Role").innerHTML =
    user.title || "Student";


document.getElementById("profile-avatar").innerHTML =
    user.username.slice(0, 2).toUpperCase();

document.getElementById("profile-username").innerHTML =
    user.username;

document.getElementById("profile-role").innerHTML =
    user.title || "Student";


function showDashboard() {
    dashboardWindow.classList.remove("hidden-dashboard");
    rulesWindow.classList.add("hidden-rules");
    queueWindow.classList.add("hidden-queue");

    dashboardBtn.classList.remove("disable");
    rulesBtn.classList.add("disable");
}


dashboardBtn.onclick = function () {
    showDashboard();
};


rulesBtn.onclick = function () {
    dashboardWindow.classList.add("hidden-dashboard");
    rulesWindow.classList.remove("hidden-rules");
    queueWindow.classList.add("hidden-queue");

    dashboardBtn.classList.add("disable");
    rulesBtn.classList.remove("disable");
};


backBtn.onclick = function () {
    showDashboard();
};


document.getElementById("logout-btn").onclick = function () {
    localStorage.removeItem("dragon-user");
    window.location.href = "index.html";
};



document.getElementById("pool-queue-btn").onclick = function () {
    joinOrLeave(1);
};


document.getElementById("table-tennis-queue-btn").onclick = function () {
    joinOrLeave(2);
};


document.getElementById("pool-view-queue-btn").onclick = function () {
    showFullQueue(1, "Pool Table");
};


document.getElementById("table-tennis-view-queue-btn").onclick = function () {
    showFullQueue(2, "Table Tennis");
};


async function joinOrLeave(stationId) {

    if (isInQueue(stationId, user.id) === true) {
        await queueAction("leave", stationId, user);
    } else {
        await queueAction("join", stationId, user);
    }

    await refresh();
}



async function showFullQueue(stationId, stationName) {

    dashboardWindow.classList.add("hidden-dashboard");
    rulesWindow.classList.add("hidden-rules");
    queueWindow.classList.remove("hidden-queue");

    document.getElementById("full-queue-title").innerHTML =
        stationName + " - Full Queue";

    const people = queueFor(stationId);

    let html = "";

    for (let i = 0; i < people.length; i = i + 1) {

        html = html +
            "<p>" +
            (i + 1) +
            ". " +
            people[i].username +
            " (" +
            people[i].status +
            ")" +
            "</p>";
    }

    if (people.length === 0) {
        html = "<p>Nobody is waiting yet.</p>";
    }


    document.getElementById("queue-list").innerHTML = html;
}




async function refresh() {


    await loadData();

    drawStation(1, "pool");
    drawStation(2, "table-tennis");

    drawNews();
    drawProfile();
    drawRules();
    drawTurnBanner();
}




function ordinal(number) {

    const lastTwoDigits = number % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
        return number + "th";
    }

    const lastDigit = number % 10;

    if (lastDigit === 1) {
        return number + "st";
    }

    if (lastDigit === 2) {
        return number + "nd";
    }

    if (lastDigit === 3) {
        return number + "rd";
    }

    return number + "th";
}




function drawStation(stationId, prefix) {

    const station = stationById(stationId);
    const people = queueFor(stationId);


    const currentText =
        station.current_players
            ? "Now playing: " + station.current_players
            : "Nobody is playing";

    if (stationId === 1) {
        document.querySelector(".pool-head #queue-length").innerHTML =
            currentText;
    } else {
        document.querySelector(".table-tennis-head #queue-length").innerHTML =
            currentText;
    }



    document.getElementById(prefix + "-waiting").innerHTML =
        people.length;



    let userIndex = -1;

    for (let i = 0; i < people.length; i = i + 1) {


        if (
            people[i].id === user.id ||
            people[i].user_id === user.id ||
            people[i].username === user.username
        ) {
            userIndex = i;
            break;
        }
    }


    if (userIndex !== -1) {

        const position = userIndex + 1;

        document.getElementById(prefix + "-position").innerHTML =
            ordinal(position);

        document.getElementById(prefix + "-est-wait").innerHTML =
            (userIndex * station.avg_game_minutes) + " min";

    } else {

        document.getElementById(prefix + "-position").innerHTML =
            "-";

        document.getElementById(prefix + "-est-wait").innerHTML =
            (people.length * station.avg_game_minutes) + " min";
    }



    const button = document.getElementById(
        stationId === 1
            ? "pool-queue-btn"
            : "table-tennis-queue-btn"
    );


    if (isInQueue(stationId, user.id) === true) {

        button.innerHTML = "Leave Queue";
        button.classList.add("leave");

    } else {

        button.innerHTML = "Join Queue";
        button.classList.remove("leave");
    }
}




function drawNews() {

    let html = "";

    for (let i = 0; i < news.length; i = i + 1) {

        html = html +
            '<div class="news-item">' +
            "<span>" +
            news[i].event_date +
            "</span>" +
            "<p>" +
            news[i].title +
            "</p>" +
            "</div>";
    }

    document.getElementById("news-list").innerHTML = html;


    if (news.length > 0) {

        document.getElementById("notice-text").innerHTML =
            news[news.length - 1].title;

    } else {

        document.getElementById("notice-text").innerHTML =
            "No new announcements.";
    }
}




function drawProfile() {

    document.getElementById("profile-body").innerHTML =
        '<div class="profile-stat">Games Played <strong>' +
        stats.played +
        "</strong></div>" +

        '<div class="profile-stat">Pool Wins <strong>' +
        stats.pool_wins +
        "</strong></div>" +

        '<div class="profile-stat">Table Tennis Wins <strong>' +
        stats.tennis_wins +
        "</strong></div>";
}




function drawRules() {

    let html = "";
    let lastSection = "";

    for (let i = 0; i < rules.length; i = i + 1) {

        if (rules[i].section !== lastSection) {

            html = html +
                "<h2>" +
                rules[i].section +
                "</h2>";

            lastSection = rules[i].section;
        }

        html = html +
            "<p>" +
            rules[i].body +
            "</p>";
    }


    document.getElementById("rules-bdy").innerHTML = html;
}




function drawTurnBanner() {

    const banner = document.getElementById("turn-banner");

    let text = "";

    if (isNext(1, user.id) === true) {

        text = "You are next on the Pool Table.";

    } else if (isNext(2, user.id) === true) {

        text = "You are next on Table Tennis.";
    }


    if (text === "") {

        banner.classList.add("hidden-dashboard");

    } else {

        banner.classList.remove("hidden-dashboard");

        document.getElementById("turn-text").innerHTML =
            text;
    }
}



refresh();


setInterval(refresh, 5000);
