export interface BotConfig {
    guild: string
    support_thread: string
    github_channel: string
    role_channel: string
    role_message: string
    emote_configs: ReactEmoteConfig[]
}

export interface ReactEmoteConfig {
    emote: string
    role: string
    description: string
}
