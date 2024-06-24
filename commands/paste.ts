import {ContextMenuCommandBuilder} from "@discordjs/builders";
import {ApplicationCommandType} from "discord-api-types/v10";

export const pasteTaskName = 'Create Paste';

export const data = new ContextMenuCommandBuilder()
    .setName(pasteTaskName)
    .setType(ApplicationCommandType.Message);
