import fs from 'fs';
import path from 'path';

const STATS_FILE_PATH = path.join('/tmp', 'prank_sessions.json');

// Generate initial seed data to make stats look active and realistic on first boot
function generateSeedSessions() {
  const seedNames = [
    "Alex", "Sophia", "Liam", "Olivia", "Noah", "Emma", "Jackson", "Ava", 
    "Lucas", "Isabella", "Mason", "Mia", "Ethan", "Charlotte", "Oliver", 
    "Amelia", "Logan", "Harper", "Aiden", "Evelyn", "James", "Abigail"
  ];
  const statuses = ["completed", "completed", "abandoned", "completed", "abandoned"];
  const sessions = [];
  const now = new Date();

  for (let i = 0; i < 40; i++) {
    const seedName = seedNames[i % seedNames.length];
    const status = statuses[i % statuses.length];
    
    // Create timestamps spread over the last 7 days
    const createdDate = new Date(now);
    createdDate.setDate(now.getDate() - (i % 7));
    createdDate.setHours(now.getHours() - (i % 12), now.getMinutes() - (i % 45));

    const isToday = createdDate.toDateString() === now.toDateString();
    
    const isReturning = Math.random() < 0.25;
    const visitNumber = isReturning ? Math.floor(Math.random() * 4) + 2 : 1;

    let timeWasted = Math.floor(Math.random() * 180) + 40; // 40s to 220s
    let rickrollWatched = false;
    let rickrollWatchTime = 0;
    let timeBeforeRickroll = null;

    if (status === "completed") {
      rickrollWatched = Math.random() < 0.7;
      rickrollWatchTime = rickrollWatched ? Math.floor(Math.random() * 150) + 15 : 0;
      timeBeforeRickroll = Math.floor(Math.random() * 80) + 30; // 30s to 110s
      timeWasted += rickrollWatchTime + (timeBeforeRickroll || 0);
    } else {
      timeWasted = Math.floor(Math.random() * 90) + 10; // Quit early
    }

    const chars = '0123456789ABCDEF';
    const sessionId = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('') + '-' +
                      Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    sessions.push({
      sessionId,
      name: seedName,
      createdAt: createdDate.toISOString(),
      updatedAt: new Date(createdDate.getTime() + timeWasted * 1000).toISOString(),
      isReturning,
      visitNumber,
      status,
      timeWasted,
      loadingTime: parseFloat((Math.random() * 4 + 3).toFixed(1)),
      buttonAttempts: status === "completed" ? Math.floor(Math.random() * 12) + 25 : Math.floor(Math.random() * 15),
      questionsAnswered: status === "completed" ? 12 : Math.floor(Math.random() * 12),
      rickrollWatched,
      rickrollWatchTime,
      timeBeforeRickroll
    });
  }
  return sessions;
}

export function loadSessions() {
  try {
    if (!fs.existsSync(STATS_FILE_PATH)) {
      const seedData = generateSeedSessions();
      fs.writeFileSync(STATS_FILE_PATH, JSON.stringify(seedData, null, 2));
      return seedData;
    }
    const raw = fs.readFileSync(STATS_FILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error loading sessions from storage:", err);
    return [];
  }
}

export function saveSession(sessionUpdate) {
  try {
    const sessions = loadSessions();
    const index = sessions.findIndex(s => s.sessionId === sessionUpdate.sessionId);
    
    const nowStr = new Date().toISOString();

    if (index > -1) {
      // Merge update with existing record
      sessions[index] = {
        ...sessions[index],
        ...sessionUpdate,
        updatedAt: nowStr
      };
    } else {
      // Create new record
      sessions.push({
        createdAt: nowStr,
        updatedAt: nowStr,
        ...sessionUpdate
      });
    }

    fs.writeFileSync(STATS_FILE_PATH, JSON.stringify(sessions, null, 2));
    return sessions;
  } catch (err) {
    console.error("Error saving session to storage:", err);
    return [];
  }
}

export function getAggregatedStats() {
  const sessions = loadSessions();
  const now = new Date();
  
  let victimsToday = 0;
  let victimsThisWeek = 0;
  let rickrollStarted = 0;
  let rageQuits = 0;
  
  let totalTimeWasted = 0;
  let longestSession = 0;
  let fastestQuit = Infinity;
  let returningVisitorsCount = 0;

  let totalRickrollWatchTime = 0;
  let totalTimeBeforeRickroll = 0;
  let rickrollWithTimeCount = 0;

  sessions.forEach(s => {
    const createdDate = new Date(s.createdAt);
    const diffTime = Math.abs(now - createdDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Today's check (UTC/Local date match)
    if (createdDate.toDateString() === now.toDateString()) {
      victimsToday++;
    }

    // This week's check (<= 7 days)
    if (diffDays <= 7) {
      victimsThisWeek++;
    }

    if (s.status === "completed" || s.rickrollWatched || s.status === "rickroll") {
      rickrollStarted++;
    }

    if (s.status === "abandoned") {
      rageQuits++;
      if (s.timeWasted > 0 && s.timeWasted < fastestQuit) {
        fastestQuit = s.timeWasted;
      }
    }

    if (s.isReturning) {
      returningVisitorsCount++;
    }

    if (s.timeWasted > longestSession) {
      longestSession = s.timeWasted;
    }

    totalTimeWasted += s.timeWasted || 0;

    if (s.timeBeforeRickroll) {
      totalTimeBeforeRickroll += s.timeBeforeRickroll;
      rickrollWithTimeCount++;
    }
  });

  if (fastestQuit === Infinity) fastestQuit = 5; // fallback

  // Calculate averages
  const avgTimeBeforeRickrollSec = rickrollWithTimeCount > 0 
    ? Math.round(totalTimeBeforeRickroll / rickrollWithTimeCount) 
    : 45;

  const avgSessionTimeSec = sessions.length > 0 
    ? Math.round(totalTimeWasted / sessions.length) 
    : 120;

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return {
    victimsToday,
    victimsThisWeek,
    rickrollStarted,
    rageQuits,
    averageTimeBeforeRickroll: formatSeconds(avgTimeBeforeRickrollSec),
    averageSessionTime: formatSeconds(avgSessionTimeSec),
    returningVisitors: returningVisitorsCount,
    longestSession: formatSeconds(longestSession),
    fastestQuit: formatSeconds(fastestQuit),
    totalTimeWasted: formatSeconds(totalTimeWasted)
  };
}
