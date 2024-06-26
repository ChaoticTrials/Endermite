import {CacheType, Client as DiscordClient, Interaction, Message, TextChannel, ThreadChannel} from 'discord.js';
import fetch from 'node-fetch';

import * as dcu from '../discordbot/discordUtil';
import {formatJson} from './pasteFormatter';
import {createPaste, Paste} from './pasteApi';
import {pasteTaskName} from '../commands/paste';

const ALLOWED_SUFFIXES: string[] = [
    '.txt', '.log', '.csv', '.md',
    '.cfg', '.json', '.json5', '.toml', '.yml', '.yaml', '.ini', '.conf',
    '.html', '.htm', '.iml', '.xml', 'js', 'ts', 'zs', 'py',
    '.sh', '.bat', '.cmd', '.ps1'
];

export function startPasteHandler(client: DiscordClient): void {
    client.on('interactionCreate', async (interaction: Interaction<CacheType>) => {
        if (!interaction.isMessageContextMenuCommand()) {
            return;
        }

        if (interaction.commandName != pasteTaskName) {
            return;
        }

        try {
            const channel = await dcu.tryAnyTextChannel(client, interaction.channelId);
            const msg = await channel?.messages?.fetch(interaction.targetMessage.id);
            if (channel == null || msg == null) {
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

            await interaction.deferReply({
                ephemeral: true,
                fetchReply: true
            });
            const text: string = await (await fetch(paste.url)).text();
            const formatted = formatJson(paste.fileName, text);
            const result: Paste = await createPaste(paste.fileName, formatted);

            if (await canSend(channel)) {
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
                return;
            }

            await interaction.editReply({content: `I can't send messages here. Here's your paste: <${result.url}>\n**Delete paste**: <${result.delete}>`});
        } catch (err) {
            console.log(err);
        }
    });
}

async function canSend(channel: TextChannel | ThreadChannel): Promise<boolean> {
    if (!channel.isThread()) {
        return true;
    }

    channel = channel as ThreadChannel;
    if (!channel.joined && channel.joinable) {
        await channel.join();
    }

    return channel.joined;
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
