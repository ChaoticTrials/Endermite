import {Client as DiscordClient, Guild} from 'discord.js';
import {forumChannel, textChannel} from './discordUtil';
import {BotConfig} from './botConfig';
import {addReactionRole, editReactionMessage} from './discordReaction';
import {startPasteHandler} from '../paste/pasteHandler';
import {startGithubHandler} from '../github/githubHandler';

export async function startDiscordBot(discord: DiscordClient, config: BotConfig): Promise<void> {
    const guild: Guild = await discord.guilds.fetch(config.guild);

    startPasteHandler(discord);
    startGithubHandler(discord, await textChannel(discord, config.github_channel), await forumChannel(discord, config.support_thread));

    const roleChannel = await textChannel(discord, config.role_channel);
    const roleMessage = await roleChannel.messages.fetch(config.role_message);
    for (const emoteConfig of config.emote_configs) {
        await addReactionRole(discord, guild, roleMessage, emoteConfig.emote, emoteConfig.role);
    }

    await editReactionMessage(guild, roleMessage, config.emote_configs);
}
