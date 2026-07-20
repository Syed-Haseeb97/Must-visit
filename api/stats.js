import { getAggregatedStats } from './stats_store.js';

export default async function handler(req, res) {
  // CORS and Method Handling
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const stats = getAggregatedStats();
    
    // Return precisely the format requested, plus any extras
    return res.status(200).json({
      victimsToday: stats.victimsToday,
      victimsThisWeek: stats.victimsThisWeek,
      rickrollStarted: stats.rickrollStarted,
      rageQuits: stats.rageQuits,
      averageTimeBeforeRickroll: stats.averageTimeBeforeRickroll,
      averageSessionTime: stats.averageSessionTime,
      returningVisitors: stats.returningVisitors,
      longestSession: stats.longestSession,
      fastestQuit: stats.fastestQuit,
      totalTimeWasted: stats.totalTimeWasted
    });
  } catch (err) {
    console.error("Error executing /api/stats endpoint:", err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
