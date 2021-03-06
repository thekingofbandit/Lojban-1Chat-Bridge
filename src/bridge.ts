"use strict";
declare var process: {
  env: {
    NTBA_FIX_319: number;
    HOME: string;
  };
  argv: string[];
};
process.env.NTBA_FIX_319 = 1;
// process.on('warning', (e: any) => console.warn(e.stack));
const package_json = require("../package");

// messengers' libs
const { login } = require("../lib/libfb-js/dist/FBMessenger.js");

import * as Telegram from "node-telegram-bot-api";
const sanitizeHtml = require("sanitize-html");

const { VK } = require("vk-io");
const VkBot = require("node-vk-bot-api");

const Discord = require("discord.js");

const { RTMClient, WebClient } = require("@slack/client");
const emoji = require("node-emoji");

const slackify = require("./formatting-converters/slackify-html-ts");

const marked = require("marked");
const lexer = new marked.Lexer();
lexer.rules.list = { exec: () => {} };
lexer.rules.listitem = { exec: () => {} };

const html2md = require("./formatting-converters/html2md-ts");

const Irc = require("irc-upd");
const ircolors = require("./formatting-converters/irc-colors-ts");

const finalhandler = require("finalhandler");
const http = require("http");
const serveStatic = require("serve-static");

// syntactic sugar
import debug from "debug";

const R = require("ramda");
const Queue = require("../lib/sugar/promise-queue");
const { to } = require("await-to-js");
const { or } = require("./sugar/await-or.js");
const blalalavla = require("./sugar/blalalavla.js");
// file system and network libs
const fs = require("fs-extra");
const path = require("path");
const mkdirp = require("mkdirp");
import * as request from "request";

// NLP & spam libs
// const lojban = require("lojban")

// global objects
const UrlRegExp = new RegExp(
  "(?:(?:https?|ftp|file)://|www.|ftp.)(?:([-A-Z0-9+&@#/%=~_|$?!:,.]*)|[-A-Z0-9+&@#/%=~_|$?!:,.])*(?:([-A-Z0-9+&@#/%=~_|$?!:,.]*)|[A-Z0-9+&@#/%=~_|$])",
  "igm"
);
const PageTitleRegExp = /(<\s*title[^>]*>(.+?)<\s*\/\s*title)>/gi;

interface Json {
  [index: string]: string | boolean | RegExp;
}

interface IMessengerInfo {
  [x: string]: any;
}

type TextFormatConverterType = (x: string) => Promise<any>;

interface IMessengerFunctions {
  [x: string]: TextFormatConverterType;
}

interface Igeneric extends IMessengerInfo {
  LogToAdmin?: any;
  sendOnlineUsersTo?: any;
  downloadFile?: any;
  ConfigBeforeStart?: any;
  PopulateChannelMapping?: any;
  LocalizeString?: any;
  sanitizeHtml?: any;
  randomValueBase64?: any;
  escapeHTML?: any;
  writeCache?: any;
  MessengersAvailable?: any;
}

const generic: Igeneric = {
  facebook: {},
  telegram: {},
  vkboard: {},
  vkwall: {},
  slack: {},
  mattermost: {},
  discord: {},
  irc: {},
  fallback: {}
};

const prepareToWhom: Igeneric = {};
const prepareAuthor: Igeneric = {};
const GetChunks: Igeneric = {};

const queueOf: IMessengerInfo = {};
const receivedFrom: IMessengerInfo = {};
const sendTo: IMessengerInfo = {};
const StartService: IMessengerInfo = {};
interface IsendToArgs {
  channelId: string;
  author: string;
  chunk: string;
  action: string;
  quotation: boolean;
  file?: string;
}

const convertTo: IMessengerFunctions = {};
const convertFrom: IMessengerFunctions = {};
const GetName: IMessengerInfo = {};
const GetChannels: IMessengerInfo = {};
const GotProblem: IMessengerInfo = {};
const AdaptName: IMessengerInfo = {};
const BootService: IMessengerInfo = {};
const NewChannelAppeared: IMessengerInfo = {};

//declare messengers
generic.telegram.Start = () => {
  return new Telegram(config.telegram.token, {
    polling: true
  });
};

generic.vkboard.Start = async () => {
  const vkio = new VK();
  vkio.setOptions({
    appId: config.vkboard.appId,
    login: config.vkboard.login,
    password: config.vkboard.password
  });
  const [err, app] = await to(vkio.auth.implicitFlowUser().run());
  if (err) {
    console.error("vkboard", err.toString());
  }
  const vkbot = new VkBot({
    token: config.vkboard.token,
    group_id: config.vkboard.group_id
  });
  return { bot: vkbot, app };
};

generic.vkwall.Start = async () => {
  const vkio = new VK();
  vkio.setOptions({
    appId: config.vkwall.appId,
    login: config.vkwall.login,
    password: config.vkwall.password
  });
  const [err, app] = await to(vkio.auth.implicitFlowUser().run());
  if (err) {
    console.error("vkwall", err.toString());
  }
  const vkbot = new VkBot({
    token: config.vkwall.token,
    group_id: config.vkwall.group_id
  });
  return { bot: vkbot, app };
};

generic.slack.Start = async () => {
  generic.slack.client = {
    rtm: new RTMClient(config.slack.token),
    web: new WebClient(config.slack.token)
  };
  generic.slack.client.rtm.start().catch((e: any) => {
    if (!R.path(["data", "ok"], e)) {
      config.MessengersAvailable.slack = false;
      console.log("couldn't start Slack");
      return;
    }
  });
};
generic.discord.Start = async () => {
  return new Promise(resolve => {
    const client = new Discord.Client();
    generic.discord.client = client;
    generic.discord.guilds = client.guilds.array();
    if (config.discord.guildId) {
      const guild = client.guilds.find(
        (guild: any) =>
          guild.name.toLowerCase() === config.discord.guildId.toLowerCase() ||
          guild.id === config.discord.guildId
      );
      if (guild)
        generic.discord.guilds = [
          guild,
          ...generic.discord.guilds.filter(
            (_guild: any) => _guild.id !== guild.id
          )
        ];
    }
    generic.discord.guilds.getAll = (name: string) =>
      [].concat(
        ...generic.discord.guilds.map((guild: any) => guild[name].array())
      );
    resolve();
  });
};
generic.mattermost.Start = async () => {
  let [err, res] = await to(
    new Promise(resolve => {
      const credentials = {
        login_id: config.mattermost.login,
        password: config.mattermost.password
      };
      const url = `${config.mattermost.ProviderUrl}/api/v4/users/login`;
      request(
        {
          body: JSON.stringify(credentials),
          method: "POST",
          url
        },
        (err: any, response: any, body: any) => {
          if (err) {
            console.error(err);
            resolve();
          } else {
            resolve({
              token: R.pathOr("", ["headers", "token"], response),
              id: JSON.parse(body).id
            });
          }
        }
      );
    })
  );
  if (err || !res) {
    config.MessengersAvailable.mattermost = false;
    return;
  } else {
    config.mattermost.token = res.token;
    config.mattermost.user_id = res.id;
  }

  [err, res] = await to(
    new Promise(resolve => {
      const user_id = config.mattermost.user_id;
      const url = `${
        config.mattermost.ProviderUrl
      }/api/v4/users/${user_id}/teams`;
      request(
        {
          method: "GET",
          url,
          headers: {
            Authorization: `Bearer ${config.mattermost.token}`
          }
        },
        (error: any, response: any, body: any) => {
          if (err) {
            console.error(err);
            resolve();
          } else {
            const team = JSON.parse(body).find((i: any) => {
              return (
                i.display_name === config.mattermost.team ||
                i.name === config.mattermost.team
              );
            });
            config.mattermost.team_id = team.id;
            resolve(team);
          }
        }
      );
    })
  );
  if (!res) {
    config.MessengersAvailable.mattermost = false;
    return;
  }

  const ReconnectingWebSocket = require("reconnecting-websocket");
  return new ReconnectingWebSocket(config.mattermost.APIUrl, [], {
    WebSocket: require("ws")
  });
};

// sendTo
async function FormatMessageChunkForSending({
  messenger,
  channelId,
  author,
  chunk,
  action,
  title,
  quotation
}: {
  messenger: string;
  channelId: number | string;
  author: string;
  chunk: string;
  action: string;
  title?: string;
  quotation: boolean;
}) {
  if (quotation) {
    if (!author || author === "") author = "-";
    chunk = generic.LocalizeString({
      messenger,
      channelId,
      localized_string_key: `OverlayMessageWithQuotedMark.${messenger}`,
      arrElemsToInterpolate: [
        ["author", author],
        ["chunk", chunk],
        ["title", title]
      ]
    });
  } else if (author && author !== "") {
    if ((config[messenger].Actions || []).includes(action)) {
      chunk = generic.LocalizeString({
        messenger,
        channelId,
        localized_string_key: `sendTo.${messenger}.action`,
        arrElemsToInterpolate: [
          ["author", author],
          ["chunk", chunk],
          ["title", title]
        ]
      });
    } else {
      chunk = generic.LocalizeString({
        messenger,
        channelId,
        localized_string_key: `sendTo.${messenger}.normal`,
        arrElemsToInterpolate: [
          ["author", author],
          ["chunk", chunk],
          ["title", title]
        ]
      });
    }
  } else {
    chunk = generic.LocalizeString({
      messenger,
      channelId,
      localized_string_key: `sendTo.${messenger}.ChunkOnly`,
      arrElemsToInterpolate: [["chunk", chunk], ["title", title]]
    });
  }
  return chunk;
}

sendTo.facebook = async ({
  channelId,
  author,
  chunk,
  action,
  quotation,
  file
}: IsendToArgs) => {
  if (
    R.path(
      ["channelMapping", "facebook", channelId, "settings", "readonly"],
      config
    ) ||
    !generic.facebook.client
  )
    return;
  queueOf.facebook.pushTask((resolve: any) => {
    setTimeout(() => {
      const jsonMessage: Json = {
        body: chunk
      };
      if (file) jsonMessage.attachment = fs.createReadStream(file);
      generic.facebook.client.sendMessage(channelId, chunk).catch(catchError);
      resolve();
    }, 500);
  });
};

sendTo.telegram = async ({
  channelId,
  author,
  chunk,
  action,
  quotation,
  file
}: IsendToArgs) => {
  if (
    R.path(
      ["channelMapping", "telegram", channelId, "settings", "readonly"],
      config
    )
  )
    return;
  queueOf.telegram.pushTask((resolve: any) => {
    generic.telegram.client
      .sendMessage(channelId, chunk, {
        parse_mode: "HTML"
      })
      .then(() => resolve())
      .catch((err: any) => {
        generic.LogToAdmin(
          channelId +
            "<br/>\n" +
            err.toString() +
            "<br/>\n" +
            chunk +
            "<br/>\n" +
            JSON.stringify(config.channelMapping, null, 2)
        );
        resolve();
      });
  });
};

