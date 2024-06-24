import {
    Client as DiscordClient,
    EmbedBuilder,
    Guild,
    GuildEmoji,
    GuildMember,
    Message,
    MessageReaction,
    PartialUser,
    Role,
    User
} from 'discord.js';
import {ReactEmoteConfig} from './botConfig';

export async function addReactionRole(discord: DiscordClient, guild: Guild, roleMessage: Message, emote: string, roleId: string) {
    const role: Role | null = await guild.roles.fetch(roleId);

    if (role == undefined) {
        console.log('Role not found: ' + roleId);
        return;
    }

    await roleMessage.react(emote);

    discord.on('messageReactionAdd', async (reaction: MessageReaction, user: User | PartialUser) => {
        if (emote == reaction.emoji.id && reaction.message.id == roleMessage.id && reaction.message.guild != null) {
            let member: GuildMember = await reaction.message.guild.members.fetch(user.id);
            await member.roles.add(role.id);
        }
    });

    discord.on('messageReactionRemove', async (reaction: MessageReaction, user: User | PartialUser) => {
        if (emote == reaction.emoji.id && reaction.message.id == roleMessage.id && reaction.message.guild != null) {
            let member: GuildMember = await reaction.message.guild.members.fetch(user.id);
            await member.roles.remove(role.id);
        }
    });
}

export async function editReactionMessage(guild: Guild, roleMessage: Message, configs: ReactEmoteConfig[]) {
    if (configs.length == 0) {
        console.log('No emotes to react');
        return;
    }

    let embed = new EmbedBuilder();
    embed.setTitle('By reacting to this message, you\'ll get the corresponding role.');
    embed.setColor(0x46325B);
    embed.setTimestamp();
    embed.setFooter({
        text: 'Endermite',
        iconURL: 'https://cdn.discordapp.com/avatars/1254781618196054108/724c24e2324939a8c8cfd17fb55f76e8.webp'
    });

    for (const config of configs) {
        let emoji: GuildEmoji = await guild.emojis.fetch(config.emote);
        let role: Role | null = await guild.roles.fetch(config.role);
        if (emoji == null) {
            console.log('Emoji not found: ' + config.emote);
            continue;
        }

        if (role == null) {
            console.log('Role not found: ' + config.role);
            continue;
        }

        await roleMessage.react(emoji);
        embed.addFields({name: `${emoji}`, value: `Role: ${role}\nDescription: ${config.description}`});
    }

    embed.toJSON();
    await roleMessage.edit({content: null, embeds: [embed]});
}
