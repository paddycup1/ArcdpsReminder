import * as Discord from "discord.js"
import * as fs from "fs"
import * as https from "https"

enum DebugLevel {
  ERROR = 0,
  INFO = 1,
  VERBOSE = 2,
  DEBUG = 3
}

interface ChannelData {
  message: string,
  dmUserId: string
}

const client = new Discord.Client();
const CHANNEL_FILE = "channels.json";
const CONFIG_FILE = "config.json";
const DEFAULT_NOTIFY_MESSAGE = "Arcdps just updated!!";
const DEFAULT_CHECK_UPDATE_INTERVAL = 60 * 60 * 1000;
const DEFAULT_STATUS_MESSAGE = "@mention help";
const DEFAULT_DEBUG_LEVEL = DebugLevel.ERROR;

let gChannels: {
  [key: string]: ChannelData
} = {};

let gConfig: {
  Token?: string,
  CheckUpdateInterval: number,
  DefaultNotifyMessage: string,
  BotStatus: string,
  DebugLevel: string,
  Admins?: string[]
} = {
  CheckUpdateInterval: DEFAULT_CHECK_UPDATE_INTERVAL,
  DefaultNotifyMessage: DEFAULT_NOTIFY_MESSAGE,
  BotStatus: DEFAULT_STATUS_MESSAGE,
  DebugLevel: DebugLevel[DEFAULT_DEBUG_LEVEL],
};

