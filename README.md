# ArcdpsReminder

A simple bot that remind you to update arcdps.

Put a config.json in the project root folder:
```jsonc
{
  "CheckUpdateInterval": 3600000, //ms
  "DefaultNotifyMessage": "Arcdps just updated!!",
  "BotStatus": "@mention help",
  "DebugLevel": "DEBUG",
  "Token": "<BOT TOKEN>",
  "Admins": [
    "<USER ID>"
  ]
}
```

General commands:
1. Add this channel to notify list: `@mention add`
2. Delete this channel from notify list: `@mention del`
3. Edit notify message: `@mention edit <message>`
4. Display help message: `@mention help`
5. Test message: `@mention test`
6. Show last check status: `@mention lastcheck`

Admin command:
1. Test notify for all channel: `@mention testall`
2. Set debug level: `@mention setdebuglevel <DEBUG | VERBOSE | INFO | ERROR>`
3. Set check interval: `@mention setinterval <interval in ms>`
4. Set bot status: `@mention setstatus <status>`
5. Perform update check immediately: `@mention checknow`
6. Save config to file: `@mention saveconfig`
7. Dump config: `@mention printconfig`
8. Display admin help message: `@mention helpadmin`