sendTo.discord = async ({
  channelId,
  author,
  chunk,
  action,
  quotation,
  file
}: IsendToArgs) => {
  if (
    R.path(
      ["channelMapping", "discord", channelId, "settings", "readonly"],
      config
    )
  )
    return;

  queueOf.discord.pushTask((resolve: any) => {
    generic.discord.client.channels
      .get(channelId)
      .send(chunk)
      .catch(catchError);
    resolve();
  });
};

sendTo.mattermost = async ({
  channelId,
  author,
  chunk,
  action,
  quotation,
  file
}: IsendToArgs) => {
  if (
    R.path(
      ["channelMapping", "mattermost", channelId, "settings", "readonly"],
      config
    )
  )
    return;
  queueOf.mattermost.pushTask((resolve: any) => {
    const option = {
      url: config.mattermost.HookUrl,
      json: {
        text: chunk,
        // username: author,
        channel: channelId
      }
    };
    const req = request.post(option, (error: any, response: any, body: any) => {
      resolve();
    });
  });
};
sendTo.vkwall = async ({
  channelId,
  author,
  chunk,
  action,
  quotation,
  file
}: IsendToArgs) => {
  if (
    R.path(
      ["channelMapping", "vkwall", channelId, "settings", "readonly"],
      config
    )
  )
    return;
  if (!generic.vkwall.client.app) {
    config.MessengersAvailable.vkwall = false;
    return;
  }
  const token = generic.vkwall.client.app.token;
  queueOf.vk.pushTask((resolve: any) => {
    setTimeout(() => {
      generic.vkwall.client.bot
        .api("wall.createComment", {
          access_token: token,
          owner_id: "-" + config.vkwall.group_id,
          post_id: channelId,
          from_group: config.vkwall.group_id,
          reply_to_comment: 1,
          message: chunk
        })
        .then((res: any) => {})
        .catch(catchError);
      resolve();
    }, 30000);
  });
};

sendTo.vkboard = async ({
  channelId,
  author,
  chunk,
  action,
  quotation,
  file
}: IsendToArgs) => {
  if (
    R.path(
      ["channelMapping", "vkboard", channelId, "settings", "readonly"],
      config
    ) //todo: !vk.WaitingForCaptcha
  )
    return;
  if (!generic.vkboard.client.app) {
    config.MessengersAvailable.vkboard = false;
    return;
  }
  const token = generic.vkboard.client.app.token;
  queueOf.vk.pushTask((resolve: any) => {
    setTimeout(() => {
      generic.vkboard.client.bot
        .api("board.createComment", {
          access_token: token,
          group_id: config.vkboard.group_id,
          topic_id: channelId,
          message: chunk,
          from_group: 1
        })
        .then((res: any) => {})
        .catch(catchError);
      resolve();
    }, 10000);
  });
  // if (err.error.error_code === 14) {
  //   vkboard.io.setCaptchaHandler(async ({ src }, retry) => {
  //     //todo: send image to telegram,a reply is expected
  //     vk.WaitingForCaptcha = true;
  //     const key = await myAwesomeCaptchaHandler(src);
  //     vk.WaitingForCaptcha = false;
  //     try {
  //       await retry(key);
  //
  //       console.log("Капча успешно решена");
  //     } catch (error) {
  //       console.log("Капча неверная", error.toString());
  //     }
  //   });
  // }
};

async function myAwesomeCaptchaHandler() {}

sendTo.slack = async ({
  channelId,
  author,
  chunk,
  action,
  quotation,
  file
}: IsendToArgs) => {
  if (
    R.path(
      ["channelMapping", "slack", channelId, "settings", "readonly"],
      config
    )
  )
    return;
  queueOf.slack.pushTask((resolve: any) => {
    chunk = emoji.unemojify(chunk);
    generic.slack.client.web.chat
      .postMessage({
        channel: channelId,
        username: (author || "").replace(/(^.{21}).*$/, "$1"),
        text: chunk
      })
      .then(() => resolve())
      .catch((err: any) => {
        console.error(err);
        resolve();
      });
  });
};

sendTo.irc = async ({
  channelId,
  author,
  chunk,
  action,
  quotation,
  file
}: IsendToArgs) => {
  if (
    R.path(["channelMapping", "irc", channelId, "settings", "readonly"], config)
  )
    return;
  queueOf.irc.pushTask((resolve: any) => {
    // if (config.irc.Actions.includes(action))
    //   chunk = ircolors.underline(chunk);
    generic.irc.client.say(channelId, chunk);
    resolve();
  });
};

// sendFrom
async function prepareChunks({
  messenger,
  channelId,
  text,
  edited,
  messengerTo
}: {
  messenger: string;
  messengerTo: string;
  channelId: string | number;
  text: string;
  edited?: boolean;
}) {
  let arrChunks: string[],
    fallback: string = "fallback";
  if (GetChunks[messengerTo]) fallback = messengerTo;
  arrChunks = await GetChunks[fallback](text, messengerTo);
  for (let i in arrChunks) {
    if (edited)
      arrChunks[i] = generic.LocalizeString({
        messenger,
        channelId,
        localized_string_key: "OverlayMessageWithEditedMark",
        arrElemsToInterpolate: [["message", arrChunks[i]]]
      });
  }
  return arrChunks;
}

prepareToWhom.irc = function({
  text,
  channelId
}: {
  text: string;
  channelId: string | number;
}) {
  const ColorificationMode = R.pathOr(
    "color",
    ["channelMapping", "irc", channelId, "settings", "nickcolor"],
    config
  );
  return `${ircolors.MoodifyText({
    text,
    mood: ColorificationMode
  })}: `;
};

prepareToWhom.fallback = function({
  text,
  channelId
}: {
  text: string;
  channelId: string | number;
}) {
  return `${text}: `;
};
prepareAuthor.irc = function({
  text,
  channelId
}: {
  text: string;
  channelId: string | number;
}) {
  const ColorificationMode = R.pathOr(
    "color",
    ["channelMapping", "irc", channelId, "settings", "nickcolor"],
    config
  );
  return `${ircolors.MoodifyText({
    text,
    mood: ColorificationMode
  })}`;
};

prepareAuthor.fallback = function({
  text,
  channelId
}: {
  text: string;
  channelId: string | number;
}) {
  return `${text}`;
};

// sendFrom
async function sendFrom({
  messenger,
  channelId,
  author,
  text,
  ToWhom,
  quotation,
  action,
  file,
  edited
}: {
  messenger: string;
  channelId: string | number;
  author: string;
  text: string;
  ToWhom?: string;
  quotation?: boolean;
  action?: string;
  file?: string;
  edited?: boolean;
}) {
  const ConfigNode = R.path(["channelMapping", messenger, channelId], config);
  if (!ConfigNode)
    return generic.LogToAdmin(
      `error finding assignment to ${messenger} channel with id ${channelId}`
    );
  if (!text || text === "") return;
  text = await convertFrom[messenger](text);
  text = text.replace(/^(<br\/>)+/, "");
  for (const messengerTo of Object.keys(config.channelMapping)) {
    if (
      config.MessengersAvailable[messengerTo] &&
      ConfigNode[messengerTo] &&
      messenger !== messengerTo
    ) {
      let thisToWhom: string = "";
      if (ToWhom)
        if (prepareToWhom[messengerTo]) {
          thisToWhom = prepareToWhom[messengerTo]({ text: ToWhom, channelId });
        } else thisToWhom = prepareToWhom.fallback({ text: ToWhom, channelId });
      if (!author) author = "";
      if (prepareAuthor[messengerTo]) {
        author = prepareAuthor[messengerTo]({ text: author, channelId });
      } else author = prepareAuthor.fallback({ text: author, channelId });
      debug("generic")(
        `converting for messenger ${messengerTo} the text "` + text + `"`
      );
      let textTo = await convertTo[messengerTo](text);
      debug("generic")(
        `converted for messenger ${messengerTo} to text "` + textTo + `"`
      );
      let Chunks = await prepareChunks({
        messenger,
        channelId,
        text: textTo,
        edited,
        messengerTo
      });
      for (const i in Chunks) {
        const chunk = Chunks[i];
        Chunks[i] = await FormatMessageChunkForSending({
          messenger: messengerTo,
          channelId,
          title: R.path(["vkboard", "group_id"], config),
          author,
          chunk: thisToWhom + chunk,
          action,
          quotation
        });
      }

      Chunks.map(chunk => {
        sendTo[messengerTo]({
          channelId: ConfigNode[messengerTo],
          author,
          chunk,
          quotation,
          action,
          file
        });
      });
    }
  }
}

receivedFrom.discord = async (message: any) => {
  if (
    !R.path(
      [
        "channelMapping",
        "discord",
        R.pathOr("", ["channel", "id"], message).toString()
      ],
      config
    )
  )
    return;
  if (message.author.bot || message.channel.type !== "text") return;
  const edited = message.edited ? true : false;
  for (let value of message.attachments.values()) {
    //media of attachment
    //todo: height,width,generic.LocalizeString
    let [err, res] = await to(
      generic.downloadFile({
        type: "simple",
        remote_path: value.url
      })
    );
    let file: string, localfile: string;

    if (R.path([1], res)) {
      [file, localfile] = res;
    } else {
      file = value.url;
      localfile = value.url;
    }
    debug("discord")("sending text: " + file);
    sendFrom({
      messenger: "discord",
      channelId: message.channel.id,
      author: message.author.username,
      text: file,
      file: localfile,
      edited
    });
    //text of attachment
    const text = generic.discord.reconstructPlainText(message, value.content);
    sendFrom({
      messenger: "discord",
      channelId: message.channel.id,
      author: message.author.username,
      text,
      edited
    });
  }

  const text = generic.discord.reconstructPlainText(message, message.content);
  sendFrom({
    messenger: "discord",
    channelId: message.channel.id,
    author: message.author.username,
    text,
    edited
  });
};

// receivedFrom
receivedFrom.facebook = async (message: any) => {
  if (
    !R.path(
      ["channelMapping", "facebook", (message.threadId || "").toString()],
      config
    )
  )
    return;
  let err, res;
  [err, res] = await to(generic.facebook.client.getUserInfo(message.authorId));
  if (err) return;
  let author: string;
  author = AdaptName.facebook(res);

  if (!message.attachments) message.attachments = [];
  if (message.stickerId)
    message.attachments.push({ id: message.stickerId, type: "sticker" });
  for (const attachment of message.attachments) {
    if (attachment.type === "sticker") {
      [err, res] = await to(
        generic.facebook.client.getStickerURL(attachment.id)
      );
    } else {
      [err, res] = await to(
        generic.facebook.client.getAttachmentURL(message.id, attachment.id)
      );
    }
    if (err) return;
    //todo: add type="photo","width","height","size"
    generic
      .downloadFile({
        type: "simple",
        remote_path: res
      })
      .then(([file, localfile]: [string, string]) => {
        sendFrom({
          messenger: "facebook",
          channelId: message.threadId,
          author,
          text: file,
          file: localfile
        });
      });
  }

  if (message.message)
    sendFrom({
      messenger: "facebook",
      channelId: message.threadId,
      author,
      text: message.message
    });
};

