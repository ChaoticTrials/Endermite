import {ActivityType, Client as DiscordClient, GatewayIntentBits, Partials} from "discord.js";

export interface DiscordAuth {
    client: DiscordClient
    clientId: string
}

export async function registerDiscord(): Promise<DiscordAuth> {
    if (process.env.DISCORD_CLIENT_ID === undefined) {
        throw new Error("No discord client id provided");
    }

    if (process.env.DISCORD_TOKEN === undefined) {
        throw new Error("No discord bot token provided");
    }

    const client = new DiscordClient({
        partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.GuildMember, Partials.User],
        intents: [
            GatewayIntentBits.Guilds,
            // GatewayIntentBits.GuildMembers,
            // GatewayIntentBits.GuildModeration,
            // GatewayIntentBits.GuildEmojisAndStickers,
            // GatewayIntentBits.GuildIntegrations,
            // GatewayIntentBits.GuildWebhooks,
            // GatewayIntentBits.GuildInvites,
            // GatewayIntentBits.GuildVoiceStates,
            // GatewayIntentBits.GuildPresences,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMessageReactions,
            // GatewayIntentBits.GuildMessageTyping,
            GatewayIntentBits.DirectMessages,
            // GatewayIntentBits.GuildMessageReactions
            // GatewayIntentBits.DirectMessageTyping
        ]
    });

    await client.login(process.env.DISCORD_TOKEN);
    client.user?.setStatus('online');
    client.user?.setActivity({name: 'you',  type: ActivityType.Watching });
    console.log("Connected to discord");

    return {
        client: client,
        clientId: process.env.DISCORD_CLIENT_ID
    };
}