let gTimerId: NodeJS.Timeout;
let gSavedMd5: Buffer;
let gCheckDate: Date = new Date();
let gDebugLevel: DebugLevel = DEFAULT_DEBUG_LEVEL;
let gCommands: {
  generic: {
    [key: string]: (msg: Discord.Message, arg: string) => void
  },
  admin: {
    [key: string]: (msg: Discord.Message, arg: string) => void
  }
} = {
  generic: {
    add: (msg: Discord.Message, arg: string) => {
      if (gChannels[msg.channel.id]) {
        msg.reply("This channel already added");
      } else {
        let channel = {
          message: gConfig.DefaultNotifyMessage,
          dmUserId: ""
        }
        if (arg) {
          channel.message = arg;
        }
        if (msg.channel.type == "dm") {
          channel.dmUserId = msg.author.id;
        }
        gChannels[msg.channel.id] = channel;

        saveChannelFile().then(success => {
          if (success) {
            msg.reply("Added this channel to the notify list");
            log("INFO", `Added channel to list: ${msg.channel.id} message: ${gChannels[msg.channel.id].message}`)
          }
        }).catch(err => {
          msg.reply("Save file ERROR, please contact the bot manager");
          log("ERROR", `Save file ERROR: ${err}`)
        });
      }
    },
    del: (msg: Discord.Message, arg: string) => {
      if (gChannels[msg.channel.id]) {
        delete gChannels[msg.channel.id];
        if (!gChannels[msg.channel.id]) {
          saveChannelFile().then(success => {
            if (success) {
              msg.reply("Delete this channel from the list success");
              log("INFO", `Deleted channel: ${msg.channel.id}`)
            }
          }).catch(err => {
            msg.reply("Save file ERROR, please contact the bot manager");
            log("ERROR", `Save file ERROR: ${err}`)
          });
        }
      } else {
        msg.reply(`This channel doesn't exist in the list`);
        log("ERROR", `Trying to delete unexist channel: ${msg.channel.id}`)
      }
    },
    edit: (msg: Discord.Message, arg: string) => {
      if (gChannels[msg.channel.id]) {
        if (arg) {
          gChannels[msg.channel.id].message = arg;
          saveChannelFile().then(success => {
            if (success) {
              msg.reply("Update message in the list success");
              log("INFO", `Updated message in the list: ${msg.channel.id} to ${gChannels[msg.channel.id].message}`)
            }
          }).catch(err => {
            msg.reply("Save file ERROR, please contact the bot manager");
            log("ERROR", `Save file ERROR: ${err}`)
          });
        } else {
          msg.reply("Please provide message text.");
        }
      } else {
        msg.reply(`This channel doesn't exist in the list`);
        log("ERROR", `Trying to edit message for unexist channel: ${msg.channel.id}`)
      }
    },
    help: (msg: Discord.Message, arg: string) => {
      let mentionText = "@mention";
      if (client.user) {
        if (msg.guild) {
          mentionText = `@${msg.guild.member(client.user.id)?.displayName}`;
        } else if (msg.channel.type == "dm") {
          mentionText = `@${client.user.username}`;
        }
      }

      msg.channel.send(new Discord.MessageEmbed(
        {
          title: "Fancy help message",
          color: [255, 51, 51],
          footer: { text: "View source: https://github.com/paddycup1/ArcdpsReminder" },
          fields: [
            {
              name: `${mentionText} add`,
              value: "Add this channel to notify list"
            },
            {
              name: `${mentionText} del`,
              value: "Delete this channel from notify list"
            },
            {
              name: `${mentionText} edit <message>`,
              value: "Edit notify message"
            },
            {
              name: `${mentionText} help`,
              value: "Display help message"
            },
            {
              name: `${mentionText} test`,
              value: "Test message"
            },
            {
              name: `${mentionText} lastcheck`,
              value: "Show last check status"
            }
          ]
        }
      ));
    },
    test: (msg: Discord.Message, arg: string) => {
      try {
        sendNotify({ id: msg.channel.id, test: true });
      } catch (err) {
        msg.reply(err);
      }
    },
    lastcheck: (msg: Discord.Message, arg: string) => {
      msg.reply(`Current md5: \`${gSavedMd5.toString().replace("\n", "")}\` last checked at ${gCheckDate.toUTCString()}`);
    }
  },
  admin: {
    testall: (msg: Discord.Message, arg: string) => {
      log("INFO", `Test notify, requested by ${msg.author.tag} <@!${msg.author.id}> in channel ${msg.channel.id}`);
      sendNotify({ test: true });
    },
    setdebuglevel: (msg: Discord.Message, arg: string) => {
      if (arg.trim().toLowerCase() == "debug") {
        log("INFO", `Set debug level to DEBUG, requested by ${msg.author.tag} <@!${msg.author.id}> in channel ${msg.channel.id}`);
        gConfig.DebugLevel = "DEBUG";
        gDebugLevel = DebugLevel.DEBUG;
        msg.reply("Set debug level to DEBUG");
      } else if (arg.trim().toLowerCase() == "verbose") {
        log("INFO", `Set debug level to VERBOSE, requested by ${msg.author.tag} <@!${msg.author.id}> in channel ${msg.channel.id}`);
        gConfig.DebugLevel = "VERBOSE";
        gDebugLevel = DebugLevel.VERBOSE;
        msg.reply("Set debug level to VERBOSE");
      } else if (arg.trim().toLowerCase() == "info") {
        log("INFO", `Set debug level to INFO, requested by ${msg.author.tag} <@!${msg.author.id}> in channel ${msg.channel.id}`);
        gConfig.DebugLevel = "INFO";
        gDebugLevel = DebugLevel.INFO;
        msg.reply("Set debug level to INFO");
      } else if (arg.trim().toLowerCase() == "error") {
        log("INFO", `Set debug level to ERROR, requested by ${msg.author.tag} <@!${msg.author.id}> in channel ${msg.channel.id}`);
        gConfig.DebugLevel = "ERROR";
        gDebugLevel = DebugLevel.ERROR;
        msg.reply("Set debug level to ERROR");
      } else {
        msg.reply("Only accept following values: `DEBUG`, `VERBOSE`, `INFO`, `ERROR`");
      }
    },
    setinterval: (msg: Discord.Message, arg: string) => {
      try {
        gConfig.CheckUpdateInterval = parseInt(arg);
        clearInterval(gTimerId);
        gTimerId = initTimer(gConfig.CheckUpdateInterval);
        log("INFO", "Set check interval to " + gConfig.CheckUpdateInterval + `, requested by ${msg.author.tag} <@!${msg.author.id}> in channel ${msg.channel.id}`);
        msg.reply("Set check interval to " + gConfig.CheckUpdateInterval)
        checkUpdate();
      } catch (err) {
        msg.reply(err);
      }
    },
    setstatus: (msg: Discord.Message, arg: string) => {
      if (client.user) {
        gConfig.BotStatus = arg;
        client.user.setPresence({ activity: { type: "PLAYING", name: gConfig.BotStatus } }).then(presence => {
          log("INFO", "Set bot status to " + gConfig.BotStatus + ` requested by ${msg.author.tag} <@!${msg.author.id}> in channel ${msg.channel.id}`);
          msg.reply("Set bot status to " + gConfig.BotStatus);
        }).catch(err => {
          msg.reply(err);
        });
      }
    },
    checknow: (msg: Discord.Message, arg: string) => {
      log("INFO", `Check update, requested by ${msg.author.tag} <@!${msg.author.id}> in channel ${msg.channel.id}`);
      checkUpdate();
      msg.reply("Performed arcdps check.")
    },
    saveconfig: (msg: Discord.Message, arg: string) => {
      let data = JSON.stringify(gConfig, null, 2);
      try {
        fs.writeFileSync("config.json", data);
        log("INFO", `Saved config to file, requested by ${msg.author.tag} <@!${msg.author.id}> in channel ${msg.channel.id}`)
        msg.reply("Config saved successfuly.")
      } catch (err) {
        log("ERROR", err);
        msg.reply(err);
      }
    },
    printconfig: (msg: Discord.Message, arg: string) => {
      msg.reply(`CheckUpdateInterval: \`${gConfig.CheckUpdateInterval}\`\n` +
        `DefaultNotifyMessage: \`${gConfig.DefaultNotifyMessage}\`\n` +
        `BotStatus: \`${gConfig.BotStatus}\`\n` +
        `DebugLevel: \`${gConfig.DebugLevel}\``)
    },
    helpadmin: (msg: Discord.Message, arg: string) => {
      let mentionText = "@mention";
      if (client.user) {
        if (msg.guild) {
          mentionText = `@${msg.guild.member(client.user.id)?.displayName}`;
        } else if (msg.channel.type == "dm") {
          mentionText = `@${client.user.username}`;
        }
      }

      msg.channel.send(new Discord.MessageEmbed(
        {
          title: "Fancy Help Message for Admin",
          color: [51, 51, 255],
          fields: [
            {
              name: `${mentionText} testall`,
              value: "Test notify for all channel"
            },
            {
              name: `${mentionText} setdebuglevel <DEBUG | VERBOSE | INFO | ERROR>`,
              value: "Set logging level"
            },
            {
              name: `${mentionText} setinterval <interval in ms>`,
              value: "Set check interval"
            },
            {
              name: `${mentionText} setstatus <status>`,
              value: "Set bot status"
            },
            {
              name: `${mentionText} checknow`,
              value: "Perform update check immediately"
            },
            {
              name: `${mentionText} saveconfig`,
              value: "Save config to file"
            },
            {
              name: `${mentionText} printconfig`,
              value: "Dump config"
            },
            {
              name: `${mentionText} helpadmin`,
              value: "Display admin help message"
            }
          ]
        }
      ));
    }
  }
}

