import { UAParser } from 'ua-parser-js';
import { saveSession, getAggregatedStats } from './stats_store.js';

// Vercel Serverless Function to handle victim analytics and Discord integrations
export default async function handler(req, res) {
  // CORS and Method Handling
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body || {};
    const {
      sessionId,
      event, // 'visitor_started', 'loading_start', etc.
      name,
      stage,
      progress,
      elapsedTime,
      reason,
      watchTime,
      status,
      timeWasted,
      loadingTime,
      buttonAttempts,
      questionsAnswered,
      rickrollWatched,
      rickrollWatchTime,
      messageId,
      localTime,
      url,
      pageTitle,
      
      // Returning visitor data
      isReturning,
      visitNumber,

      // Hardware/specifications
      screen,
      viewport,
      devicePixelRatio,
      colorDepth,
      orientation,
      theme,
      touch,
      language,
      timeZone
    } = payload;

    const visitorName = name ? String(name).trim() : "Friend";
    const cleanSessionId = sessionId ? String(sessionId).trim() : "Unknown";
    const cleanVisitNumber = parseInt(visitNumber || '1', 10);
    const cleanIsReturning = !!isReturning || cleanVisitNumber > 1;

    // Resolve client IP address
    const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'Unknown';
    const cleanIp = ip && ip !== 'Unknown' ? ip.split(',')[0].trim() : 'Unknown';

    // Parse User Agent
    const ua = req.headers['user-agent'] || '';
    const parser = new UAParser(ua);
    const uaResult = parser.getResult();

    const browserName = uaResult.browser.name || "Unknown";
    const browserVer = uaResult.browser.version || "";
    const browserString = browserVer ? `${browserName} ${browserVer}` : browserName;

    const osName = uaResult.os.name || "Unknown";
    const osVer = uaResult.os.version || "";
    const osString = osVer ? `${osName} ${osVer}` : osName;

    let deviceType = "Desktop";
    if (uaResult.device.type === 'mobile') {
      deviceType = "Mobile";
    } else if (uaResult.device.type === 'tablet') {
      deviceType = "Tablet";
    } else if (uaResult.device.type) {
      deviceType = uaResult.device.type.charAt(0).toUpperCase() + uaResult.device.type.slice(1);
    }

    const finalScreen = screen || "Unknown";
    const finalViewport = viewport || "Unknown";
    const finalLocalTime = localTime || new Date().toString();
    const finalUrl = url || "Unknown";

    // Update stats store locally
    const statsUpdate = {
      sessionId: cleanSessionId,
      name: visitorName,
      isReturning: cleanIsReturning,
      visitNumber: cleanVisitNumber,
    };

    // Helper to extract seconds from human readable time "1m 32s" or "45s"
    const parseTimeToSec = (str) => {
      if (!str) return 0;
      let total = 0;
      const mMatch = str.match(/(\d+)\s*m/);
      const sMatch = str.match(/(\d+)\s*s/);
      if (mMatch) total += parseInt(mMatch[1], 10) * 60;
      if (sMatch) total += parseInt(sMatch[1], 10);
      if (!mMatch && !sMatch && /^\d+$/.test(str)) total = parseInt(str, 10);
      return total;
    };

    if (event === 'visitor_started') {
      statsUpdate.status = 'started';
      statsUpdate.timeWasted = 0;
    } else if (event === 'loading_complete') {
      statsUpdate.status = 'quiz';
      statsUpdate.loadingTime = parseFloat(loadingTime) || 0;
    } else if (event === 'quiz_complete') {
      statsUpdate.status = 'button';
      statsUpdate.questionsAnswered = parseInt(questionsAnswered || '12', 10);
    } else if (event === 'button_clicked') {
      statsUpdate.status = 'rickroll';
      statsUpdate.buttonAttempts = parseInt(buttonAttempts || '0', 10);
    } else if (event === 'rickroll_watch_started') {
      statsUpdate.status = 'rickroll';
      statsUpdate.rickrollWatched = true;
    } else if (event === 'rickroll_abandoned') {
      statsUpdate.status = 'abandoned';
      statsUpdate.rickrollWatchTime = parseTimeToSec(watchTime);
    } else if (event === 'rickroll_completed') {
      statsUpdate.status = 'completed';
      statsUpdate.rickrollWatched = true;
      statsUpdate.rickrollWatchTime = 212; // 3m 32s
    } else if (event === 'visitor_left') {
      statsUpdate.status = 'abandoned';
      statsUpdate.timeWasted = parseTimeToSec(elapsedTime);
    } else if (event === 'session_summary') {
      statsUpdate.status = status === 'Completed' ? 'completed' : 'abandoned';
      statsUpdate.timeWasted = parseTimeToSec(timeWasted);
      statsUpdate.loadingTime = parseFloat(loadingTime) || 0;
      statsUpdate.buttonAttempts = parseInt(buttonAttempts || '0', 10);
      statsUpdate.questionsAnswered = parseInt(questionsAnswered || '0', 10);
      statsUpdate.rickrollWatched = rickrollWatched === 'Yes';
      statsUpdate.rickrollWatchTime = parseTimeToSec(rickrollWatchTime);
    }

    // Save update and load latest global sessions for funny stats inclusion
    saveSession(statsUpdate);
    const globalStats = getAggregatedStats();

    // ----------------------------------------------------
    // BUILD CLEAN & LOGICALLY GROUPED DISCORD EMBED
    // ----------------------------------------------------
    let embedTitle = `⏳ Experience Progress Update`;
    let embedColor = 1752220; // Default Cyan
    let milestoneMessage = "Ongoing live session...";

    if (event === 'visitor_started') {
      embedTitle = cleanIsReturning 
        ? `🔄 Returning Visitor • Visit #${cleanVisitNumber}` 
        : `🟢 New Visitor Started the Prank!`;
      embedColor = 3066993; // Green
      milestoneMessage = "Visitor entered their name and pressed Start.";
    } else if (event === 'loading_start') {
      embedTitle = `✅ Loading Screen Started`;
      embedColor = 1752220; // Cyan
      milestoneMessage = "Connecting fake satellites, mining patient energy...";
    } else if (event === 'loading_complete') {
      embedTitle = `✅ Loading Screen Completed`;
      embedColor = 1752220;
      milestoneMessage = `Troll loader reached 100% (Took ${loadingTime || 'N/A'}).`;
    } else if (event === 'quiz_start') {
      embedTitle = `✅ Fake Questions Started`;
      embedColor = 1752220;
      milestoneMessage = "Visitor is now solving the impossible IQ / Verification Quiz.";
    } else if (event === 'quiz_complete') {
      embedTitle = `✅ Fake Questions Completed`;
      embedColor = 1752220;
      milestoneMessage = `All ${questionsAnswered || 12} ridiculous questions answered without noticing the troll.`;
    } else if (event === 'button_appeared') {
      embedTitle = `✅ Moving Button Appeared`;
      embedColor = 1752220;
      milestoneMessage = "The ultimate test: a 'Claim Reward' button that escapes on mouseover.";
    } else if (event === 'prize_allocated') {
      embedTitle = `🎁 Mystery Reward Screen Opened!`;
      embedColor = 15105570; // Gold/Orange
      milestoneMessage = "The escaping button was captured! Allocating ₹10,000 cash prize offer.";
    } else if (event === 'button_clicked') {
      embedTitle = `✅ Moving Button Clicked`;
      embedColor = 1752220;
      milestoneMessage = `Success! The escaping button was clicked after ${buttonAttempts || 0} attempts. Now in Human Verification Captcha.`;
    } else if (event === 'results_generation') {
      embedTitle = `📊 Psychological Evaluation Generated`;
      embedColor = 1752220;
      milestoneMessage = "Finished compiling personality profiles, roasts, and Troll score calculations.";
    } else if (event === 'rickroll_watch_started') {
      embedTitle = `🎵 Rickroll Watch Started`;
      embedColor = 10181046; // Purple
      milestoneMessage = "The legendary music video has loaded and is now playing!";
    } else if (event === 'rickroll_abandoned') {
      embedTitle = `🎵 Rickroll Abandoned`;
      embedColor = 15158332; // Red
      milestoneMessage = `User closed or left after watching for ${watchTime || '0s'}.`;
    } else if (event === 'rickroll_completed') {
      embedTitle = `🏆 Rickroll Completed!`;
      embedColor = 15844367; // Gold
      milestoneMessage = `Spectacular! The user watched the entire Rickroll video (3m 32s)!`;
    } else if (event === 'visitor_left') {
      embedTitle = `❌ Visitor Left Early`;
      embedColor = 15158332; // Red
      milestoneMessage = `User rage-quit/navigated away during stage: **${stage || 'Unknown'}** (Reason: ${reason || 'Unknown'}).`;
    } else if (event === 'session_summary') {
      embedTitle = status === 'Completed' ? `🏆 Session Completed Summary` : `📊 Session Rage-Quit Summary`;
      embedColor = status === 'Completed' ? 15844367 : 3447003; // Gold or Blue
      milestoneMessage = `Final session statistics report.`;
    }

    // Timeline Visual Progress Indicator
    const pPercent = parseInt(progress || '0', 10);
    const getProgressBar = (pct) => {
      const filled = Math.round(pct / 10);
      return "🟩".repeat(filled) + "⬛".repeat(10 - filled) + ` ${pct}%`;
    };

    const isCompletedStatus = (event === 'rickroll_completed' || status === 'Completed');

    // Build fields logically
    const fields = [
      {
        name: "👤 VICTIM PROFILE",
        value: `• **Name:** ${visitorName}\n` +
               `• **Session ID:** \`${cleanSessionId}\`\n` +
               `• **IP Address:** \`${cleanIp}\`\n` +
               `• **Frequency:** ${cleanIsReturning ? `🔄 Returning (Visit #${cleanVisitNumber})` : `🟢 First-time Visit`}`,
        inline: true
      },
      {
        name: "💻 DEVICE & SYSTEM",
        value: `• **OS:** ${osString}\n` +
               `• **Browser:** ${browserString}\n` +
               `• **Device Class:** ${deviceType}\n` +
               `• **Dimensions:** ${finalScreen} (${finalViewport})`,
        inline: true
      }
    ];

    // Timeline statistics
    const elapsedTimeStr = elapsedTime || timeWasted || "N/A";
    fields.push({
      name: "⏱️ EXPERIENCE METRICS",
      value: `• **Current Stage:** \`${stage || 'Intro Screen'}\`\n` +
             `• **Time on Site:** \`${elapsedTimeStr}\`\n` +
             `• **Progress Tracker:** ${getProgressBar(pPercent)}\n` +
             `• **Action Status:** ${milestoneMessage}`,
      inline: false
    });

    // Performance fields (relevant for middle/final stages)
    if (event === 'session_summary' || event === 'visitor_left' || event === 'rickroll_abandoned' || event === 'rickroll_completed') {
      fields.push({
        name: "📈 LIVE SESSION METRICS",
        value: `• **Prank Duration:** \`${elapsedTimeStr}\`\n` +
               `• **Loading Troll:** \`${loadingTime ? loadingTime + 's' : 'N/A'}\`\n` +
               `• **Quiz Questions:** \`${questionsAnswered || 0} Answered\`\n` +
               `• **Button Escape Attempts:** \`${buttonAttempts || 0} clicks failed\`\n` +
               `• **Rickroll Watch:** \`${rickrollWatched || (event === 'rickroll_completed' ? 'Yes' : 'No')}\` (Watched: \`${rickrollWatchTime || watchTime || '00:00'}\`)`,
        inline: false
      });
    }

    // Funny Global Server Statistics inclusion
    fields.push({
      name: "🎭 COMMUNITY PATIENCE METRICS (GLOBAL)",
      value: `• **Today's Victims:** \`${globalStats.victimsToday}\`\n` +
             `• **Total Wasted Time:** \`${globalStats.totalTimeWasted}\`\n` +
             `• **Average Wait to Rickroll:** \`${globalStats.averageTimeBeforeRickroll}\`\n` +
             `• **Average Session Duration:** \`${globalStats.averageSessionTime}\`\n` +
             `• **Rage Quit Ratio:** \`${globalStats.rageQuits} out of ${globalStats.victimsThisWeek} this week\`\n` +
             `• **Longest Ever Patient Hero:** \`${globalStats.longestSession}\``,
      inline: false
    });

    const embed = {
      title: embedTitle,
      color: embedColor,
      description: `🔗 **Source URL:** [Prank Experience Link](${finalUrl})\n` +
                   `📅 **Timestamp:** ${finalLocalTime}`,
      fields: fields,
      timestamp: new Date().toISOString(),
      footer: {
        text: `Ultimate Patience Prank Terminal • Session: ${cleanSessionId}`
      }
    };

    const discordUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordUrl) {
      const payload = { embeds: [embed] };
      let targetUrl = discordUrl;
      let method = 'POST';

      // Live status updates: attempt to PATCH the existing message if messageId is available and it's not a start
      if (messageId && event !== 'visitor_started') {
        const baseWebhookUrl = discordUrl.split('?')[0];
        targetUrl = `${baseWebhookUrl}/messages/${messageId}`;
        method = 'PATCH';
      } else {
        const separator = discordUrl.includes('?') ? '&' : '?';
        targetUrl = `${discordUrl}${separator}wait=true`;
        method = 'POST';
      }

      // Send webhook payload
      let response = await fetch(targetUrl, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Handle fallback if PATCH fails (e.g., if message was deleted by user in Discord)
      if (!response.ok && method === 'PATCH') {
        console.warn(`Discord PATCH failed with status ${response.status}. Re-routing to new POST webhook.`);
        const separator = discordUrl.includes('?') ? '&' : '?';
        targetUrl = `${discordUrl}${separator}wait=true`;
        method = 'POST';
        response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (response.ok) {
        const resData = await response.json();
        // Return updated messageId so client can continue using the same message thread
        const finalMessageId = resData?.id || messageId || `mock_${cleanSessionId}`;
        return res.status(200).json({ success: true, messageId: finalMessageId });
      } else {
        const errorText = await response.text();
        console.error(`Discord Webhook responded with status ${response.status}:`, errorText);
        return res.status(200).json({ success: true, warning: 'Discord webhook responded with error status', messageId: messageId || `mock_${cleanSessionId}` });
      }
    } else {
      console.warn('DISCORD_WEBHOOK_URL is not set in environment.');
      return res.status(200).json({ success: true, warning: 'Webhook URL missing', messageId: `mock_${cleanSessionId}` });
    }
  } catch (err) {
    console.error('Error logging visitor event:', err);
    return res.status(200).json({ success: true, warning: 'Failed silently to avoid breaking the prank flow' });
  }
}
