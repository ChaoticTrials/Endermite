import {ChannelType, Client as DiscordClient, Message, Snowflake} from "discord.js";
import fetch from "node-fetch";

import * as dcu from '../discordbot/discordUtil';
import {createPaste, Paste} from './pasteApi';
import {formatFile} from './pasteFormatter';
import {pasteTaskName} from '../commands/paste';

const ALLOWED_SUFFIXES: string[] = [
    '.txt', '.log', '.csv', '.md',
    '.cfg', '.json', '.json5', '.toml', '.yml', '.yaml', '.ini', '.conf',
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

            const paste = findTextToPaste(msg);
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
            await interaction.editReply({content: '**Delete paste**: <' + result.delete + '>'});
        } catch (err) {
            console.log(err);
        }
    });
}

function findTextToPaste(msg: Message): PasteText | 'too_large' | null {
    let defaultReturn: 'too_large' | null = null;
    for (const attachment of msg.attachments.values()) {
        const name = attachment.name;
        if (name != null && ALLOWED_SUFFIXES.some(suffix => name.toLowerCase().endsWith(suffix))) {
            if (attachment.size > (100 * 1024)) {
                defaultReturn = 'too_large';
            } else {
                return {
                    fileName: name,
                    url: attachment.url
                };
            }
        }
    }

    return defaultReturn;
}

interface PasteText {
    fileName: string,
    url: string
}
