import {
    Channel,
    ChannelType,
    Client as DiscordClient,
    DMChannel,
    ForumChannel,
    Interaction,
    NewsChannel,
    PartialGroupDMChannel,
    PrivateThreadChannel,
    PublicThreadChannel,
    Snowflake,
    StageChannel,
    TextChannel,
    VoiceChannel
} from "discord.js";

export enum ChannelErrorType {
    NotProvided = 'notprovided', NotFound = 'notfound', WrongType = 'wrongtype'
}

export class ChannelError<Type extends ChannelErrorType> {
    public readonly type: ChannelErrorType;
    public readonly message: string;

    constructor(type: Type, message: string | undefined = undefined) {
        this.type = type;
        this.message = message === undefined ? type : message
    }

    public toString(): string {
        return this.message
    }

    public throw(): never {
        throw new Error(this.message)
    }
}

type NotProvidedChannelError = ChannelError<ChannelErrorType.NotProvided>
type AnyChannelError = ChannelError<ChannelErrorType.NotFound>
type TypedChannelError = ChannelError<ChannelErrorType.NotFound | ChannelErrorType.WrongType>

type TypedChannel<Type extends ChannelType> =
    Type extends ChannelType.GuildText ? TextChannel :
        Type extends ChannelType.DM ? DMChannel :
            Type extends ChannelType.GroupDM ? PartialGroupDMChannel :
                Type extends ChannelType.GuildVoice ? VoiceChannel :
                    Type extends ChannelType.GuildAnnouncement ? NewsChannel :
                        Type extends ChannelType.GuildForum ? ForumChannel :
                            Type extends ChannelType.AnnouncementThread ? PublicThreadChannel<boolean> :
                                Type extends ChannelType.PublicThread ? PublicThreadChannel<boolean> :
                                    Type extends ChannelType.PrivateThread ? PrivateThreadChannel :
                                        Type extends ChannelType.GuildStageVoice ? StageChannel :
                                            Channel

export async function channel(discord: DiscordClient, id: Snowflake): Promise<Channel | AnyChannelError>
export async function channel<Type extends ChannelType>(discord: DiscordClient, id: Snowflake, type: Type): Promise<TypedChannel<Type> | TypedChannelError>
export async function channel<Types extends ChannelType[]>(discord: DiscordClient, id: Snowflake, type: Types): Promise<TypedChannel<typeof type[number]> | TypedChannelError>
export async function channel(discord: DiscordClient, id: Snowflake | undefined | null): Promise<Channel | AnyChannelError | NotProvidedChannelError>
export async function channel<Type extends ChannelType>(discord: DiscordClient, id: Snowflake | undefined | null, type: Type): Promise<TypedChannel<Type> | TypedChannelError | NotProvidedChannelError>
export async function channel<Types extends ChannelType[]>(discord: DiscordClient, id: Snowflake | undefined | null, type: Types): Promise<TypedChannel<typeof type[number]> | TypedChannelError | NotProvidedChannelError>
export async function channel(discord: DiscordClient, id: Snowflake | undefined | null, type: ChannelType | [ChannelType] | undefined = undefined): Promise<Channel | ChannelError<ChannelErrorType>> {
    if (id === undefined || id === null) {
        return new ChannelError(ChannelErrorType.NotProvided, "No channel given.");
    }

    const channel = await discord.channels.fetch(id);
    if (channel == null) {
        return new ChannelError(ChannelErrorType.NotFound, "Discord channel not found: " + id);
    }

    if (type !== undefined && (Array.isArray(type) ? !(type.includes(channel.type)) : channel.type != type)) {
        return new ChannelError(ChannelErrorType.WrongType, "Discord channel is not of type " + type + ": " + id + " (" + channel.type + ")");
    }

    return channel;
}

export async function join(channel: Channel): Promise<boolean> {
    if (channel.isThread() && channel.joinable && !channel.joined) {
        return (await channel.join()).joined
    } else {
        return true;
    }
}

export async function sendError(interaction: Interaction, text: string): Promise<void> {
    if (interaction.isCommand()) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.reply({
                content: text,
                ephemeral: true,
                fetchReply: true
            });
        }
    }
}