receivedFrom.telegram = async (message: Telegram.Message) => {
  //spammer
  //1. remove entered bots
  TelegramRemoveAddedBots(message);
  //2. check if admin else leave chat and return
  if (await TelegramLeaveChatIfNotAdmin(message)) return;
  //3. check for spam
  if (await TelegramRemoveSpam(message)) return;
  //4. check if new member event
  if (TelegramRemoveNewMemberMessage(message)) return;
  //now deal with the message that is fine
  if (!config.channelMapping.telegram) return;

  const age = Math.floor(Date.now() / 1000) - message.date;
  if (config.telegram.maxMsgAge && age > config.telegram.maxMsgAge)
    return console.log(
      `skipping ${age} seconds old message! NOTE: change this behaviour with config.telegram.maxMsgAge, also check your system clock`
    );

  if (!config.channelMapping.telegram[message.chat.id]) {
    if (
      config.cache.telegram[message.chat.title] &&
      config.cache.telegram[message.chat.title] === message.chat.id
    )
      return; //cached but unmapped channel so ignore it and exit the function
    await to(
      NewChannelAppeared.telegram({
        channelName: message.chat.title,
        channelId: message.chat.id
      })
    );
    if (!config.channelMapping.telegram[message.chat.id]) return;
  }

  // send message
  if (message.text && !message.text.indexOf("/names")) {
    generic.sendOnlineUsersTo("telegram", message.chat.id);
    return;
  }

  // skip posts containing media if it's configured off
  if (
    (message.audio ||
      message.document ||
      message.photo ||
      message.sticker ||
      message.video ||
      message.voice ||
      message.contact ||
      message.location) &&
    !config.generic.showMedia
  )
    return;

  await sendFromTelegram({
    message: message.reply_to_message,
    quotation: true
  });
  sendFromTelegram({ message });
};

generic.discord.reconstructPlainText = (message: any, text: string) => {
  if (!text) return "";
  const massMentions = ["@everyone", "@here"];
  if (
    massMentions.some((massMention: string) => text.includes(massMention)) &&
    !config.discord.massMentions
  ) {
    massMentions.forEach((massMention: string) => {
      text = text.replace(new RegExp(massMention, "g"), `\`${massMention}\``);
    });
  }
  let matches = text.match(/<[\!&]?@[^# ]{2,32}>/g);
  if (matches && matches[0])
    for (let match of matches) {
      const core = match.replace(/[@<>\!&]/g, "");
      const member = message.channel.guild.members
        .array()
        .find(
          (member: any) =>
            member.user.username && member.user.id.toLowerCase() === core
        );
      if (member) text = text.replace(match, "@" + member.user.username);
    }
  matches = text.match(/<#[^# ]{2,32}>/g);
  if (matches && matches[0])
    for (let match of matches) {
      const core = match.replace(/[<>#]/g, "");
      const chan = Object.keys(config.cache.discord).filter(
        i => config.cache.discord[i] === core
      );
      if (chan[0]) text = text.replace(match, "#" + chan[0]);
    }

  return text;
};

// reconstructs the original raw markdown message
generic.telegram.reconstructMarkdown = (msg: Telegram.Message) => {
  if (!msg.entities) return msg;
  const incrementOffsets = (from: number, by: number) => {
    msg.entities.forEach((entity: any) => {
      if (entity.offset > from) entity.offset += by;
    });
  };

  // example markdown:
  // pre `txt` end
  let pre; // contains 'pre '
  let txt; // contains 'txt'
  let end; // contains ' end'

  msg.entities.forEach(({ type, offset, length, url }) => {
    switch (type) {
      case "text_link": // [text](url)
        pre = msg.text.substr(0, offset);
        txt = msg.text.substr(offset, length);
        end = msg.text.substr(offset + length);

        msg.text = `${pre}[${txt}](${url})${end}`;
        incrementOffsets(offset, 4 + url.length);
        break;
      case "code": // ` code
        pre = msg.text.substr(0, offset);
        txt = msg.text.substr(offset, length);
        end = msg.text.substr(offset + length);

        msg.text = `${pre}\`${txt}\`${end}`;
        incrementOffsets(offset, 2);
        break;
      case "pre": // ``` code blocks
        pre = msg.text.substr(0, offset);
        txt = msg.text.substr(offset, length);
        end = msg.text.substr(offset + length);

        msg.text = `${pre}\`\`\`${txt}\`\`\`${end}`;
        incrementOffsets(offset, 6);
      //   break;
      // case "hashtag": // #hashtags can be passed on as is
      // break;
      // default:
      //   console.warn("unsupported entity type:", type, msg);
    }
  });
  return msg;
};

function IsSpam(message: any): boolean {
  const l = config.spamremover.telegram
    .map((rule: any) => {
      let matches = true;
      for (const key of Object.keys(rule)) {
        const msg_val = R.path(key.split("."), message);
        if (rule[key] === true && !msg_val) matches = false;
        if (
          typeof rule[key] === "object" &&
          (!msg_val || msg_val.search(new RegExp(rule[key].source, "i")) === -1)
        )
          matches = false;
      }
      return matches;
    })
    .some(Boolean);
  return l;
}

async function sendFromTelegram({
  message,
  quotation
}: {
  message: any;
  quotation?: boolean;
}) {
  if (!message) return;
  let action;
  message = generic.telegram.reconstructMarkdown(message);
  //collect attachments
  const jsonMessage: any = {};
  let i = 0;
  for (const el of [
    "document",
    "photo",
    "new_chat_photo",
    "sticker",
    "video",
    "audio",
    "voice",
    "location",
    "contact",
    "caption",
    "text"
  ]) {
    if (message[el]) {
      jsonMessage[el] = { url: message[el].file_id };
      if (el === "photo") {
        const photo = message[el][message[el].length - 1];
        jsonMessage[el] = {
          ...jsonMessage[el],
          url: photo.file_id,
          width: photo.width,
          height: photo.height,
          index: i++
        };
      } else if (el === "sticker") {
        jsonMessage[el] = {
          ...jsonMessage[el],
          width: message[el].width,
          height: message[el].height,
          index: i++
        };
      } else if (el === "location") {
        jsonMessage[el] = {
          latitude: message[el]["latitude"],
          longtitude: message[el]["longtitude"],
          index: i++
        };
      } else if (el === "contact") {
        jsonMessage[el] = {
          first_name: message[el]["first_name"],
          last_name: message[el]["last_name"],
          phone_number: message[el]["phone_number"],
          index: i++
        };
      } else if (el === "caption") {
        jsonMessage[el] = {
          text: message[el],
          index: 998
        };
      } else if (["video", "voice", "audio"].includes(el)) {
        jsonMessage[el] = {
          ...jsonMessage[el],
          duration: message[el].duration,
          index: i++
        };
      }
    }
    if (el === "text") {
      message[el] = message[el] || "";
      if (!quotation && message[el].indexOf("/me ") === 0) {
        action = "action";
        message[el] = message[el]
          .split("/me ")
          .slice(1)
          .join("/me ");
      }
      jsonMessage[el] = {
        text: message[el],
        index: 999
      };
    }
  }
  let arrMessage = Object.keys(jsonMessage).sort(
    (a, b) => jsonMessage[a].index - jsonMessage[b].index
  );

  const reply_to_bot =
    quotation && message.from.id === config.telegram.myUser.id ? true : false;
  let author = "";
  if (reply_to_bot && jsonMessage["text"] && jsonMessage["text"].text) {
    const arrTxtMsg = jsonMessage["text"].text.split(": ");
    author = arrTxtMsg[0];
    jsonMessage["text"].text = arrTxtMsg.slice(1).join(": ");
  } else if (!reply_to_bot) {
    author = GetName.telegram(message.from);
  }
  // now send from Telegram
  for (let i: number = 0; i < arrMessage.length; i++) {
    const el = arrMessage[i];
    if (el === "text") {
      jsonMessage[el].text = jsonMessage[el].text.replace(
        `@${config.telegram.myUser.username}`,
        ""
      );
      if (
        quotation &&
        jsonMessage[el].text.length > config["telegram"].MessageLength
      )
        jsonMessage[el].text = `${jsonMessage[el].text.substring(
          0,
          config["telegram"].MessageLength - 1
        )} ...`;
    }
    if (jsonMessage[el].url)
      [
        jsonMessage[el].url,
        jsonMessage[el].local_file
      ] = await generic.telegram.serveFile(jsonMessage[el].url);
    const arrForLocal = Object.keys(jsonMessage[el]).map(i => [
      i,
      jsonMessage[el][i]
    ]);
    const text = generic.LocalizeString({
      messenger: "telegram",
      channelId: message.chat.id,
      localized_string_key: `MessageWith.${el}.telegram`,
      arrElemsToInterpolate: arrForLocal
    });
    const edited = message.edit_date ? true : false;
    sendFrom({
      messenger: "telegram",
      channelId: message.chat.id,
      author,
      text,
      action,
      quotation,
      file: jsonMessage[el].local_file,
      edited
    });
  }
}

receivedFrom.vkwall = async (message: any) => {
  if (!config.channelMapping.vkwall) return;
  const channelId = message.post_id;
  if (
    !config.channelMapping.vkwall[channelId] ||
    "-" + config.vkwall.group_id === message.from_id.toString()
  )
    return;
  if (!generic.vkwall.client.app) {
    config.MessengersAvailable.vkwall = false;
    return;
  }
  let text = message.text;
  const fromwhomId = message.from_id;
  let [err, res] = await to(
    generic.vkwall.client.bot.api("users.get", {
      user_ids: fromwhomId,
      access_token: config.vkwall.token,
      fields: "nickname,screen_name"
    })
  );
  res = R.pathOr(fromwhomId, ["response", 0], res);
  const author = AdaptName.vkwall(res);

  let arrQuotes: string[] = [];
  text.replace(
    /\[[^\]]+:bp-([^\]]+)_([^\]]+)\|[^\]]*\]/g,
    (match: any, group_id: string, post_id: string) => {
      if (group_id === config.vkwall.group_id) {
        arrQuotes.push(post_id);
      }
    }
  );
  if (arrQuotes.length > 0) {
    const token = generic.vkwall.client.app.token;
    for (const el of arrQuotes) {
      const opts = {
        access_token: token,
        group_id: config.vkwall.group_id,
        topic_id: channelId,
        start_comment_id: el,
        count: 1,
        v: "5.84"
      };
      [err, res] = await to(
        generic.vkwall.client.bot.api("board.getComments", opts)
      );
      let text: string = R.path(["response", "items", 0, "text"], res);
      if (!text) continue;
      let replyuser: string;
      const rg = new RegExp(
        `^\\[club${config.vkwall.group_id}\\|(.*?)\\]: (.*)$`
      );
      if (rg.test(text)) {
        [, replyuser, text] = text.match(rg);
      } else {
        let authorId = R.path(["response", "items", 0, "from_id"], res);
        [err, res] = await to(
          generic.vkwall.client.bot.api("users.get", {
            user_ids: authorId,
            access_token: config.vkwall.token,
            fields: "nickname,screen_name"
          })
        );
        replyuser = R.pathOr("", ["response", 0], res);
        replyuser = AdaptName.vkwall(replyuser);
      }
      sendFrom({
        messenger: "vkwall",
        channelId,
        author: replyuser,
        text,
        quotation: true
      });
    }
  }
  const attachments = R.pathOr([], ["attachments"], message);
  let texts = [];
  if (attachments.length > 0) {
    for (let a of attachments) {
      switch (a.type) {
        case "photo":
        case "posted_photo":
          try {
            const sizes = a.photo.sizes
              .map((i: any) => {
                i.square = i.width * i.height;
                return i;
              })
              .sort(
                (d: any, c: any) => parseFloat(c.size) - parseFloat(d.size)
              );
            texts.push(sizes[0].url);
            texts.push(a.photo.text);
          } catch (e) {}
          break;
        case "doc":
          try {
            texts.push(a.doc.url);
          } catch (e) {}
          break;
      }
    }
  }
  texts.filter(Boolean).map((mini: string) => {
    sendFrom({
      messenger: "vkwall",
      edited: message.edited,
      channelId,
      author,
      text: mini
    });
  });
  sendFrom({
    messenger: "vkwall",
    edited: message.edited,
    channelId,
    author,
    text
  });
};

receivedFrom.vkboard = async (message: any) => {
  if (!config.channelMapping.vkboard) return;
  const channelId = message.topic_id;
  if (
    !config.channelMapping.vkboard[channelId] ||
    message.topic_owner_id === message.from_id
  )
    return;
  if (!generic.vkboard.client.app) {
    config.MessengersAvailable.vkboard = false;
    return;
  }
  let text = message.text;
  const fromwhomId = message.from_id;
  let [err, res] = await to(
    generic.vkboard.client.bot.api("users.get", {
      user_ids: fromwhomId,
      access_token: config.vkboard.token,
      fields: "nickname,screen_name"
    })
  );
  res = R.pathOr(fromwhomId, ["response", 0], res);
  const author = AdaptName.vkboard(res);

  let arrQuotes: string[] = [];
  text.replace(
    /\[[^\]]+:bp-([^\]]+)_([^\]]+)\|[^\]]*\]/g,
    (match: any, group_id: string, post_id: string) => {
      if (group_id === config.vkboard.group_id) {
        arrQuotes.push(post_id);
      }
    }
  );
  if (arrQuotes.length > 0) {
    const token = generic.vkboard.client.app.token;
    for (const el of arrQuotes) {
      const opts = {
        access_token: token,
        group_id: config.vkboard.group_id,
        topic_id: channelId,
        start_comment_id: el,
        count: 1,
        v: "5.84"
      };
      [err, res] = await to(
        generic.vkboard.client.bot.api("board.getComments", opts)
      );
      let text: string = R.path(["response", "items", 0, "text"], res);
      if (!text) continue;
      let replyuser: string;
      const rg = new RegExp(
        `^\\[club${config.vkboard.group_id}\\|(.*?)\\]: (.*)$`
      );
      if (rg.test(text)) {
        [, replyuser, text] = text.match(rg);
      } else {
        let authorId = R.path(["response", "items", 0, "from_id"], res);
        [err, res] = await to(
          generic.vkboard.client.bot.api("users.get", {
            user_ids: authorId,
            access_token: config.vkboard.token,
            fields: "nickname,screen_name"
          })
        );
        replyuser = R.pathOr("", ["response", 0], res);
        replyuser = AdaptName.vkboard(replyuser);
      }
      sendFrom({
        messenger: "vkboard",
        channelId,
        author: replyuser,
        text,
        quotation: true
      });
    }
  }
  const attachments = R.pathOr([], ["attachments"], message);
  let texts = [];
  if (attachments.length > 0) {
    for (let a of attachments) {
      switch (a.type) {
        case "photo":
        case "posted_photo":
          try {
            const sizes = a.photo.sizes
              .map((i: any) => {
                i.square = i.width * i.height;
                return i;
              })
              .sort(
                (d: any, c: any) => parseFloat(c.size) - parseFloat(d.size)
              );
            texts.push(sizes[0].url);
            texts.push(a.photo.text);
          } catch (e) {}
          break;
        case "doc":
          try {
            texts.push(a.doc.url);
          } catch (e) {}
          break;
      }
    }
  }
  texts.filter(Boolean).map((mini: string) => {
    sendFrom({
      messenger: "vkboard",
      edited: message.edited,
      channelId,
      author,
      text: mini
    });
  });
  sendFrom({
    messenger: "vkboard",
    edited: message.edited,
    channelId,
    author,
    text
  });
};

