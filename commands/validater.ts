import {ContextMenuCommandBuilder} from '@discordjs/builders';
import {ApplicationCommandType} from 'discord-api-types/v10';

export const validaterTaskName = 'Validate Config';

export const data = new ContextMenuCommandBuilder()
    .setName(validaterTaskName)
    .setType(ApplicationCommandType.Message);
