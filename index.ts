import * as fs from 'fs';
import * as discordAuth from './discordbot/discordAuth'
import { DiscordAuth } from './discordbot/discordAuth'
import * as discordBot from './discordbot/discordBot'
import * as slashCommands from './slashCommands'
import { BotConfig } from './discordbot/botConfig';

require('dotenv').config({ path: 'tokens.env' });

(async() => {
    let configFile = 'botconfig.json';
    const config: BotConfig = JSON.parse(fs.readFileSync(configFile, { encoding: 'utf-8' }));
    const discord: DiscordAuth = await discordAuth.registerDiscord();
    await slashCommands.reloadSlashCommands(discord, config.guild);
    await discordBot.startDiscordBot(discord.client, config);

    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), {encoding: 'utf-8'});
    console.log('Discord bot started.');
})();
