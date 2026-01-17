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
import fetch, { Response } from "node-fetch";

import * as dcu from '../discordbot/discordUtil';
import { createPaste, Paste } from './pasteApi';
import { formatFile } from './pasteFormatter';
import { pasteTaskName } from '../commands/paste';
import { gunzipSync } from "node:zlib";
import type { Headers } from "tar-stream";
import * as tar from "tar-stream";
import type { Readable } from "node:stream";

const ALLOWED_SUFFIXES: string[] = [
    '.txt', '.log', '.csv', '.md',
    '.cfg', '.json', '.json5', '.toml', '.yml', '.yaml', '.ini', '.conf', '.gradle', '.properties', '.mcmeta', '.snbt',
    '.html', '.htm', '.iml', '.xml', '.js', '.ts', '.zs', '.py', '.java',
    '.sh', '.bat', '.cmd', '.ps1', '.env',
    '.gz'
];

const PASTEE_LIMIT = 6 * 1024 * 1024;

function isAllowedBySuffix(name: string): boolean {
    return name != null && ALLOWED_SUFFIXES.some(suffix => name.toLowerCase().endsWith(suffix));
}

export function startPasteHandler(client: DiscordClient): void {
    client.on('interactionCreate', async interaction => {
        if (!interaction.isMessageContextMenuCommand()) {
            return;
        }

        if (interaction.commandName != pasteTaskName) {
            return;
        }

        try {
            const channel = await dcu.channel(client, interaction.channelId as Snowflake | null, [ ChannelType.GuildText, ChannelType.PublicThread ]);
            if (channel instanceof dcu.ChannelError) {
                await dcu.sendError(interaction, 'Can\'t create paste: No message selected: ' + channel);
                return;
            }

            const msg = await channel.messages.fetch(interaction.targetMessage.id);
            if (msg == null) {
                await dcu.sendError(interaction, 'Can\'t create paste: No message selected.');
                return;
            }

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

            const { fileName, text, error } = await downloadAndDecodeAttachment(paste);
            if (error) {
                if (error == 'too_large') {
                    await dcu.sendError(interaction, 'Can\'t paste file: Too large');
                } else {
                    await dcu.sendError(interaction, 'Can\'t paste file: No suitable file in archive');
                }
                return;
            }

            await interaction.deferReply({
                ephemeral: true,
                fetchReply: true
            });

            const formatted: string = formatFile(fileName, text);
            const result: Paste | null = await createPaste(fileName, formatted);


            if (result == null) {
                await interaction.editReply({ content: 'Failed to create paste.' });
                return;
            }

            await channel.send({
                content: `:page_facing_up: <${ result.url }>`,
                reply: {
                    messageReference: msg,
                    failIfNotExists: false
                },
                allowedMentions: {
                    repliedUser: false
                }
            });
            await interaction.editReply({ content: '**Delete paste**: <' + result.delete + '>', components: [] });
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
        const isAllowedFile = isAllowedBySuffix(name);

        if (isAllowedFile) {
            if (attachment.size > PASTEE_LIMIT) {
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

function isTarArchive(buf: Buffer): boolean {
    // POSIX tar magic "ustar" at offset 257
    if (buf.length < 263) return false;
    let magic = buf.subarray(257, 263).toString('utf8');
    return magic === 'ustar\0' || magic === 'ustar ';
}

async function extractSingleAllowedFileFromTar(tarBuf: Buffer): Promise<{ fileName: string; text: string } | null> {
    return await new Promise<{ fileName: string; text: string } | null>((resolve, reject) => {
        const extract = tar.extract();

        const files: Array<{ name: string; data: Buffer }> = [];

        extract.on("entry", (header: Headers, stream: Readable, next: (err?: any) => void) => {
            const chunks: Buffer[] = [];

            stream.on("data", (c: Buffer) => chunks.push(c));
            stream.on("end", () => {
                if (header.type === "file") {
                    files.push({ name: header.name, data: Buffer.concat(chunks) });
                }
                next();
            });

            stream.on("error", (err) => next(err));
            stream.resume();
        });

        extract.on("finish", () => {
            const fileEntries = files.filter(f => f.name && isAllowedBySuffix(f.name));
            // Must be exactly one file in the archive AND it must match suffix predicates
            // If you want "only one matching file but allow other non-matching files", change this logic.
            if (files.length !== 1) {
                return resolve(null);
            }

            if (fileEntries.length !== 1) {
                return resolve(null);
            }

            const only = fileEntries[0];
            if (only.data.length > PASTEE_LIMIT) {
                return resolve(null);
            }

            resolve({ fileName: only.name, text: only.data.toString("utf8") });
        });

        extract.on("error", reject);
        extract.end(tarBuf);
    });
}

async function downloadAndDecodeAttachment(paste: PasteText): Promise<{
    fileName: string;
    text: string,
    error?: "too_large" | "no_suitable_file_in_gz"
}> {
    const res: Response = await fetch(paste.url);
    const arr: ArrayBuffer = await res.arrayBuffer();
    const raw: Buffer = Buffer.from(arr);

    if (!paste.fileName.toLowerCase().endsWith(".gz")) {
        return { fileName: paste.fileName, text: raw.toString("utf8") };
    }

    const unzipped = gunzipSync(raw);

    if (unzipped.length > PASTEE_LIMIT) {
        return { fileName: paste.fileName, text: '', error: 'too_large' };
    }

    if (isTarArchive(unzipped)) {
        const extracted = await extractSingleAllowedFileFromTar(unzipped);
        if (!extracted) {
            return { fileName: paste.fileName, text: '', error: 'no_suitable_file_in_gz' };
        }

        return extracted;
    }

    const innerName = paste.fileName.replace(/\.gz$/i, "");
    if (!isAllowedBySuffix(innerName)) {
        return { fileName: paste.fileName, text: '', error: 'no_suitable_file_in_gz' };
    }

    return { fileName: innerName, text: unzipped.toString("utf8") };
}

interface PasteText {
    fileName: string,
    url: string
}
