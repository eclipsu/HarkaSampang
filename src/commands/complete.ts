import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder
} from 'discord.js'
import ApplicationCommand from '../templates/ApplicationCommand.js'
import {
    findChoresAsIncharge,
    markCompleted
} from '../repositories/ChoreRepository.js'
import { findUserByDiscordId } from '../repositories/UserRepository.js'
export default new ApplicationCommand({
    data: new SlashCommandBuilder()
        .setName('complete')
        .setDescription('Marking your chores completed')
        .addStringOption((o) =>
            o
                .setName('chore')
                .setDescription('Name of the Chore to Mark Complete')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const userId = interaction.user.id

        const chores = await findChoresAsIncharge(userId)

        const focused = interaction.options.getFocused().toLowerCase()

        const filtered = chores
            .filter((c) => c.name.toLowerCase().includes(focused))
            .slice(0, 25) // discord allows max 25 autocompletes: TODO: show all in multiple selection embeds

        await interaction.respond(
            filtered.map((c) => ({
                name: `${c.name} (${c.area.name})`,
                value: c.id
            }))
        )
    },

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: false })

        const choreId = interaction.options.getString('chore', true)
        const discordUserId = interaction.user.id

        const roommate = await findUserByDiscordId(discordUserId) // add await
        if (!roommate) {
            await interaction.editReply({
                content:
                    'You are not registered. Ask an admin to set up the bot first.'
            })
            return
        }

        const chores = await findChoresAsIncharge(discordUserId)
        const chore = chores.find((c) => c.id === choreId)

        if (!chore) {
            await interaction.editReply({
                content:
                    "That chore is not in your area. Use `/cover` to do someone else's chore."
            })
            return
        }

        await markCompleted({
            choreId: choreId,
            completedById: roommate.id,
            inchargeId: roommate.id,
            isCover: false,
            pointsAwarded: chore.points
        })

        const embed = new EmbedBuilder()
            .setColor(0x1d9e75)
            .setTitle('Chore completed')
            .setDescription(
                `<@${discordUserId}> completed **${chore.name}**\n+${
                    chore.points
                } pts — total: ${roommate.points + chore.points} pts`
                //                                                                                  ^ was "member", now "roommate"
            )
            .setFooter({ text: `${chore.area.name} · completed just now` })
            .setTimestamp()

        await interaction.editReply({ embeds: [embed] })
    }
})