receivedFrom.slack = async (message: any) => {
  if (!config.channelMapping.slack) return;
  if (
    (message.subtype &&
      !["me_message", "channel_topic", "message_changed"].includes(
        message.subtype
      )) ||
    generic.slack.client.rtm.activeUserId === message.user
  )
    return;

  if (!message.user && message.message) {
    if (!message.message.user) return;
    message.user = message.message.user;
    message.text = message.message.text;
  }
  const edited = message.subtype === "message_changed" ? true : false;

  const promUser = generic.slack.client.web.users.info({
    user: message.user
  });
  const promChannel = generic.slack.client.web.channels.info({
    channel: message.channel
  });

  const promFiles = (message.files || []).map((file: any) =>
    generic.downloadFile({
      type: "slack",
      remote_path: file.url_private
    })
  );

  let err: any, user: any, chan: any, files: any[];
  [err, user] = await to(promUser);
  if (err) user = message.user;
  [err, chan] = await to(promChannel);
  if (err) chan = message.channel;
  [err, files] = await to(Promise.all(promFiles));
  if (err) files = [];
  const author = AdaptName.slack(user);
  const channelId = R.pathOr(message.channel, ["channel", "name"], chan);

  let action;
  if (message.subtype === "me_message") action = "action";
  if (
    message.subtype === "channel_topic" &&
    message.topic &&
    message.topic !== ""
  ) {
    action = "topic";
    message.text = generic.LocalizeString({
      messenger: "slack",
      channelId,
      localized_string_key: "topic",
      arrElemsToInterpolate: [["topic", message.topic]]
    });
  }
  if (files.length > 0)
    files.map(([file, localfile]: [string, string]) => {
      sendFrom({
        messenger: "slack",
        channelId,
        author,
        text: file,
        file: localfile,
        edited
      });
    });
  if (message.text && !message.topic) {
    sendFrom({
      messenger: "slack",
      channelId,
      author,
      text: message.text,
      action,
      edited
    });
  }
};

receivedFrom.mattermost = async (message: any) => {
  if (!config.channelMapping.mattermost) return;
  let channelId, msgText, author, file_ids, postParsed;
  if (R.path(["event"], message) === "post_edited") {
    const post = JSON.parse(R.pathOr("", ["data", "post"], message));
    if (!post.id) return;
    message.event = "posted";
    message.edited = true;
    await to(
      new Promise(resolve => {
        const url = `${config.mattermost.ProviderUrl}/api/v4/posts/${post.id}`;
        request(
          {
            method: "GET",
            url,
            headers: {
              Authorization: `Bearer ${config.mattermost.token}`
            }
          },
          (error: any, response: any, body: any) => {
            if (error) {
              console.error(error.toString());
            } else {
              msgText = JSON.parse(body).message;
              file_ids = JSON.parse(body).file_ids;
            }
            resolve();
          }
        );
      })
    );
    await to(
      new Promise(resolve => {
        const url = `${config.mattermost.ProviderUrl}/api/v4/users/${post.user_id}`;
        request(
          {
            method: "GET",
            url,
            headers: {
              Authorization: `Bearer ${config.mattermost.token}`
            }
          },
          (error: any, response: any, body: any) => {
            const json: Json = {};
            if (error) {
              console.error(error.toString());
            } else {
              author = JSON.parse(body).username;
            }
            resolve();
          }
        );
      })
    );
    await to(
      new Promise(resolve => {
        const url = `${
          config.mattermost.ProviderUrl
        }/api/v4/channels/${post.channel_id}`;
        request(
          {
            method: "GET",
            url,
            headers: {
              Authorization: `Bearer ${config.mattermost.token}`
            }
          },
          (error: any, response: any, body: any) => {
            const json: Json = {};
            if (error) {
              console.error(error.toString());
            } else {
              channelId = JSON.parse(body).display_name;
            }
            resolve();
          }
        );
      })
    );
  } else {
    message.edited = false;
    if (R.path(["data", "team_id"], message) !== config.mattermost.team_id)
      return;
    if (R.path(["event"], message) !== "posted") return;
    const post = R.path(["data", "post"], message);
    if (!post) return;
    postParsed = JSON.parse(post);
    channelId = R.path(["data", "channel_name"], message);
  }
  if (
    config.channelMapping.mattermost[channelId] &&
    !R.path(["props", "from_webhook"], postParsed) &&
    R.pathOr("", ["type"], postParsed) === ""
  ) {
    if (!file_ids) file_ids = R.pathOr([], ["file_ids"], postParsed);
    let files = [];
    for (const file of file_ids) {
      const [err, promfile] = await to(
        new Promise(resolve => {
          const url = `${
            config.mattermost.ProviderUrl
          }/api/v4/files/${file}/link`;
          request(
            {
              method: "GET",
              url,
              headers: {
                Authorization: `Bearer ${config.mattermost.token}`
              }
            },
            (error: any, response: any, body: any) => {
              const json: Json = {};
              if (error) {
                console.error(error.toString());
                resolve();
              } else {
                resolve(JSON.parse(body).link);
              }
            }
          );
        })
      );
      const [err2, promfile2] = await to(
        new Promise(resolve => {
          const url = `${
            config.mattermost.ProviderUrl
          }/api/v4/files/${file}/info`;
          request(
            {
              method: "GET",
              url,
              headers: {
                Authorization: `Bearer ${config.mattermost.token}`
              }
            },
            (error: any, response: any, body: any) => {
              const json: Json = {};
              if (error) {
                console.error(error.toString());
                resolve();
              } else {
                resolve(JSON.parse(body).extension);
              }
            }
          );
        })
      );
      if (promfile && promfile2) files.push([promfile2, promfile]);
    }
    if (!author) author = R.path(["data", "sender_name"], message);
    if (files.length > 0) {
      for (const [extension, file] of files) {
        const [file_, localfile]: [string, string] = await generic.downloadFile(
          {
            type: "simple",
            remote_path: file,
            extension
          }
        );
        sendFrom({
          messenger: "mattermost",
          channelId,
          author,
          text: file_,
          file: localfile,
          edited: message.edited
        });
      }
    }
    let action;
    //todo; handle mattermost actions
    sendFrom({
      messenger: "mattermost",
      channelId,
      author,
      text: msgText || R.path(["message"], postParsed),
      action,
      edited: message.edited
    });
  }
};

