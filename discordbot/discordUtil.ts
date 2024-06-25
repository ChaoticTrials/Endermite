import {
    ChannelType,
    Client as DiscordClient,
    ForumChannel,
    Interaction,
    Snowflake,
    TextChannel,
    ThreadChannel
} from 'discord.js';

export async function tryAnyTextChannel(discordClient: DiscordClient, id: Snowflake | undefined): Promise<TextChannel | ThreadChannel | null> {
    try {
        return await textChannel(discordClient, id);
    } catch (err) {
        return null;
    }
}

export async function tryTextChannel(discord: DiscordClient, id: Snowflake | undefined): Promise<TextChannel | null> {
    try {
        const channel = await textChannel(discord, id);
        return channel.isThread() ? null : channel as TextChannel;
    } catch (err) {
        return null;
    }
}

export async function tryThreadChannel(discord: DiscordClient, id: Snowflake | undefined): Promise<ThreadChannel | null> {
    try {
        const channel = await textChannel(discord, id);
        return channel.isThread() ? channel as ThreadChannel : null;
    } catch (err) {
        return null;
    }
}

export async function textChannel(discord: DiscordClient, id: Snowflake | undefined): Promise<TextChannel | ThreadChannel> {
    if (id == undefined) {
        throw new Error('No channel given');
    }

    const channel = await discord.channels.fetch(id);
    if (channel == null) {
        throw new Error('Discord channel not found: ' + channel);
    }

    if (channel.type != ChannelType.GuildText && channel.type != ChannelType.PublicThread) {
        throw new Error('Discord channel is not a text/thread channel: ' + channel);
    }

    return channel as TextChannel | ThreadChannel;
}

export async function forumChannel(discord: DiscordClient, id: Snowflake | undefined): Promise<ForumChannel> {
    if (id == undefined) {
        throw new Error('No channel given');
    }

    const channel = await discord.channels.fetch(id);
    if (channel == null) {
        throw new Error('Discord channel not found: ' + channel);
    }

    if (channel.type != ChannelType.GuildForum) {
        throw new Error('Discord channel is not a forum channel: ' + channel);
    }

    return channel as ForumChannel;
}

export async function sendError(interaction: Interaction, text: string): Promise<void> {
    if (interaction.isCommand()) {
        await interaction.reply({
            content: text,
            ephemeral: true,
            fetchReply: true
        });
    }
}