function log(level: "INFO" | "ERROR" | "VERBOSE" | "DEBUG", message: string) {
  let date = new Date();
  let header = date.getFullYear().toString().padStart(4, "0") + "/" +
    (date.getMonth() + 1).toString().padStart(2, "0") + "/" +
    date.getDate().toString().padStart(2, "0") + " " +
    date.getHours().toString().padStart(2, "0") + ":" +
    date.getMinutes().toString().padStart(2, "0") + ":" +
    date.getSeconds().toString().padStart(2, "0") + "|" + level.padEnd(7, " ") + "| ";
  message = message.replace(/\n/g, " \u2193\n\u2191 ").replace(/^/mg, header);
  if (level == "DEBUG" && gDebugLevel >= DebugLevel.DEBUG) {
    console.log(message);
  } else if (level == "VERBOSE" && gDebugLevel >= DebugLevel.VERBOSE) {
    console.log(message);
  } else if (level == "INFO" && gDebugLevel >= DebugLevel.INFO) {
    console.log(message);
  } else if (level == "ERROR" && gDebugLevel >= DebugLevel.ERROR) {
    console.error(message);
  }
}

function getArcdpsMd5(): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    let request = https.request("https://www.deltaconnected.com/arcdps/x64/d3d9.dll.md5sum", res => {
      res.on("data", data => {
        log("VERBOSE", `Got arcdps md5: ${(data as Buffer).toString().replace("\n", "")}`);
        resolve(data);
      });
    });
    request.on("ERROR", error => {
      reject(error);
    });
    request.end();
  });
}

function sendNotify(args?: { id?: string, test?: boolean }) {
  let targetChannels: { [key: string]: ChannelData } = gChannels;

  if (args?.id != null) {
    if (gChannels[args.id] == null) {
      log("ERROR", "Trying to notify unregistered channel: " + args.id);
      throw new Error("Trying to notify unregistered channel: " + args.id);
    }
    targetChannels = { [args?.id]: gChannels[args?.id] };
  }
  for (let channelId in targetChannels) {
    new Promise<Discord.Channel | null>(resolve => {
      if (gChannels[channelId].dmUserId.length != 0) {
        let user = client.users.resolve(gChannels[channelId].dmUserId);
        if (user) {
          if (user.dmChannel) {
            resolve(user.dmChannel);
          } else {
            resolve(user.createDM());
          }
        } else {
          log("ERROR", `Can't get user by ID ${gChannels[channelId].dmUserId} for DmChannel ${channelId}`);
        }
      } else {
        resolve(client.channels.resolve(channelId));
      }
    }).then(channel => {
      let textChannel: Discord.TextChannel | Discord.DMChannel;

      if (channel == null) {
        log("ERROR", `Can't get channle by ID ${channelId}`);
        return;
      }
      if (channel.type == "text") {
        textChannel = channel as Discord.TextChannel;
      } else if (channel.type = "dm") {
        textChannel = channel as Discord.DMChannel;
      } else {
        log("ERROR", `Channel ${channelId} type ERROR: ${channel.type}`);
        return;
      }
      if (args?.test) {
        textChannel.send("Sending a test message:");
      }
      textChannel.send({ content: gChannels[channelId].message });
    });
  }
}

