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
import {validaterTaskName} from '../commands/validater';
import {validateFile, ValidationResult} from "./jsonFormatter";

const ALLOWED_SUFFIXES: string[] = [
    'json', 'json5'
];

export function startValidationHandler(client: DiscordClient): void {
    client.on('interactionCreate', async interaction => {
        if (!interaction.isMessageContextMenuCommand()) {
            return;
        }

        if (interaction.commandName != validaterTaskName) {
            return;
        }

        try {
            const channel = await dcu.channel(client, interaction.channelId as Snowflake | null, [ChannelType.GuildText, ChannelType.PublicThread]);
            if (channel instanceof dcu.ChannelError) {
                await dcu.sendError(interaction, 'Can\'t validate config: No message selected: ' + channel);
                return;
            }

            const msg = await channel.messages.fetch(interaction.targetMessage.id);
            if (msg == null) {
                await dcu.sendError(interaction, 'Can\'t validate config: No message selected.');
                return;
            }

            await interaction.deferReply({
                ephemeral: true,
                fetchReply: true
            });

            const attachment = await findAttachmentToValidate(msg, interaction);
            if (attachment == null) {
                await dcu.sendError(interaction, 'Can\'t validate config: No suitable attachment found.');
                return;
            }

            if (!await dcu.join(channel)) {
                await dcu.sendError(interaction, 'I can\'t join here.');
                return;
            }

            const text: string = await (await fetch(attachment.url)).text();
            const validationResult: ValidationResult = validateFile(attachment.fileName, text);

            if (validationResult.valid) {
                channel.send({
                    content: `:white_check_mark: \`${attachment.fileName}\` is valid`,
                    reply: {
                        messageReference: msg,
                        failIfNotExists: false
                    },
                    allowedMentions: {
                        repliedUser: false
                    }
                });
            } else {
                channel.send({
                    content: formatJsonError(attachment.fileName, validationResult.error),
                    reply: {
                        messageReference: msg,
                        failIfNotExists: false
                    },
                    allowedMentions: {
                        repliedUser: false
                    }
                });
            }
            await interaction.deleteReply();
        } catch (err) {
            console.log(err);
        }
    });
}

function formatJsonError(fileName: string, error: any): string {
    let message = `:x: \`${fileName}\` is invalid\n`;
    if (!error) return message;

    message += `\`\`\`\n${error.message}\n\`\`\`\n`;

    if (error.context) {
        const { line, column, lineContent, prevLinesContent, nextLinesContent } = error.context;

        message += `**Error at line ${line}, column ${column}:**\n\`\`\`json\n`;

        // Calculate the maximum line number to determine padding
        const maxLine = line + (nextLinesContent?.length || 0);
        const lineNumPadding = String(maxLine).length;

        // Add previous lines for context if they exist
        if (prevLinesContent && prevLinesContent.length > 0) {
            prevLinesContent.forEach((prevLine: string, index: number) => {
                const lineNumber = line - (prevLinesContent.length - index);
                const paddedLineNum = String(lineNumber).padStart(lineNumPadding, ' ');
                message += `${paddedLineNum} | ${prevLine}\n`;
            });
        }

        // Add the error line with a marker
        const paddedLine = String(line).padStart(lineNumPadding, ' ');
        message += `${paddedLine} | ${lineContent}\n`;
        message += `${' '.repeat(lineNumPadding + 3 + column - 1)}^ Error occurs here\n`;

        // Add next lines for context if they exist
        if (nextLinesContent && nextLinesContent.length > 0) {
            nextLinesContent.forEach((nextLine: string, index: number) => {
                const lineNumber = line + (index + 1);
                const paddedLineNum = String(lineNumber).padStart(lineNumPadding, ' ');
                message += `${paddedLineNum} | ${nextLine}\n`;
            });
        }

        message += '```';
    }

    return message;
}

async function findAttachmentToValidate(msg: Message, interaction: MessageContextMenuCommandInteraction): Promise<AttachmentContext | null> {
    const validAttachments: AttachmentContext[] = [];
    const attachmentButtons: MessageActionRowComponentData[] = msg.attachments.map((attachment) => {
        const name = attachment.name || 'Unnamed file';
        const isAllowedFile = name != null && ALLOWED_SUFFIXES.some(suffix => name.toLowerCase().endsWith(suffix));

        if (isAllowedFile) {
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
            content: 'Please select the file you would like to validate:',
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
                await buttonInteraction!.update({content: 'Validating...', components: []});
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

    return null;
}

interface AttachmentContext {
    fileName: string,
    url: string
}
