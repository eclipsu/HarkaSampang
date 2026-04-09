import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ActionRowBuilder,
    ComponentType,
    StringSelectMenuInteraction,
    MessageFlags
} from 'discord.js'
import ApplicationCommand from '../templates/ApplicationCommand.js'
import { findAllAreas } from '../repositories/AreaRepository.js'
import {
    getChoresByAreaForToday,
    markCompleted
} from '../repositories/ChoreRepository.js'
import { getOrCreateUser } from '../repositories/UserRepository.js'
import { Chore } from '../entities/Chore.js'
import { ChoreCompletion } from '../entities/ChoresCompletion.js'
import { Area } from '../entities/Area.js'

const areas: Area[] = await findAllAreas()

function buildEmbed(
    areaName: string,
    completed: ChoreCompletion[],
    due: Chore[],
    today: Date
): EmbedBuilder {
    const dateStr = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })

    const totalPoints: number = completed.reduce(
        (sum, c) => sum + c.pointsAwarded,
        0
    )
    const duePoints: number = due.reduce((sum, c) => sum + c.points, 0)

    const completedField: string =
        completed.length > 0
            ? completed
                  .map(
                      (c) =>
                          `✅ **${c.chore.name}** — \`+${c.pointsAwarded}pts\``
                  )
                  .join('\n')
            : '*No chores completed yet*'

    const dueField: string =
        due.length > 0
            ? due
                  .map(
                      (c) =>
                          `🔲 **${c.name}** — \`${c.points}pts\` • *${c.recurrence}*`
                  )
                  .join('\n')
            : '*All chores completed! 🎉*'

    return new EmbedBuilder()
        .setTitle(`🧹 Chore Report — ${areaName}`)
        .setDescription(`📅 **${dateStr}**`)
        .setColor(
            completed.length > 0 && due.length === 0 ? 0x2ecc71 : 0xe67e22
        )
        .addFields(
            {
                name: `Completed (${completed.length}) — ${totalPoints}pts earned`,
                value: completedField
            },
            {
                name: `Due (${due.length}) — ${duePoints}pts remaining`,
                value: dueField
            }
        )
        .setFooter({
            text: `${completed.length}/${
                completed.length + due.length
            } chores done`
        })
        .setTimestamp()
}

function buildDoneEmbed(
    choreName: string,
    discordUserId: string,
    pointsAwarded: number
): EmbedBuilder {
    return new EmbedBuilder()
        .setDescription(
            `✅ **${choreName}** marked as done by <@${discordUserId}> — \`+${pointsAwarded}pts\``
        )
        .setColor(0x2ecc71)
        .setTimestamp()
}

function buildAreaRow(
    selectedId?: string
): ActionRowBuilder<StringSelectMenuBuilder> {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('select_area')
            .setPlaceholder('Select an area…')
            .addOptions(
                areas.slice(0, 25).map((a) =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(a.name)
                        .setValue(a.id)
                        .setDefault(a.id === selectedId)
                )
            )
    )
}

function buildChoreRow(
    due: Chore[]
): ActionRowBuilder<StringSelectMenuBuilder> {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('complete_chore')
            .setPlaceholder('Mark a chore as complete…')
            .addOptions(
                due
                    .slice(0, 25)
                    .map((c) =>
                        new StringSelectMenuOptionBuilder()
                            .setLabel(c.name)
                            .setDescription(`${c.points} pts`)
                            .setValue(c.id)
                    )
            )
    )
}

export default new ApplicationCommand({
    data: new SlashCommandBuilder()
        .setName('today')
        .setDescription("See today's chores by area"),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply()

        const today: Date = new Date()
        let currentAreaId: string | null = null
        let lastDoneEmbed: EmbedBuilder | null = null

        const message = await interaction.editReply({
            content: "Select an area to see today's chores:",
            components: [buildAreaRow()]
        })

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 10 * 60 * 1000
        })

        async function handleSelectArea(
            i: StringSelectMenuInteraction
        ): Promise<void> {
            await i.deferUpdate()

            currentAreaId = i.values[0]
            lastDoneEmbed = null

            const area: Area | undefined = areas.find(
                (a) => a.id === currentAreaId
            )
            const areaName: string = area?.name ?? 'Unknown Area'

            const {
                completed,
                due
            }: { completed: ChoreCompletion[]; due: Chore[] } =
                await getChoresByAreaForToday(currentAreaId, today)

            await interaction.editReply({
                content: '',
                embeds: [buildEmbed(areaName, completed, due, today)],
                components: [
                    buildAreaRow(currentAreaId),
                    ...(due.length > 0 ? [buildChoreRow(due)] : [])
                ]
            })
        }

        async function handleCompleteChore(
            i: StringSelectMenuInteraction
        ): Promise<void> {
            if (!currentAreaId) return
            await i.deferUpdate()

            const choreId: string = i.values[0]
            const area: Area | undefined = areas.find(
                (a) => a.id === currentAreaId
            )
            const areaName: string = area?.name ?? 'Unknown Area'

            const { due }: { due: Chore[] } = await getChoresByAreaForToday(
                currentAreaId,
                today
            )
            const chore: Chore | undefined = due.find((c) => c.id === choreId)

            if (!chore) {
                await i.followUp({
                    content: 'That chore is already completed!',
                    flags: MessageFlags.Ephemeral
                })
                return
            }

            const user = await getOrCreateUser(i.user.id)

            const record: ChoreCompletion = await markCompleted({
                choreId: chore.id,
                inchargeId: user.id,
                isCover: false,
                completedById: user.id,
                pointsAwarded: chore.points
            })

            lastDoneEmbed = buildDoneEmbed(
                chore.name,
                i.user.id,
                record.pointsAwarded
            )

            const {
                completed,
                due: dueAfter
            }: { completed: ChoreCompletion[]; due: Chore[] } =
                await getChoresByAreaForToday(currentAreaId, today)

            await interaction.editReply({
                embeds: [
                    buildEmbed(areaName, completed, dueAfter, today),
                    lastDoneEmbed
                ],
                components: [
                    buildAreaRow(currentAreaId),
                    ...(dueAfter.length > 0 ? [buildChoreRow(dueAfter)] : [])
                ]
            })
        }

        const handlers: Record<
            string,
            (i: StringSelectMenuInteraction) => Promise<void>
        > = {
            select_area: handleSelectArea,
            complete_chore: handleCompleteChore
        }

        collector.on('collect', (i: StringSelectMenuInteraction) => {
            void handlers[i.customId]?.(i)
        })

        collector.on('end', () => {
            void interaction.editReply({ components: [] }).catch(() => {})
        })
    }
})
