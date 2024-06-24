import {ChannelType, Client as DiscordClient, Interaction, Snowflake, TextChannel} from "discord.js";

export async function tryTextChannel(discord: DiscordClient, id: Snowflake | undefined): Promise<TextChannel | null> {
    try {
        return await textChannel(discord, id);
    } catch (err) {
        return null;
    }
}

export async function textChannel(discord: DiscordClient, id: Snowflake | undefined): Promise<TextChannel> {
    if (id == undefined) {
        throw new Error("No channel given");
    }

    const channel = await discord.channels.fetch(id);
    if (channel == null) {
        throw new Error("Discord channel not found: " + channel);
    }

    if (channel.type != ChannelType.GuildText) {
        throw new Error("Discord channel is not a text channel: " + channel);
    }

    return channel as TextChannel;
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