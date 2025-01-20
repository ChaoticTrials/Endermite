import * as fs from 'fs';

require('dotenv').config({ path: 'tokens.env' });

import * as discordAuth from './discordbot/discordAuth'
import * as discordBot from './discordbot/discordBot'
import * as slashCommands from './slashCommands'
import {BotConfig} from './discordbot/botConfig';
import {DiscordAuth} from './discordbot/discordAuth';

(async() => {
    let configFile = 'botconfig.json';
    const config: BotConfig = JSON.parse(fs.readFileSync(configFile, { encoding: 'utf-8' }));
    const discord: DiscordAuth = await discordAuth.registerDiscord();
    await slashCommands.reloadSlashCommands(discord, config.guild);
    await discordBot.startDiscordBot(discord.client, config);

    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), {encoding: 'utf-8'});
    console.log('Discord bot started.');
})();
