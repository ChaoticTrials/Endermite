import {
    ButtonStyle,
    ChannelType,
    Client as DiscordClient,
    ComponentType,
    Message,
    MessageActionRowComponentData,
    MessageContextMenuCommandInteraction,
    Snowflake
} from "discord.js";
import fetch from "node-fetch";

import * as dcu from '../discordbot/discordUtil';
import {createPaste, Paste} from './pasteApi';
import {formatFile} from './pasteFormatter';
import {pasteTaskName} from '../commands/paste';

const ALLOWED_SUFFIXES: string[] = [
    '.txt', '.log', '.csv', '.md',
    '.cfg', '.json', '.json5', '.toml', '.yml', '.yaml', '.ini', '.conf', '.gradle', '.properties', '.mcmeta', '.snbt',
    '.html', '.htm', '.iml', '.xml', 'js', 'ts', 'zs', 'py', 'java',
    '.sh', '.bat', '.cmd', '.ps1'
];

export function startPasteHandler(client: DiscordClient): void {
    client.on('interactionCreate', async interaction => {
        if (!interaction.isMessageContextMenuCommand()) {
            return;
        }

        if (interaction.commandName != pasteTaskName) {
            return;
        }

        try {
            const channel = await dcu.channel(client, interaction.channelId as Snowflake | null, [ChannelType.GuildText, ChannelType.PublicThread]);
            if (channel instanceof dcu.ChannelError) {
                await dcu.sendError(interaction, 'Can\'t create paste: No message selected: ' + channel);
                return;
            }

            const msg = await channel.messages.fetch(interaction.targetMessage.id);
            if (msg == null) {
                await dcu.sendError(interaction, 'Can\'t create paste: No message selected.');
                return;
            }

            await interaction.deferReply({
                ephemeral: true,
                fetchReply: true
            });

            const paste = await findTextToPaste(msg, interaction);
            if (paste == null) {
                await dcu.sendError(interaction, 'Can\'t create paste: No suitable attachment found.');
                return;
            }

            if (paste == 'too_large') {
                await dcu.sendError(interaction, 'Can\'t paste file: Too large');
                return;
            }

            if (!await dcu.join(channel)) {
                await dcu.sendError(interaction, 'I can\'t join here.');
                return;
            }

            const text: string = await (await fetch(paste.url)).text();
            const formatted: string = formatFile(paste.fileName, text);
            const result: Paste | null = await createPaste(paste.fileName, formatted);

            if (result == null) {
                await interaction.editReply({content: 'Failed to create paste.'});
                return;
            }

            await channel.send({
                content: `:page_facing_up: <${result.url}>`,
                reply: {
                    messageReference: msg,
                    failIfNotExists: false
                },
                allowedMentions: {
                    repliedUser: false
                }
            });
            await interaction.editReply({content: '**Delete paste**: <' + result.delete + '>', components: []});
        } catch (err) {
            console.log(err);
        }
    });
}

async function findTextToPaste(msg: Message, interaction: MessageContextMenuCommandInteraction): Promise<PasteText | 'too_large' | null> {
    let defaultReturn: 'too_large' | null = null;

    const validAttachments: PasteText[] = [];
    const attachmentButtons: MessageActionRowComponentData[] = msg.attachments.map((attachment) => {
        const name = attachment.name || 'Unnamed file';
        const isAllowedFile = name != null && ALLOWED_SUFFIXES.some(suffix => name.toLowerCase().endsWith(suffix));

        if (isAllowedFile) {
            if (attachment.size > (6 * 1024 * 1024)) { // paste.ee limit
                defaultReturn = 'too_large';
                return {
                    type: ComponentType.Button,
                    style: ButtonStyle.Secondary,
                    customId: `invalid_button_${attachment.id}`,
                    label: `${name} (Too large)`,
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
                customId: `valid_button_${attachment.id}`,
                label: name,
                disabled: false
            };
        }

        return {
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            customId: `invalid_button_${attachment.id}`,
            label: `${name} (Wrong file type)`,
            disabled: true
        };
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
                    components: attachmentButtons,
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
                await buttonInteraction!.update({content: 'Uploading...', components: []});
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

interface PasteText {
    fileName: string,
    url: string
}
