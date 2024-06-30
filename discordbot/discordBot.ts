import {ChannelType, Client as DiscordClient, ForumChannel, Guild, PublicThreadChannel, TextChannel} from 'discord.js';
import {channel, ChannelError} from './discordUtil';
import {BotConfig} from './botConfig';
import {addReactionRole, editReactionMessage} from './discordReaction';
import {startPasteHandler} from '../paste/pasteHandler';
import {startGithubHandler} from '../github/githubHandler';

export async function startDiscordBot(discord: DiscordClient, config: BotConfig): Promise<void> {
    const guild: Guild = await discord.guilds.fetch(config.guild);

    startPasteHandler(discord);
    const githubChannel = await channel(discord, config.github_channel, [ChannelType.GuildText, ChannelType.PublicThread]);
    if (githubChannel instanceof ChannelError) {
        githubChannel.throw();
    }

    const supportThread = await channel(discord, config.support_thread, ChannelType.GuildForum);
    if (supportThread instanceof ChannelError) {
        supportThread.throw();
    }

    startGithubHandler(discord, githubChannel as TextChannel | PublicThreadChannel, supportThread as ForumChannel);

    const roleChannel = await channel(discord, config.role_channel, ChannelType.GuildText);
    if (roleChannel instanceof ChannelError) {
        roleChannel.throw();
    }

    const roleMessage = await (roleChannel as TextChannel).messages.fetch(config.role_message);
    for (const emoteConfig of config.emote_configs) {
        await addReactionRole(discord, guild, roleMessage, emoteConfig.emote, emoteConfig.role);
    }

    await editReactionMessage(guild, roleMessage, config.emote_configs);
}
