import {
    ButtonComponentData,
    ButtonStyle,
    ChannelType,
    Client as DiscordClient,
    ComponentType,
    Message,
    MessageActionRowComponentData,
    MessageContextMenuCommandInteraction,
    Snowflake
} from "discord.js";

import * as dcu from '../discordbot/discordUtil';
import { dumpTaskName } from "../commands/dump";
import { Dump, uploadDump } from "./dumpviewerApi";

const ALLOWED_SUFFIX: string = '.zip';

const DUMPVIEWER_LIMIT = 512 * 1024 * 1024;

function isAllowedBySuffix(name: string): boolean {
    return name != null && name.toLowerCase().endsWith(ALLOWED_SUFFIX);
}

export function startDumpHandler(client: DiscordClient): void {
    client.on('interactionCreate', async interaction => {
        if (!interaction.isMessageContextMenuCommand()) {
            return;
        }

        if (interaction.commandName != dumpTaskName) {
            return;
        }

        await interaction.deferReply({
            ephemeral: true
        });

        try {
            const channel = await dcu.channel(client, interaction.channelId as Snowflake | null, [ ChannelType.GuildText, ChannelType.PublicThread ]);
            if (channel instanceof dcu.ChannelError) {
                await dcu.sendError(interaction, 'Can\'t upload dump: No message selected: ' + channel);
                return;
            }

            const msg = await channel.messages.fetch(interaction.targetMessage.id);
            if (msg == null) {
                await dcu.sendError(interaction, 'Can\'t upload dump: No message selected.');
                return;
            }

            const dump = await findDumpToUpload(msg, interaction);
            if (dump == null) {
                await dcu.sendError(interaction, 'Can\'t upload dump: No suitable attachment found.');
                return;
            }

            if (dump == 'too_large') {
                await dcu.sendError(interaction, 'Can\'t upload dump file: Too large');
                return;
            }

            if (!await dcu.join(channel)) {
                await dcu.sendError(interaction, 'I can\'t join here.');
                return;
            }

            const result: Dump | null = await uploadDump(dump.url, 7 * 24 * 60 * 60);


            if (result == null) {
                await interaction.editReply({ content: 'Failed to upload dump file.' });
                return;
            }

            await channel.send({
                content: `:package: <${ result.viewUrl }>`,
                reply: {
                    messageReference: msg,
                    failIfNotExists: false
                },
                allowedMentions: {
                    repliedUser: false
                }
            });
            await interaction.editReply({ content: '**Delete dump**: <' + result.deleteUrl + '>', components: [] });
        } catch (err) {
            console.log(err);
        }
    });
}

async function findDumpToUpload(msg: Message, interaction: MessageContextMenuCommandInteraction): Promise<DumpFileMeta | 'too_large' | null> {
    let defaultReturn: 'too_large' | null = null;

    const validAttachments: DumpFileMeta[] = [];
    const attachmentButtons: ButtonComponentData[] = msg.attachments.map((attachment) => {
        const name = attachment.name || 'Unnamed file';
        const isAllowedFile = isAllowedBySuffix(name);

        if (isAllowedFile) {
            if (attachment.size > DUMPVIEWER_LIMIT) {
                defaultReturn = 'too_large';
                return {
                    type: ComponentType.Button,
                    style: ButtonStyle.Secondary,
                    customId: `invalid_button_${ attachment.id }`,
                    label: `${ name } (Too large)`,
                    disabled: true
                };
            }

            // Valid attachment; include it in the valid list
            validAttachments.push({
                fileName: name,
                url: attachment.url
            });

            return {
                type: ComponentType.Button,
                style: ButtonStyle.Primary,
                customId: `valid_button_${ attachment.id }`,
                label: name,
                disabled: false
            };
        }

        return {
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            customId: `invalid_button_${ attachment.id }`,
            label: `${ name } (Wrong file type)`,
            disabled: true
        };
    });

    const validOnlyButtons: MessageActionRowComponentData[] = attachmentButtons.filter((button) => {
        return !button.disabled;
    });

    if (validAttachments.length === 1) {
        return validAttachments[0];
    }

    if (validAttachments.length > 5) {
        await interaction.editReply({
            content: 'Too many files. Unable to create buttons for selection. Please do it yourself, sorry <3',
            components: []
        });

        return null;
    }

    // If there are multiple valid attachments, prompt the user to pick one
    if (validAttachments.length > 1) {
        await interaction.editReply({
            content: 'Please select the file you would like to upload:',
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: validOnlyButtons,
                },
            ],
        });

        // Wait for user selection here
        const filter = (buttonInteraction: any) =>
            buttonInteraction.user.id === interaction.user.id &&
            buttonInteraction.customId.startsWith('valid_button');

        try {
            const buttonInteraction = await interaction.channel?.awaitMessageComponent({
                filter,
                componentType: ComponentType.Button,
                time: 30 * 1000,
            });

            const selectedId = buttonInteraction!.customId.split('_').pop(); // Extract attachment ID
            const selectedAttachment = selectedId ? validAttachments.find(at => at.url.includes(selectedId)) ?? null : null;

            if (selectedAttachment) {
                await buttonInteraction!.update({ content: 'Uploading...', components: [] });
                return selectedAttachment;
            }
        } catch (e) {
            await interaction.editReply({
                content: 'No file was selected in time. Please try again.',
                components: []
            });
            return null;
        }
    }

    return defaultReturn;
}

interface DumpFileMeta {
    fileName: string,
    url: string
}
