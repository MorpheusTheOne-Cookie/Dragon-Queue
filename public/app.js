// ==========================================================
// STATIONS
// ==========================================================

let stations = [

    {
        id: 1,
        name: "Pool Table",
        slug: "pool",
        avg_game_minutes: 15,
        current_players: ""
    },

    {
        id: 2,
        name: "Table Tennis",
        slug: "table-tennis",
        avg_game_minutes: 10,
        current_players: ""
    }

];


// ==========================================================
// QUEUES
// ==========================================================

let queues = {
    1: [],
    2: []
};


// ==========================================================
// NEWS
// ==========================================================

let news = [];


// ==========================================================
// RULES
// ==========================================================

let rules = [];


// ==========================================================
// PLAYER STATS
// ==========================================================

let stats = {
    played: 0,
    wins: 0,
    pool_wins: 0,
    tennis_wins: 0
};


// ==========================================================
// SERVER STATUS
// ==========================================================

let serverIsOnline = true;


// ==========================================================
// SERVER HELPERS
// ==========================================================

async function getJson(path) {
    try {
        const response = await fetch(path);

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (error) {
        return null;
    }
}

async function sendJson(path, body) {
    try {
        const response = await fetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        return response.ok;
    } catch (error) {
        return false;
    }
}


// ==========================================================
// LOAD DATA
// ==========================================================

async function loadData() {
    const [serverStations, serverQueue, serverNews, serverRules] = await Promise.all([
        getJson("/api/stations"),
        getJson("/api/queue"),
        getJson("/api/news"),
        getJson("/api/rules")
    ]);

    serverIsOnline = serverStations !== null;

    if (serverStations !== null) {
        stations = serverStations;
    }

    if (serverQueue !== null) {
        queues = {};

        stations.forEach(function (station) {
            queues[station.id] = [];
        });

        serverQueue.forEach(function (entry) {
            if (!queues[entry.station_id]) {
                queues[entry.station_id] = [];
            }

            queues[entry.station_id].push(entry);
        });
    }

    if (serverNews !== null) {
        news = serverNews;
    }

    if (serverRules !== null) {
        rules = serverRules;
    }

    const currentUser = getSavedUser();

    if (currentUser && currentUser.id) {
        const serverStats = await getJson("/api/stats/" + currentUser.id);

        if (serverStats !== null) {
            stats = serverStats;
        }
    }
}


// ==========================================================
// FIND STATION
// ==========================================================

function stationById(stationId) {
    return stations.find(function (station) {
        return station.id === Number(stationId);
    });
}

function stationBySlug(slug) {
    return stations.find(function (station) {
        return station.slug === slug;
    });
}


// ==========================================================
// GET QUEUE
// ==========================================================

function queueFor(stationId) {
    return queues[stationId] || [];
}


// ==========================================================
// CURRENT SAVED USER
// ==========================================================

function getSavedUser() {
    const savedUser = localStorage.getItem("dragon-user");

    if (!savedUser) {
        return null;
    }

    try {
        return JSON.parse(savedUser);
    } catch (error) {
        console.error("Could not read saved user:", error);
        return null;
    }
}


// ==========================================================
// CHECK IF SOMEBODY IS THIS USER
// ==========================================================

function isSamePerson(person, userId) {
    return Number(person.user_id) === Number(userId);
}


// ==========================================================
// CHECK IF USER IS IN QUEUE
// ==========================================================

function isInQueue(stationId, userId) {
    return queueFor(stationId).some(function (person) {
        return isSamePerson(person, userId);
    });
}


// ==========================================================
// CHECK IF USER IS NEXT
// ==========================================================

function isNext(stationId, userId) {
    const people = queueFor(stationId);

    if (people.length === 0) {
        return false;
    }

    return isSamePerson(people[0], userId);
}


// ==========================================================
// QUEUE ACTION
// ==========================================================

async function queueAction(action, stationId, user) {
    const savedOnServer = await sendJson("/api/queue/" + action, {
        stationId: stationId,
        userId: user.id
    });

    if (!savedOnServer) {
        serverIsOnline = false;
        return false;
    }

    await loadData();
    return true;
}


// ==========================================================
// DATE FORMATTING
// ==========================================================

function formatNewsDate(text) {
    if (!text) {
        return "";
    }

    const date = new Date(String(text).slice(0, 10) + "T00:00:00");

    if (isNaN(date.getTime())) {
        return String(text);
    }

    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short"
    });
}