receivedFrom.irc = async ({
  author,
  channelId,
  text,
  handler,
  error,
  type
}: {
  author: string;
  channelId: string;
  text: string;
  handler: any;
  error: any;
  type: string;
}) => {
  if (!config.channelMapping.irc) return;
  if (type === "message") {
    if (text.search(new RegExp(config.spamremover.irc.source, "i")) >= 0)
      return;
    text = ircolors.stripColorsAndStyle(text);
    text = `<${ircolors
      .stripColorsAndStyle(author)
      .replace(/_+$/g, "")}>: ${text}`
      .replace(/^<[^ <>]+?>: <([^<>]+?)> ?: /, "*$1*: ")
      .replace(/^<[^ <>]+?>: &lt;([^<>]+?)&gt; ?: /, "*$1*: ")
      .replace(/^<([^<>]+?)>: /, "*$1*: ")
      .replace(/^\*([^<>]+?)\*: /, "<b>$1</b>: ");
    [, author, text] = text.match(/^<b>(.+?)<\/b>: (.*)/);
    if (text && text !== "") {
      sendFrom({
        messenger: "irc",
        channelId,
        author,
        text
      });
    }
  } else if (type === "action") {
    sendFrom({
      messenger: "irc",
      channelId,
      author,
      text,
      action: "action"
    });
  } else if (type === "topic") {
    const topic = generic.LocalizeString({
      messenger: "irc",
      channelId,
      localized_string_key: type,
      arrElemsToInterpolate: [[type, text]]
    });
    if (!config.channelMapping.irc[channelId]) return;

    if (
      !topic ||
      !config.irc.sendTopic ||
      // ignore first topic event when joining channel and unchanged topics
      // (should handle rejoins)
      !config.channelMapping.irc[channelId].previousTopic ||
      config.channelMapping.irc[channelId].previousTopic === text
    ) {
      config.channelMapping.irc[channelId].previousTopic = text;
      return;
    }
    sendFrom({
      messenger: "irc",
      channelId,
      author: author.split("!")[0],
      text: topic,
      action: "topic"
    });
  } else if (type === "error") {
    console.error`IRC ERROR:`;
    console.error(error);
    //todo: restart irc
  } else if (type === "registered") {
    config.irc.ircPerformCmds.forEach((cmd: string) => {
      handler.send.apply(null, cmd.split(" "));
    });
    config.irc.ircOptions.channels.forEach((channel: string) => {
      handler.join(channel);
    });
  }
};

// AdaptName
AdaptName.facebook = (user: any) => user.name; // || user.vanity || user.firstName;
AdaptName.telegram = (name: string) =>
  config.telegram.userMapping[name] || name;
AdaptName.vkboard = (user: any) => {
  let full_name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  if (full_name === "") full_name = undefined;
  if (user.nickname && user.nickname.length < 1) user.nickname = null;
  if (user.screen_name && user.screen_name.length < 1) user.screen_name = null;
  return user.screen_name || user.nickname || full_name || user.id;
};
AdaptName.vkwall = AdaptName.vkboard;
AdaptName.slack = (user: any) =>
  R.path(["user", "profile", "display_name"], user) ||
  R.path(["user", "real_name"], user) ||
  R.path(["user", "name"], user);

// GetName
GetName.telegram = (user: Telegram.User) => {
  let name = config.telegram.nameFormat;
  if (user.username) {
    name = name.replace("%username%", user.username, "g");
    name = AdaptName.telegram(name);
  } else {
    // if user lacks username, use fallback format string instead
    name = name.replace(
      "%username%",
      config.telegram.usernameFallbackFormat,
      "g"
    );
  }

  name = name.replace("%firstName%", user.first_name || "", "g");
  name = name.replace("%lastName%", user.last_name || "", "g");

  // get rid of leading and trailing whitespace
  name = name.replace(/(^\s*)|(\s*$)/g, "");
  return name;
};

convertFrom.facebook = async (text: string) => generic.escapeHTML(text);
convertFrom.telegram = async (text: string) =>
  marked.parser(lexer.lex(generic.escapeHTML(text)));
convertFrom.vkboard = async (text: string) =>
  generic.escapeHTML(text).replace(/\[[^\]]*\|(.*?)\](, ?)?/g, "");
convertFrom.vkwall = convertFrom.vkboard;
convertFrom.slack = async (text: string) => {
  const RE_ALPHANUMERIC = new RegExp("^\\w?$"),
    RE_TAG = new RegExp("<(.+?)>", "g"),
    RE_BOLD = new RegExp("\\*([^\\*]+?)\\*", "g"),
    RE_ITALIC = new RegExp("_([^_]+?)_", "g"),
    RE_FIXED = new RegExp("`([^`]+?)`", "g");

  const pipeSplit: any = (payload: any) => payload.split`|`;
  const payloads: any = (tag: any, start: number) => {
    if (!start) start = 0;
    const length = tag.length;
    return pipeSplit(tag.substr(start, length - start));
  };

  const tag = (tag: string, attributes: any, payload?: any) => {
    if (!payload) {
      payload = attributes;
      attributes = {};
    }

    let html = "<".concat(tag);
    for (const attribute in attributes) {
      if (attributes.hasOwnProperty(attribute))
        html = html.concat(" ", attribute, '="', attributes[attribute], '"');
    }
    return html.concat(">", payload, "</", tag, ">");
  };

  const matchTag = (match: RegExpExecArray | null) => {
    const action = match[1].substr(0, 1);
    let p;

    switch (action) {
      case "!":
        return tag("span", { class: "slack-cmd" }, payloads(match[1], 1)[0]);
      case "#":
        p = payloads(match[1], 2);
        return tag(
          "span",
          { class: "slack-channel" },
          p.length === 1 ? p[0] : p[1]
        );
      case "@":
        p = payloads(match[1], 2);
        return tag(
          "span",
          { class: "slack-user" },
          p.length === 1 ? p[0] : p[1]
        );
      default:
        p = payloads(match[1]);
        return tag("a", { href: p[0] }, p.length === 1 ? p[0] : p[1]);
    }
  };

  const safeMatch = (
    match: RegExpExecArray | null,
    tag: string,
    trigger?: string
  ) => {
    let prefix_ok = match.index === 0;
    let postfix_ok = match.index === match.input.length - match[0].length;

    if (!prefix_ok) {
      const charAtLeft: string = match.input.substr(match.index - 1, 1);
      prefix_ok =
        notAlphanumeric(charAtLeft) && notRepeatedChar(trigger, charAtLeft);
    }

    if (!postfix_ok) {
      const charAtRight: string = match.input.substr(
        match.index + match[0].length,
        1
      );
      postfix_ok =
        notAlphanumeric(charAtRight) && notRepeatedChar(trigger, charAtRight);
    }

    if (prefix_ok && postfix_ok) return tag;
    return false;
  };

  const matchBold = (match: RegExpExecArray | null) =>
    safeMatch(match, tag("strong", payloads(match[1])), "*");

  const matchItalic = (match: RegExpExecArray | null) =>
    safeMatch(match, tag("em", payloads(match[1])), "_");

  const matchFixed = (match: RegExpExecArray | null) =>
    safeMatch(match, tag("code", payloads(match[1])));

  const notAlphanumeric = (input: string) => !RE_ALPHANUMERIC.test(input);

  const notRepeatedChar = (trigger: string, input: string) =>
    !trigger || trigger !== input;

  async function parseSlackText(text: string) {
    const jsonChannels: Json = {};
    const jsonUsers: Json = {};
    text.replace(
      /<#(C\w+)\|?(\w+)?>/g,
      (match: any, channelId: any, readable: any) => {
        jsonChannels[channelId] = channelId;
        return channelId;
      }
    );
    text.replace(
      /<@(U\w+)\|?(\w+)?>/g,
      (match: any, userId: any, readable: any) => {
        jsonUsers[userId] = userId;
        return userId;
      }
    );
    for (const channelId of Object.keys(jsonChannels)) {
      const [err, { channel }] = await to(
        generic.slack.client.web.conversations.info({ channel: channelId })
      );
      if (!err) jsonChannels[channelId] = channel.name;
    }
    for (const userId of Object.keys(jsonUsers)) {
      const [err, { user }] = await to(
        generic.slack.client.web.users.info({ user: userId })
      );
      jsonUsers[userId] = AdaptName.slack(user);
    }
    return (
      emoji
        .emojify(text)
        .replace(":simple_smile:", ":)")
        .replace(/<!channel>/g, "@channel")
        .replace(/<!group>/g, "@group")
        .replace(/<!everyone>/g, "@everyone")
        .replace(
          /<#(C\w+)\|?(\w+)?>/g,
          (match: any, channelId: any, readable: any) => {
            return `#${readable || jsonChannels[channelId]}`;
          }
        )
        .replace(
          /<@(U\w+)\|?(\w+)?>/g,
          (match: any, userId: any, readable: any) => {
            return `@${readable || jsonUsers[userId]}`;
          }
        )
        .replace(/<(?!!)([^|]+?)>/g, (match: any, link: any) => link)
        .replace(
          /<!(\w+)\|?(\w+)?>/g,
          (match: any, command: any, label: any) => `<${label || command}>`
        )
        // .replace(/:(\w+):/g, (match: any, emoji: any) => {
        //   if (emoji in emojis) return emojis[emoji];
        //   return match;
        // })
        .replace(/<.+?\|(.+?)>/g, (match: any, readable: any) => readable)
    );
  }

  const publicParse = async (text: string) => {
    const patterns = [
      { p: RE_TAG, cb: matchTag },
      { p: RE_BOLD, cb: matchBold },
      { p: RE_ITALIC, cb: matchItalic },
      { p: RE_FIXED, cb: matchFixed }
    ];
    text = await parseSlackText(text);
    for (const pattern of patterns) {
      const original = text;
      let result: RegExpExecArray | null;

      while ((result = pattern.p.exec(original)) !== null) {
        const replace = pattern.cb(result);
        if (replace) text = text.replace(result[0], replace);
      }
    }

    return text;
  };
  text = generic.escapeHTML(text);
  const [err, str] = await to(publicParse(text));
  return str || text;
};
convertFrom.mattermost = async (text: string) =>
  marked.parser(lexer.lex(generic.escapeHTML(text)));
