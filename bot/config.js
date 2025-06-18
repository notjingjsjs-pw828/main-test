// OH MY BABY 🍼
// DON'T COPY MY CMD AND CODES🇦🇫
// POWERED BY NOTHING TECH

const fs = require('fs');
const { getConfig } = require("./lib/configdb");
require('dotenv').config();

function convertToBool(text, fault = 'true') {
    return text === fault ? true : false;
}

module.exports = {
  SESSION_ID: process.env.SESSION_ID || "",
  PREFIX: getConfig("PREFIX") || process.env.PREFIX || ".",
  OWNER_NUMBER: process.env.OWNER_NUMBER || "93744215959",
  OWNER_NAME: process.env.OWNER_NAME || "ɴᴏᴛʜɪɴɢ ᴛᴇᴄʜ",
  BOT_NAME: process.env.BOT_NAME || "ʙᴇɴ-ʙᴏᴛ",
  STICKER_NAME: process.env.STICKER_NAME || "ʙᴇɴ-ʙᴏᴛ",
  DESCRIPTION: process.env.DESCRIPTION || "*© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ɴᴏᴛʜɪɴɢ ᴛᴇᴄʜ*",
  MENU_IMAGE_URL: process.env.MENU_IMAGE_URL || "https://i.postimg.cc/Y2GSGtfG/IMG-20250502-WA0012-1.jpg'",
  ALIVE_IMG: process.env.ALIVE_IMG || "https://i.postimg.cc/Y2GSGtfG/IMG-20250502-WA0012-1.jpg'",
  LIVE_MSG: process.env.LIVE_MSG || "> ᴀʟᴡᴀʏꜱ ᴏɴʟɪɴᴇ ʙᴇɴ-ʙᴏᴛ⚡",
  DEV: process.env.DEV || "93744215959",
  MODE: process.env.MODE || "public",
  AUTO_STATUS_SEEN: process.env.AUTO_STATUS_SEEN || "false",
  AUTO_STATUS_REPLY: process.env.AUTO_STATUS_REPLY || "false",
  AUTO_STATUS_REACT: process.env.AUTO_STATUS_REACT || "false",
  AUTO_STATUS_MSG: process.env.AUTO_STATUS_MSG || "*ꜱᴇᴇɴ ʏᴏᴜʀ ꜱᴛᴀᴛᴜꜱ ʙʏ ʙᴇɴ-ʙᴏᴛ 🤍*",
  AUTO_REACT: process.env.AUTO_REACT || "false",
  AUTO_VOICE: process.env.AUTO_VOICE || "false",
  AUTO_STICKER: process.env.AUTO_STICKER || "false",
  AUTO_REPLY: process.env.AUTO_REPLY || "false",
  AUTO_TYPING: process.env.AUTO_TYPING || "false",
  AUTO_RECORDING: process.env.AUTO_RECORDING || "false",
  ALWAYS_ONLINE: process.env.ALWAYS_ONLINE || "false",
  READ_MESSAGE: process.env.READ_MESSAGE || "false",
  READ_CMD: process.env.READ_CMD || "false",
  ANTI_CALL: getConfig("ANTI_CALL") || "false",
  ANTI_LINK: process.env.ANTI_LINK || "false",
  ANTILINK_WARN: process.env.ANTILINK_WARN || "false",
  ANTILINK_KICK: process.env.ANTILINK_KICK || "false",
  ANTIVIEW_ONCE: process.env.ANTIVIEW_ONCE || "true",
  ANTI_DELETE: process.env.ANTI_DELETE || "true",
  ANTI_DEL_PATH: process.env.ANTI_DEL_PATH || "inbox",
  ANTI_BAD: process.env.ANTI_BAD || "false",
  WELCOME: process.env.WELCOME || "false",
  ADMIN_EVENTS: process.env.ADMIN_EVENTS || "false",
  MENTION_REPLY: process.env.MENTION_REPLY || "false",
  CUSTOM_REACT: process.env.CUSTOM_REACT || "false",
  CUSTOM_REACT_EMOJIS: process.env.CUSTOM_REACT_EMOJIS || "💝,💖,💗,❤️‍🩹,❤️,🧡,💛,💚,💙,💜,🤎,🖤,🤍"
};