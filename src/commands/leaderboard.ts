import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    userMention
} from 'discord.js'

import { getRoommates } from '../repositories/UserRepository.js'

import ApplicationCommand from '../templates/ApplicationCommand.js'

export default new ApplicationCommand({
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('See leaderboard'),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: false })

        const users = await getRoommates()
        const topUsers = users.sort((a, b) => b.points - a.points)

        const topUsersList = topUsers
            .map((user, index) => {
                const rank = index === 0 ? '👑 ' : `${index + 1}.  `

                const line = `${rank}${userMention(
                    user.discordUserId
                )} - ${`${user.points} pts`}`

                return user.discordUserId === interaction.user.id
                    ? `**${line}**`
                    : line
            })
            .join('\n')
        const header = new TextDisplayBuilder().setContent(
            `🏆 Leaderboard for ${interaction.guild?.name ?? 'this server'}`
        )

        const separator = new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true)

        const topUsersListText = new TextDisplayBuilder().setContent(
            topUsersList
        )

        const container = new ContainerBuilder()
            .addTextDisplayComponents(header)
            .addSeparatorComponents(separator)
            .addTextDisplayComponents(topUsersListText)
            .setAccentColor(0xffd700)

        await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        })
    }
})