convertFrom.discord = async (text: string) =>
  marked.parser(lexer.lex(generic.escapeHTML(text)));
convertFrom.irc = async (text: string) =>
  generic
    .escapeHTML(text)
    .replace(/\b\*(\w+)\*\b/g, "<b>$1</b>")
    .replace(/\b_(\w+)_\b/g, "<i>$1</i>");

async function convertToPlainText(text: string) {
  let a = await generic.unescapeHTML(
    text
      .replace(/<b>(\w)<\/b>/g, "*$1*")
      .replace(/<i>(\w)<\/i>/g, "_$1_")
      .replace(/<br\/?>/gi, "\n")
      .replace(/<a.*?href="(.+?)".*?>(.+?)<\/a>/gi, (...arr) => {
        const url = arr[1];
        const name = arr[2];
        if (url !== name) return `${name} (${url})`;
        return " " + url;
      })
      .replace(/<(?:.|\s)*?>/g, "")
      .trim(),
    true
  );
  if (a.split(/\r\n|\r|\n/).length > 1) {
    a = "\n" + a;
  }
  return a;
}

convertTo["facebook"] = async (text: string) => convertToPlainText(text);
convertTo["telegram"] = async (text: string) => generic.sanitizeHtml(text);
convertTo["vkboard"] = async (text: string) => await convertToPlainText(text);
convertTo["vkwall"] = convertTo["vkboard"];
convertTo["slack"] = async (text: string) => slackify(text);
convertTo["mattermost"] = async (text: string) =>
  html2md.convert({ string: text }); // .replace(/\*/g, "&#42;").replace(/\_/g, "&#95;")
convertTo["discord"] = async (text: string) =>
  await generic.unescapeHTML(
    html2md.convert({ string: text, hrefConvert: false }),
    true
  );
// convertTo["discord"] = async (text: string) => await convertToPlainText(text);
convertTo["irc"] = async (text: string) => await convertToPlainText(text);

// generic.telegram
generic.telegram.serveFile = (fileId: number) =>
  generic.downloadFile({
    type: "telegram",
    fileId
  });

generic.writeCache = async ({
  channelName,
  channelId,
  action
}: {
  channelName: string | number;
  channelId: string | number;
  action: string;
}) => {
  await new Promise(resolve => {
    fs.writeFile(
      `${process.env.HOME}/.${package_json.name}/cache.json`,
      JSON.stringify(config.cache),
      (err: any) => {
        if (err) action = "error " + err.toString();
        console.log(
          `
          action: ${action}\n
          channel Name: ${channelName}\n
          channel Id: ${channelId}
          `
        );
        resolve();
      }
    );
  });
};

async function TelegramRemoveSpam(message: Telegram.Message) {
  const cloned_message = JSON.parse(JSON.stringify(message));
  if (IsSpam(cloned_message)) {
    if (message.text && message.text.search(/\bt\.me\b/) >= 0) {
      const [err, chat] = await to(
        generic.telegram.client.getChat(message.chat.id)
      );
      if (!err) {
        const invite_link = chat.invite_link;
        cloned_message.text = cloned_message.text.replace(invite_link, "");
        if (IsSpam(cloned_message))
          generic.telegram.DeleteMessage({ message, log: true });
      } else {
        generic.LogToAdmin(
          `error ${err} on getting an invite link of the chat ${
            message.chat.id
          } ${message.chat.title}`
        );
      }
    } else {
      const [err, chat] = await to(
        generic.telegram.client.getChat(cloned_message.chat.id)
      );
      if (!err) {
        generic.telegram.DeleteMessage({ message, log: true });
      } else {
        generic.LogToAdmin(
          `error ${err} on getting an invite link of the chat ${
            cloned_message.chat.id
          } ${cloned_message.chat.title}`
        );
      }
    }
    return true;
  }
  return;

  // dealing with non-lojban spam
  // if (message.chat.title === 'jbosnu' && message.text) {
  //   const arrText = message.text.split(" ");
  //   const xovahe = arrText.filter(i => lojban.ilmentufa_off("lo'u " + i + " le'u").tcini === "snada").length / arrText.length;
  //   if (xovahe < 0.5) {
  //     telegram.sendMessage(
  //       channel.id,
  //       ".i mi smadi le du'u do na tavla fo su'o lojbo .i ja'e bo mi na benji di'u fi la IRC\n\nIn this group only Lojban is allowed. Try posting your question to [#lojban](https://t.me/joinchat/BLVsYz3hCF8mCAb6fzW1Rw) or [#ckule](https://telegram.me/joinchat/BLVsYz4hC9ulWahupDLovA) (school) group", {
  //         reply_to_message_id: message.message_id,
  //         parse_mode: "Markdown"
  //       }
  //     ).catch((e) => console.log(e.toString()));
  //     return;
  //   }
  // }
}

function TelegramRemoveAddedBots(message: Telegram.Message) {
  if (config.telegram.remove_added_bots)
    R.pathOr([], ["new_chat_members"], message).map((u: Telegram.User) => {
      if (u.is_bot && R.path(["telegram", "myUser", "id"], config) !== u.id)
        generic.telegram.client
          .kickChatMember(message.chat.id, u.id)
          .catch(catchError);
    });
}

function TelegramRemoveNewMemberMessage(message: Telegram.Message) {
  if (
    message.left_chat_member ||
    R.pathOr([], ["new_chat_members"], message).filter(
      (u: Telegram.User) =>
        (u.username || "").length > 100 ||
        (u.first_name || "").length > 100 ||
        (u.last_name || "").length > 100
    ).length > 0
  ) {
    generic.telegram.DeleteMessage({ message, log: false });
  }
  if (message.left_chat_member || message.new_chat_members) return true;
  return false;
}

async function TelegramLeaveChatIfNotAdmin(message: Telegram.Message) {
  if (
    !R.path(["chat", "id"], message) ||
    !R.path(["telegram", "myUser", "id"], config)
  )
    return;

  let [err, res] = await to(
    generic.telegram.client.getChatMember(
      message.chat.id,
      config.telegram.myUser.id
    )
  );
  if (!res) return true;
  if (!res.can_delete_messages) {
    [err, res] = await to(generic.telegram.client.leaveChat(message.chat.id));
    generic.LogToAdmin(`leaving chat ${message.chat.id} ${message.chat.title}`);
    config.cache.telegram[message.chat.title] = undefined;
    await to(
      generic.writeCache({
        channelName: message.chat.title,
        channelId: message.chat.id,
        action: "leave"
      })
    );
    return true;
  }
  return false;
}

generic.telegram.DeleteMessage = async ({
  message,
  log
}: {
  message: Telegram.Message;
  log: boolean;
}) => {
  if (log) await to(generic.LogMessageToAdmin(message));
  await to(
    generic.telegram.client.deleteMessage(message.chat.id, message.message_id)
  );
};

// generic
generic.ConfigBeforeStart = () => {
  if (process.argv[2] === "--genconfig") {
    mkdirp(`${process.env.HOME}/.${package_json.name}`);

    // read default config using readFile to include comments
    const config = fs.readFileSync(`${__dirname}/../config/defaults.js`);
    const configPath = `${process.env.HOME}/.${package_json.name}/config.js`;
    fs.writeFileSync(configPath, config);
    throw new Error(
      `Wrote default configuration to ${configPath}, please edit it before re-running`
    );
  }

  let config;

  try {
    config = require(`${process.env.HOME}/.${package_json.name}/config.js`);
  } catch (e) {
    throw new Error(
      `ERROR while reading config:\n${e}\n\nPlease make sure ` +
        'it exists and is valid. Run "node bridge --genconfig" to ' +
        "generate a default config."
    );
  }

  const defaultConfig = require("../config/defaults");
  config = R.mergeDeepLeft(config, defaultConfig);

  // irc
  const channels = config.channels;
  const result = [];
  for (let i = 0; i < channels.length; i++) {
    if (channels[i].irc) {
      const chanName = channels[i]["irc-password"]
        ? `${channels[i].irc} ${channels[i]["irc-password"]}`
        : channels[i].irc;
      result.push(chanName);
    }
  }
  config.irc.ircOptions.channels = result;
  config.irc.ircOptions.encoding = "utf-8";
  const localConfig = require("../local/dict.json");

  return [config, localConfig];
};

NewChannelAppeared.telegram = async ({
  channelName,
  channelId
}: {
  channelName: string;
  channelId: string;
}) => {
  config.cache.telegram[channelName] = channelId;
  let [err, res] = await to(
    generic.writeCache({ channelName, channelId, action: "join" })
  );
  if (err) {
    console.error(err);
    return;
  }
  [err, res] = await to(generic.PopulateChannelMapping());
  if (err)
    generic.LogToAdmin(
      `got problem in the new telegram chat ${channelName}, ${channelId}`
    );
  if (err) {
    console.error(err);
    return;
  }
  return true;
};

GetChannels.telegram = async () => {
  if (!config.MessengersAvailable.telegram) return [];
  //read from file
  let [err, res] = await to(
    new Promise(resolve => {
      resolve(
        JSON.parse(
          fs.readFileSync(
            `${process.env.HOME}/.${package_json.name}/cache.json`
          )
        ).telegram
      );
    })
  );
  if (err || !res) res = {};
  config.cache.telegram = res;
  return res;
};

GetChannels.slack = async () => {
  if (!config.MessengersAvailable.slack) return {};
  let [err, res] = await to(generic.slack.client.web.channels.list());
  if (err) {
    console.error(err);
  }
  res = R.pathOr([], ["channels"], res);
  const json: Json = {};
  res.map((i: any) => {
    json[i.name] = i.name;
  });
  config.cache.slack = json;
  return res;
};

GetChannels.mattermost = async () => {
  if (!config.MessengersAvailable.slack) return {};
  let json: Json = {};
  let url: string = `${config.mattermost.ProviderUrl}/api/v4/teams/${
    config.mattermost.team_id
  }/channels`;
  json = await GetChannelsMattermostCore(json, url);
  url = `${config.mattermost.ProviderUrl}/api/v4/users/${
    config.mattermost.user_id
  }/teams/${config.mattermost.team_id}/channels`;
  json = await GetChannelsMattermostCore(json, url);
  config.cache.mattermost = json;
  return json;
};

GetChannels.discord = async () => {
  if (!config.MessengersAvailable.discord) return;
  const json: Json = {};
  for (const value of generic.discord.client.channels.values()) {
    if (value.guild.id === config.discord.guildId) {
      json[value.name] = value.id;
    }
  }
  config.cache.discord = json;
  return;
};

