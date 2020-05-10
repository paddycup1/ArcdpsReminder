# ArcdpsReminder

A simple bot that remind you to update arcdps.

Put a config.json in the project root folder:
```jsonc
{
  "CheckUpdateInterval": "1h", //format: 1w2d3h4m5s
  "DefaultNotifyMessage": "Arcdps just updated!!",
  "BotStatus": "@mention help",
  "DebugLevel": "DEBUG",
  "Token": "<BOT TOKEN>",
  "Admins": [
    "<USER ID>"
  ]
}
```

## General commands:
1. Add this channel to notify list: `@mention add [custom message]`
2. Delete this channel from notify list: `@mention del`
3. Edit notify message: `@mention edit <message>`
4. Display help message: `@mention help`
5. Test message: `@mention test`
6. Show last check status: `@mention lastcheck`
7. Add the webhook to the notify list: `@mention addwh <webhook url> [custom message]`
8. Delete the webhook from the notify list: `@mention del <webhook url>`
9. Edit notify message for the webhook: `@mention edit <webhook url> <message>`
10. Test webhook message: `@mention test <webhook url>`

## Admin commands:
1. Set debug level: `@mention setdebuglevel <DEBUG | VERBOSE | INFO | ERROR>`
2. Set check interval: `@mention setinterval <interval in ms>`
3. Set bot status: `@mention setstatus <status>`
4. Perform update check immediately: `@mention checknow`
5. Save config to file: `@mention saveconfig`
6. Dump config: `@mention printconfig`
7. Display admin help message: `@mention helpadmin`

## Setting up webhook:
1. Create a webhook in server setting or channel setting  
  ![](https://i.imgur.com/bO2k7Y1.png)
2. Copy the webhook url  
  ![](https://i.imgur.com/SR4J7D2.png)
3. Everyone has the url can use this webhook, so it's recommended that add the webhook through the DM channel  
  ![](https://i.imgur.com/Tnttp3X.png)