function saveChannelFile(): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    fs.writeFile(CHANNEL_FILE, JSON.stringify(gChannels), err => {
      if (err) {
        reject(err);
      } else {
        resolve(true);
      }
    });
  });
}

async function checkUpdate() {
  getArcdpsMd5().then(newMd5 => {
    gCheckDate = new Date();
    if (newMd5.compare(gSavedMd5) != 0) {
      log("INFO", "Md5 is changed, send notifies");
      log("INFO", `Old md5: ${gSavedMd5.toString().replace("\n", "")}`);
      log("INFO", `New md5: ${newMd5.toString().replace("\n", "")}`);
      gSavedMd5 = newMd5;
      sendNotify();
    } else {
      log("VERBOSE", "Arcdps has no update");
    }
  });
}

function initTimer(interval: number): NodeJS.Timeout {
  return setInterval(checkUpdate, interval);
}

client.on('ready', () => {
  if (client.user) {
    log("INFO", `Logged in as ${client.user.tag}!`);
    client.user.setPresence({ activity: { type: "PLAYING", name: gConfig.BotStatus } });
  }
});

client.on('message', msg => {
  log("DEBUG", `Message from ${msg.channel.id}: ${msg.content}`);
  let member: Discord.GuildMember | Discord.User | null = client.user as Discord.User;
  if (msg.guild && client.user) {
    member = msg.guild.member(client.user.id)
  }
  if (!msg.author.bot && member && msg.mentions.has(member)) {
    let match = msg.content.match(/<@(?:&|!)?\d+>\s+(\w+)(?:\s+(\S.+))?/);
    if (match) {
      let command = match[1].toLowerCase();
      let arg = match[2] ? match[2] : "";
      let executed: boolean = false;
      for (let cmd in gCommands.generic) {
        if (cmd.toLowerCase() == command) {
          gCommands.generic[cmd](msg, arg);
          executed = true;
          break;
        }
      }
      if (!executed && gConfig != null && gConfig.Admins != null && gConfig.Admins.indexOf(msg.author.id) != -1) {
        for (let cmd in gCommands.admin) {
          if (cmd.toLowerCase() == command) {
            gCommands.admin[cmd](msg, arg);
            executed = true;
            break;
          }
        }
      }
    }
  }
});

let config;
if (fs.existsSync(CHANNEL_FILE)) {
  gChannels = JSON.parse(fs.readFileSync(CHANNEL_FILE).toString().replace(/\/\/.*/g, "").replace(/\/\*.*\*\//gs, ""));
}
if (fs.existsSync(CONFIG_FILE)) {
  config = JSON.parse(fs.readFileSync(CONFIG_FILE).toString().replace(/\/\/.*/g, "").replace(/\/\*.*\*\//gs, ""));
}

if (config == undefined) {
  log("ERROR", "Please create config.json in this folder!!");
} else if (!config.Token) {
  log("ERROR", "Please provide \"Token\" property in config.json");
} else {
  if (config.Token) {
    gConfig.Token = config.Token;
  }
  if (config.CheckUpdateInterval) {
    gConfig.CheckUpdateInterval = config.CheckUpdateInterval;
  }
  if (config.DefaultNotifyMessage) {
    gConfig.DefaultNotifyMessage = config.DefaultNotifyMessage;
  }
  if (config.BotStatus) {
    gConfig.BotStatus = config.BotStatus;
  }
  if (config.DebugLevel) {
    if (config.DebugLevel == "DEBUG" || config.DebugLevel == "VERBOSE" || config.DebugLevel == "INFO" || config.DebugLevel == "ERROR") {
      gConfig.DebugLevel = config.DebugLevel;
      switch (gConfig.DebugLevel) {
        case "DEBUG":
          gDebugLevel = DebugLevel.DEBUG;
          break;
        case "VERBOSE":
          gDebugLevel = DebugLevel.VERBOSE;
          break;
        case "INFO":
          gDebugLevel = DebugLevel.INFO;
          break;
        case "ERROR":
          gDebugLevel = DebugLevel.ERROR;
          break;
      }
    } else {
      log("ERROR", "The value of the \"DebugLevel\" property in config.json must be one of following: \"DEBUG\", \"VERBOSE\", \"INFO\", \"ERROR\"");
    }
  }
  if (config.Admins) {
    gConfig.Admins = config.Admins;
  }
  client.login(gConfig.Token).then(() => {
    getArcdpsMd5().then(md5 => {
      gSavedMd5 = md5;
      log("INFO", "First md5: " + gSavedMd5.toString().replace("\n", ""))
      gTimerId = initTimer(gConfig.CheckUpdateInterval);
    })
  });
}
