import {ContextMenuCommandBuilder} from '@discordjs/builders';
import {ApplicationCommandType} from 'discord-api-types/v10';

export const githubTaskName = 'Open Support Thread';

export const data = new ContextMenuCommandBuilder()
    .setName(githubTaskName)
    .setType(ApplicationCommandType.Message);
