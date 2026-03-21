import { ContextMenuCommandBuilder } from '@discordjs/builders';
import { ApplicationCommandType } from 'discord-api-types/v10';

export const dumpTaskName = 'Upload Dump';

export const data = new ContextMenuCommandBuilder()
    .setName(dumpTaskName)
    .setType(ApplicationCommandType.Message);