async function GetChannelsMattermostCore(json: Json, url: string) {
  await to(
    new Promise(resolve => {
      request(
        {
          method: "GET",
          url,
          headers: {
            Authorization: `Bearer ${config.mattermost.token}`
          }
        },
        (error: any, response: any, body: any) => {
          if (error) {
            console.error(error.toString());
          } else {
            body = JSON.parse(body);
            if (body[0]) {
              body.map((i: any) => {
                json[i.display_name] = i.name;
              });
            }
          }
          resolve();
        }
      );
    })
  );
  return json;
}

async function PopulateChannelMappingCore({
  messenger
}: {
  messenger: string;
}) {
  if (!config.MessengersAvailable[messenger]) return;
  if (!config.channelMapping[messenger]) config.channelMapping[messenger] = {};
  const arrMappingKeys: string[] = [
    "facebook",
    "telegram",
    "vkboard",
    "vkwall",
    "slack",
    "mattermost",
    "discord",
    "irc"
  ];
  config.channels.map((i: any) => {
    let i_mapped = i[messenger];
    if (config.cache[messenger])
      i_mapped = R.path(["cache", messenger, i[messenger]], config);
    if (!i_mapped) return;
    const mapping: any = {
      settings: {
        readonly: i[`${messenger}-readonly`],
        language: i["language"],
        nickcolor: i[`${messenger}-nickcolor`],
        name: i[messenger]
      }
    };
    for (const key of arrMappingKeys)
      mapping[key] = R.pathOr(i[key], ["cache", key, i[key]], config);

    config.channelMapping[messenger][i_mapped] = R.mergeDeepLeft(
      mapping,
      config.channelMapping[messenger][i_mapped] || {}
    );
  });
}

generic.PopulateChannelMapping = async () => {
  if (!config.channelMapping) config.channelMapping = {};
  if (!config.cache) config.cache = {};

  await GetChannels.telegram();
  await GetChannels.slack();
  await GetChannels.mattermost();
  await GetChannels.discord();

  await PopulateChannelMappingCore({ messenger: "facebook" });
  await PopulateChannelMappingCore({ messenger: "telegram" });
  await PopulateChannelMappingCore({ messenger: "vkboard" });
  await PopulateChannelMappingCore({ messenger: "vkwall" });
  await PopulateChannelMappingCore({ messenger: "slack" });
  await PopulateChannelMappingCore({ messenger: "mattermost" });
  await PopulateChannelMappingCore({ messenger: "discord" });

  await PopulateChannelMappingCore({ messenger: "irc" });
  // console.log(
  //   "started services with these channel mapping:\n",
  //   JSON.stringify(config.channelMapping, null, 2)
  // );
};

generic.MessengersAvailable = () => {
  config.MessengersAvailable = {};
  config.channels.map((i: any) => {
    if (i.facebook) config.MessengersAvailable.facebook = true;
    if (i.telegram) config.MessengersAvailable.telegram = true;
    if (i.vkboard) config.MessengersAvailable.vkboard = true;
    if (i.vkwall) config.MessengersAvailable.vkwall = true;
    if (i.slack) config.MessengersAvailable.slack = true;
    if (i.mattermost) config.MessengersAvailable.mattermost = true;
    if (i.discord) config.MessengersAvailable.discord = true;

    if (i.irc) config.MessengersAvailable.irc = true;
  });
  if (
    R.pathOr("", ["facebook", "email"], config) === "" ||
    R.pathOr("", ["facebook", "password"], config) === ""
  )
    config.MessengersAvailable.facebook = false;
  if (
    R.pathOr("", ["discord", "client"], config) === "" ||
    R.pathOr("", ["discord", "token"], config) === "" ||
    R.pathOr("", ["discord", "guildId"], config) === ""
  )
    config.MessengersAvailable.discord = false;
  if (R.pathOr("", ["telegram", "token"], config) === "")
    config.MessengersAvailable.telegram = false;
  if (
    R.pathOr("", ["vkboard", "token"], config) === "" ||
    R.pathOr("", ["vkboard", "group_id"], config) === "" ||
    R.pathOr("", ["vkboard", "login"], config) === "" ||
    R.pathOr("", ["vkboard", "password"], config) === ""
  )
    config.MessengersAvailable.vkboard = false;
  if (
    R.pathOr("", ["vkwall", "token"], config) === "" ||
    R.pathOr("", ["vkwall", "group_id"], config) === "" ||
    R.pathOr("", ["vkwall", "login"], config) === "" ||
    R.pathOr("", ["vkwall", "password"], config) === ""
  )
    config.MessengersAvailable.vkwall = false;
};

StartService.facebook = async (force: boolean) => {
  //facebook
  if (!force && !config.MessengersAvailable.facebook) return;
  queueOf.facebook = new Queue({
    autoStart: true,
    concurrency: 1
  });
  try {
    generic.facebook.client = await login(
      config.facebook.email,
      config.facebook.password
    );
    console.log(generic.facebook.client);
    console.log(JSON.stringify(generic.facebook.client.getSession()));

    generic.facebook.client.on("message", (message: any) => {
      receivedFrom.facebook(message);
    });
    config.MessengersAvailable.facebook = true;
  } catch (e) {
    console.log(e.toString());
    // config.MessengersAvailable.facebook = false;
    // StartService.facebook(true);
  }
};

StartService.telegram = async () => {
  //telegram
  if (!config.MessengersAvailable.telegram) return;
  generic.telegram.client = generic.telegram.Start();
  queueOf.telegram = new Queue({
    autoStart: true,
    concurrency: 1
  });
  generic.telegram.client.on("message", (message: any) => {
    receivedFrom.telegram(message);
  });
  generic.telegram.client.on("edited_message", (message: any) => {
    receivedFrom.telegram(message);
  });
  generic.telegram.client.on("polling_error", (error: any) => {
    if (error.code === "ETELEGRAM" && error.response.body.error_code === 404) {
      config.MessengersAvailable.telegram = false;
      generic.telegram.client.stopPolling();
    }
  });
  const [err, res] = await to(generic.telegram.client.getMe());
  if (!err) config.telegram.myUser = res;
};

StartService.vkwall = async () => {
  //vkboard
  if (!config.MessengersAvailable.vkwall) return;
  generic.vkwall.client = await generic.vkwall.Start();
  if (!queueOf.vk)
    queueOf.vk = new Queue({
      autoStart: true,
      concurrency: 1
    });
  generic.vkwall.client.bot.event("wall_reply_new", async (ctx: any) => {
    receivedFrom.vkwall(ctx.message);
  });
  generic.vkwall.client.bot.event("wall_reply_edit", async (ctx: any) => {
    ctx.message.edited = true;
    receivedFrom.vkwall(ctx.message);
  });
  generic.vkwall.client.bot.startPolling();
};

StartService.vkboard = async () => {
  //vkboard
  if (!config.MessengersAvailable.vkboard) return;
  generic.vkboard.client = await generic.vkboard.Start();
  if (!queueOf.vk)
    queueOf.vk = new Queue({
      autoStart: true,
      concurrency: 1
    });
  generic.vkboard.client.bot.event("board_post_new", async (ctx: any) => {
    receivedFrom.vkboard(ctx.message);
  });
  generic.vkboard.client.bot.event("board_post_edit", async (ctx: any) => {
    ctx.message.edited = true;
    receivedFrom.vkboard(ctx.message);
  });
  generic.vkboard.client.bot.startPolling();
};

StartService.slack = async () => {
  //slack
  await generic.slack.Start();
  if (!config.MessengersAvailable.slack) return;
  queueOf.slack = new Queue({
    autoStart: true,
    concurrency: 1
  });
  generic.slack.client.rtm.on("message", (message: any) => {
    receivedFrom.slack(message);
  });
};

StartService.mattermost = async () => {
  //mattermost
  generic.mattermost.client = await generic.mattermost.Start();
  if (!config.MessengersAvailable.mattermost) return;
  queueOf.mattermost = new Queue({
    autoStart: true,
    concurrency: 1
  });
  generic.mattermost.client.addEventListener("open", () => {
    generic.mattermost.client.send(
      JSON.stringify({
        seq: 1,
        action: "authentication_challenge",
        data: {
          token: config.mattermost.token
        }
      })
    );
  });
  generic.mattermost.client.addEventListener("message", (message: any) => {
    if (!R.path(["data"], message) || !config.mattermost.team_id) return;
    message = JSON.parse(message.data);
    receivedFrom.mattermost(message);
  });
  generic.mattermost.client.addEventListener("close", () =>
    generic.mattermost.client._connect()
  );
  generic.mattermost.client.addEventListener("error", () =>
    generic.mattermost.client._connect()
  );
};

StartService.discord = async () => {
  //discord
  await generic.discord.Start();
  if (!config.MessengersAvailable.discord) return;

  queueOf.discord = new Queue({
    autoStart: true,
    concurrency: 1
  });
  await new Promise(resolve => {
    if (config.MessengersAvailable.discord) {
      queueOf.discord = new Queue({
        autoStart: true,
        concurrency: 1
      });
      generic.discord.client.on("ready", () => {
        resolve();
      });
      generic.discord.client.on("error", (error: any) => {
        debug("discord")(error);
        resolve();
        // StartService.discord();
      });
      generic.discord.client.login(config.discord.token);
    } else {
      resolve();
    }
  });
  generic.discord.client.on("message", (message: any) => {
    receivedFrom.discord(message);
  });
  generic.discord.client.on(
    "messageUpdate",
    (oldMessage: any, message: any) => {
      message.edited = true;
      receivedFrom.discord(message);
    }
  );
};

StartService.irc = async () => {
  //irc
  generic.irc.client = new Irc.Client(
    config.irc.ircServer,
    config.irc.ircOptions.nick,
    config.irc.ircOptions
  );
  if (!config.MessengersAvailable.irc) return;
  queueOf.irc = new Queue({
    autoStart: true,
    concurrency: 1
  });
  generic.irc.client.on("error", (error: any) => {
    receivedFrom.irc({
      error,
      type: "error"
    });
    // StartService.irc();
  });

  generic.irc.client.on("registered", () => {
    receivedFrom.irc({
      handler: generic.irc.client,
      type: "registered"
    });
  });

  generic.irc.client.on(
    "message",
    (author: string, channelId: string, text: string) => {
      receivedFrom.irc({
        author,
        channelId,
        text,
        type: "message"
      });
    }
  );

  generic.irc.client.on(
    "topic",
    (channelId: string, topic: string, author: string) => {
      receivedFrom.irc({
        author,
        channelId,
        text: topic,
        type: "topic"
      });
    }
  );

  generic.irc.client.on(
    "action",
    (author: string, channelId: string, text: string) => {
      receivedFrom.irc({
        author,
        channelId,
        text,
        type: "action"
      });
    }
  );
};

