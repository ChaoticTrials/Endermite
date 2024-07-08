import {
    CacheType,
    ChannelType,
    Client as DiscordClient,
    ForumChannel,
    Interaction,
    PublicThreadChannel,
    Snowflake,
    TextChannel
} from 'discord.js';
import fetch from 'node-fetch';
import {githubTaskName} from '../commands/github';
import * as dcu from '../discordbot/discordUtil';

export function startGithubHandler(client: DiscordClient, githubChannel: TextChannel | PublicThreadChannel, supportThread: ForumChannel): void {
    client.on('interactionCreate', async (interaction: Interaction<CacheType>) => {
        if (!interaction.isMessageContextMenuCommand()) {
            return;
        }

        if (interaction.commandName != githubTaskName) {
            return;
        }

        try {
            if (interaction.channelId != githubChannel.id) {
                await dcu.sendError(interaction, 'You\'re not in the correct GitHub channel.');
                return;
            }

            const channel = await dcu.channel(client, interaction.channelId as Snowflake | null, [ChannelType.GuildText, ChannelType.PublicThread]);
            if (channel instanceof dcu.ChannelError) {
                await dcu.sendError(interaction, 'Can\'t process: No message selected: ' + channel);
                return;
            }

            const msg = await channel.messages.fetch(interaction.targetMessage.id);
            if (msg == null) {
                await dcu.sendError(interaction, 'Can\'t process: No message selected.');
                return;
            }

            if (msg.embeds.length > 0 && isIssue(msg.embeds[0].url)) {
                const url = msg.embeds[0].url as string;
                const owner = getRepoOwner(url);
                const name = getRepoName(url);
                const issue = getIssueNumber(url);

                if (owner == null || name == null || issue == null) {
                    await dcu.sendError(interaction, 'Can\'t process: Failed to extract issue information.');
                    return;
                }

                await interaction.deferReply({
                    ephemeral: true,
                    fetchReply: true
                });

                const issueName = await getIssueName(owner, name, issue);
                const newThread = await supportThread.threads.create({
                    message: {content: `${interaction.user} opened this thread based on ${msg.url} to discuss about [this issue](${url})`},
                    name: issueName
                });

                await interaction.editReply({content: `New support thread opened here: ${newThread}`});
            }
        } catch (err) {
            console.log(err);
        }
    });
}

function isIssue(url: string | null): boolean {
    return url != null && /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/\d+(?:#issuecomment-\d+)?$/.test(url);
}

function getRepoOwner(url: string) {
    const match = url.match(/^https:\/\/github\.com\/([^\/]+)\/[^\/]+\/issues\/\d+/);
    return match ? match[1] : null;
}

function getRepoName(url: string) {
    const match = url.match(/^https:\/\/github\.com\/[^\/]+\/([^\/]+)\/issues\/\d+/);
    return match ? match[1] : null;
}

function getIssueNumber(url: string) {
    const match = url.match(/^https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/(\d+)/);
    return match ? match[1] : null;
}

async function getIssueName(owner: string, name: string, issueNumber: string): Promise<string> {
    const url = `https://api.github.com/repos/${owner}/${name}/issues/${issueNumber}`;
    const prefix = `${owner}/${name}#${issueNumber}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return prefix;
        }
        const data = await response.json();
        return `[${prefix}] ${data.title}`;
    } catch (error) {
        return prefix;
    }
}