async function StartServices() {
  generic.MessengersAvailable();
  if (!config.channelMapping) config.channelMapping = {};

  await StartService.facebook();
  await StartService.telegram();
  await StartService.vkboard();
  await StartService.vkwall();
  await StartService.slack();
  await StartService.mattermost();
  await StartService.discord();
  await StartService.irc();

  await generic.PopulateChannelMapping();
}

// helper functions
generic.sendOnlineUsersTo = ({
  network,
  channel
}: {
  network: string;
  channel: string;
}) => {
  // todo: get list of online users of each messenger
  // dont show the result in other networks
  if (network === "telegram") {
    const objChannel: any =
      generic.irc.client.chans[
        R.path(["channelMapping", "telegram", channel, "irc"], config)
      ];

    if (!objChannel) return;

    let names: string[] = Object.keys(objChannel.users);

    names.forEach((name, i) => {
      names[i] = (objChannel.users[name] || "") + names[i];
    });
    names.sort();
    const strNames = `Users on ${objChannel.ircChan}:\n\n${names.join(", ")}`;

    generic.telegram.client
      .sendMessage(objChannel.id, strNames)
      .catch((e: any) => console.log(e.toString()));
  }
};

generic.LogMessageToAdmin = async (message: Telegram.Message) => {
  if (config.telegram.admins_userid)
    await to(
      generic.telegram.client.forwardMessage(
        config.telegram.admins_userid,
        message.chat.id,
        message.message_id
      )
    );
};

generic.LogToAdmin = (msg_text: string) => {
  if (config.telegram.admins_userid)
    generic.telegram.client
      .sendMessage(config.telegram.admins_userid, msg_text, {
        parse_mode: "HTML"
      })
      .catch((e: any) => console.log(e.toString()));
};

generic.escapeHTML = (arg: string) =>
  arg
    .replace(/&(?![a-zA-Z0-9#]{1,7};)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/'/g, "&#039;");

const htmlEntities: any = {
  nbsp: " ",
  cent: "¢",
  pound: "£",
  yen: "¥",
  euro: "€",
  copy: "©",
  reg: "®",
  lt: "<",
  gt: ">",
  quot: '"',
  amp: "&",
  apos: "'"
};
generic.unescapeHTML = (str: string, convertHtmlEntities: boolean) => {
  return str.replace(/\&([^;]+);/g, (entity: string, entityCode: string) => {
    let match: any;

    if (convertHtmlEntities && htmlEntities[entityCode]) {
      return htmlEntities[entityCode];
    } else if ((match = entityCode.match(/^#x([\da-fA-F]+)$/))) {
      return String.fromCharCode(parseInt(match[1], 16));
    } else if ((match = entityCode.match(/^#(\d+)$/))) {
      return String.fromCharCode(~~match[1]);
    } else {
      return entity;
    }
  });
};

function splitSlice(str: string, len: number) {
  const arrStr: string[] = [...str];
  let ret: string[] = [];
  for (let offset = 0, strLen = arrStr.length; offset < strLen; offset += len)
    ret.push(arrStr.slice(offset, len + offset).join(""));
  return ret;
}

// async function appendPageTitles(
//   text: string,
//   sendto?: boolean,
//   messenger?: string
// ) {
//   if (config[messenger].sendPageTitles) {
//     const urls = text.match(UrlRegExp);
//     if (urls.length > 0) {
//       for (const url of urls) {
//         await to(
//           new Promise((resolve) => {
//             request(
//               {
//                 url,
//                 timeout: 3000
//               },
//               (err, res, body) => {
//                 if (!err) {
//                   const match = PageTitleRegExp.exec(body);
//                   if (match && match[2]) {
//                     text += `\n${match[2]}`;
//                   }
//                 }
//               }
//             );
//           })
//         );
//       }
//     }
//   }
//   if (sendto) {
//     sendTo[m]({
//       channelId: ConfigNode[m],
//       author,
//       chunk: thisToWhom + chunk,
//       quotation,
//       action,
//       file
//     });
//   }
//   return text;
// }

GetChunks.irc = async (text: string, messenger: string) => {
  text = text.replace(/\n/g, "\r");
  return await GetChunks.fallback(text, messenger);
};

GetChunks.fallback = async (text: string, messenger: string) => {
  // text = await appendPageTitles(text);
  const limit = config[messenger].MessageLength || 400;
  const r = new RegExp(`(.{${limit - 40},${limit}})(?= )`, "g");
  const arrText: string[] = text
    .replace(r, "$1\r")
    .split(/\r/)
    .reduce((acc: string[], i: string) => {
      if (Buffer.byteLength(i, "utf8") > limit) {
        const arrI: string[] = i.split(/(?=<a href="https?:\/\/)/gu);
        acc = acc.concat(arrI);
      } else acc.push(i);
      return acc;
    }, [])
    .reduce((acc: string[], i: string) => {
      if (Buffer.byteLength(i, "utf8") > limit) {
        const arrI: string[] = splitSlice(i, limit);
        acc = acc.concat(arrI);
      } else acc.push(i);
      return acc;
    }, [])
    .filter((i: string) => i !== "");
  return arrText;
};

generic.downloadFile = async ({
  type,
  fileId,
  remote_path,
  extension
}: {
  type: string;
  fileId?: number;
  remote_path?: string;
  extension?: string;
}) => {
  const randomString = blalalavla.cupra(remote_path || fileId.toString());
  const randomStringName = blalalavla.cupra(
    (remote_path || fileId.toString()) + "1"
  );
  mkdirp(`${process.env.HOME}/.${package_json.name}/files/${randomString}`);
  const rem_path = `${config.generic.httpLocation}/${randomString}`;
  const local_path = `${process.env.HOME}/.${
    package_json.name
  }/files/${randomString}`;

  let err: any, res: any;
  let rem_fullname: string = "";
  let local_fullname: string = "";
  if (type === "slack") {
    [err, res] = await to(
      new Promise(resolve => {
        const local_fullname = `${local_path}/${path.basename(remote_path)}`;
        const stream = request(
          {
            method: "GET",
            url: remote_path,
            headers: {
              Authorization: `Bearer ${config.slack.token}`
            }
          },
          err => {
            if (err) {
              console.log(remote_path, err.toString());
              resolve();
            }
          }
        ).pipe(fs.createWriteStream(local_fullname));

        stream.on("finish", () => {
          const rem_fullname = `${rem_path}/${path.basename(remote_path)}`;
          resolve([rem_fullname, local_fullname]);
        });
        stream.on("error", (e: any) => {
          console.error(remote_path, e);
          resolve();
        });
      })
    );
    if (res) [rem_fullname, local_fullname] = res;
  } else if (type === "simple") {
    [err, res] = await to(
      new Promise(resolve => {
        if (extension) {
          extension = `.${extension}`;
        } else {
          extension = "";
        }
        const basename =
          path.basename(remote_path).split(/[\?#]/)[0] + extension;
        const local_fullname = `${local_path}/${basename}`;
        const stream = request(
          {
            method: "GET",
            url: remote_path
          },
          (err: any) => {
            if (err) {
              console.log(err.toString(), remote_path);
              resolve([rem_fullname, local_fullname]);
            }
          }
        ).pipe(fs.createWriteStream(local_fullname));

        stream.on("finish", () => {
          const rem_fullname = `${rem_path}/${basename}`;
          resolve([rem_fullname, local_fullname]);
        });
        stream.on("error", (err: any) => {
          console.log(remote_path, err.toString());
          resolve([rem_fullname, local_fullname]);
        });
      })
    );
    if (res) [rem_fullname, local_fullname] = res;
  } else if (type === "telegram") {
    [err, local_fullname] = await to(
      generic.telegram.client.downloadFile(fileId, local_path)
    );
    if (!err) rem_fullname = `${rem_path}/${path.basename(local_fullname)}`;
  }
  if (err) {
    console.error(remote_path, err);
    return [remote_path || fileId, remote_path || fileId];
  }
  [err, res] = await to(
    new Promise(resolve => {
      const newname = `${local_path}/${randomStringName}${path.extname(
        local_fullname
      )}`;
      fs.rename(local_fullname, newname, (err: any) => {
        if (err) {
          console.error(remote_path, err);
          resolve();
        } else {
          rem_fullname = `${rem_path}/${path.basename(newname)}`;
          resolve([rem_fullname, newname]);
        }
      });
    })
  );
  if (res) [rem_fullname, local_fullname] = res;
  if (![".webp", ".tiff"].includes(path.extname(local_fullname))) {
    return [rem_fullname, local_fullname];
  }
  const sharp = require("sharp");
  const jpgname = `${local_fullname
    .split(".")
    .slice(0, -1)
    .join(".")}.jpg`;
  [err, res] = await to(
    new Promise(resolve => {
      sharp(local_fullname).toFile(jpgname, (err: any, info: any) => {
        if (err) {
          console.error(remote_path, err.toString());
          resolve([rem_fullname, local_fullname]);
        } else {
          fs.unlink(local_fullname);
          resolve([
            `${rem_fullname
              .split(".")
              .slice(0, -1)
              .join(".")}.jpg`,
            jpgname
          ]);
        }
      });
    })
  );
  if (res) [rem_fullname, local_fullname] = res;
  return [rem_fullname, local_fullname];
};

generic.sanitizeHtml = (text: string) => {
  return sanitizeHtml(text, {
    allowedTags: ["b", "strong", "i", "code", "pre", "a", "em"],
    allowedAttributes: {
      a: ["href"]
    }
  });
};

generic.LocalizeString = ({
  messenger,
  channelId,
  localized_string_key,
  arrElemsToInterpolate
}: {
  messenger: string;
  channelId: string | number;
  localized_string_key: string;
  arrElemsToInterpolate: Array<Array<string>>;
}) => {
  try {
    const language = R.pathOr(
      "English",
      ["channelMapping", messenger, channelId, "settings", "language"],
      config
    );
    let template = localConfig[language][localized_string_key];
    const def_template = localConfig["English"][localized_string_key];
    if (!def_template) {
      console.log(`no ${localized_string_key} key specified in the dictionary`);
      return;
    }
    if (!template) template = def_template;
    for (const value of arrElemsToInterpolate)
      template = template.replace(new RegExp(`%${value[0]}%`, "gu"), value[1]);
    return template;
  } catch (err) {
    console.error(err);
  }
};

function catchError(err: any) {
  console.log(err);
}

//START
// get/set config
const [config, localConfig] = generic.ConfigBeforeStart();

// map channels & start listening
StartServices();

// start HTTP server for media files if configured to do so
if (config.generic.showMedia) {
  mkdirp(`${process.env.HOME}/.${package_json.name}/files`);
  const serve = serveStatic(`${process.env.HOME}/.${package_json.name}/files`, {
    lastModified: false,
    index: false,
    maxAge: 86400000
  });
  const server = http.createServer((req: any, res: any) => {
    serve(req, res, finalhandler(req, res));
  });
  server.listen(config.generic.httpPort);
}
