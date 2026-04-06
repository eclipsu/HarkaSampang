import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    EmbedBuilder
} from 'discord.js'
import ApplicationCommand from '../templates/ApplicationCommand.js'

import { findAllAreas } from '../repositories/AreaRepository.js'
import {
    createChore,
    findAllChoresByArea
} from '../repositories/ChoreRepository.js'

import convertTZ from '../helpers/ConvertTimezone.js'

export enum ChoreRecurrence {
    DAILY = 'daily',
    WEEKLY = 'weekly',
    BIWEEKLY = 'biweekly'
}

const areas = await findAllAreas()

export default new ApplicationCommand({
    data: new SlashCommandBuilder()
        .setName('chore')
        .setDescription('Chore commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((sub) =>
            sub
                .setName('create')
                .setDescription('Create a new chore')
                .addStringOption((o) =>
                    o
                        .setName('name')
                        .setDescription(
                            'Chore name e.g. Clean Kitchen, Take Out Trash, Dust Living Room'
                        )
                        .setRequired(true)
                )
                .addStringOption((o) =>
                    o
                        .setName('area')
                        .setDescription(
                            'Area the chore belongs to e.g. Kitchen, Bathroom, Hallway'
                        )
                        .addChoices(
                            ...areas.map((area) => ({
                                name: area.name,
                                value: area.id
                            }))
                        )
                        .setRequired(true)
                )
                .addStringOption((o) =>
                    o
                        .setName('points')
                        .setDescription(
                            'Points awarded for completing the chore'
                        )
                        .setRequired(true)
                )
                .addStringOption((o) =>
                    o
                        .setName('recurrence')
                        .setDescription('How often the chore should be done Ex')
                        .addChoices(
                            { name: 'DAILY', value: 'daily' },
                            { name: 'EVERYDAY', value: 'weekly' },
                            { name: 'WEEKLY', value: 'weekly' },
                            { name: 'BIWEEKLY', value: 'biweekly' }
                        )
                )
        )

        .addSubcommand((sub) =>
            sub
                .setName('delete')
                .setDescription('Delete a chore')
                .addStringOption((o) =>
                    o
                        .setName('name')
                        .setDescription('Name of the chore to delete')
                        .setRequired(true)
                        .addChoices(
                            ...areas.map((area) => ({
                                name: area.name,
                                value: area.id
                            }))
                        )
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('list')
                .setDescription('Delete a chore')
                .addStringOption((o) =>
                    o
                        .setName('area')
                        .setDescription(
                            "Choose what area's chores you want to see"
                        )
                        .setRequired(true)
                        .addChoices(
                            ...areas.map((area) => ({
                                name: area.name,
                                value: area.id
                            }))
                        )
                )
        ),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ ephemeral: true })

        const sub = interaction.options.getSubcommand()

        if (sub === 'create') {
            const name = interaction.options.getString('name', true).trim()
            const areaId = interaction.options.getString('area', true)
            const points = interaction.options.getString('points', true)
            const recurrence = interaction.options.getString('recurrence')
            const selectedArea = areas.find((area) => area.id === areaId)

            await createChore({
                name,
                areaId,
                points: parseInt(points, 10),
                recurrence: recurrence as ChoreRecurrence
            })

            const embed = new EmbedBuilder()
                .setColor(0x57f287)
                .setDescription(
                    `A new chore has been added to the ${
                        selectedArea?.name || 'Unknown'
                    } area.`
                )
                .addFields(
                    {
                        name: '🧹 Chore ',
                        value: `\`${name}\``,
                        inline: true
                    },
                    {
                        name: '📍 Area',
                        value: selectedArea
                            ? `\`${selectedArea.name}\``
                            : '`Unknown`',
                        inline: true
                    },
                    {
                        name: '⭐ Points',
                        value: `\`${points}\``,
                        inline: true
                    }
                )
                .setFooter({
                    text: `Created by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp()

            if (recurrence) {
                embed.addFields({
                    name: '🔁 Recurrence',
                    value: `\`${recurrence.toUpperCase()}\``,
                    inline: true
                })
            }

            await interaction.editReply({ embeds: [embed] })
        }

        if (sub === 'list') {
            const areaId = interaction.options.getString('area', true)
            const chores = await findAllChoresByArea(areaId)

            // Get area name from the first chore or find it in areas array
            const areaName =
                chores[0]?.area?.name ||
                areas.find((a) => a.id === areaId)?.name ||
                'Unknown Area'

            if (!chores || chores.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xfee75c)
                    .setTitle('📋 No Chores Found')
                    .setDescription(
                        `There are no chores in the **${areaName}** area yet.\n\nUse \`/chore create\` to add one.`
                    )
                    .setTimestamp()

                await interaction.editReply({ embeds: [embed] })
                return
            }

            const recurrenceEmojis: Record<string, string> = {
                daily: '📅',
                weekly: '📆',
                biweekly: '🗓️'
            }

            const embed = new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle(`🧹 ${areaName} Chores`)
                .setDescription(
                    `Here are all the active chores in the **${areaName}** area:`
                )
                .setTimestamp()

            chores.forEach((chore, index) => {
                const recurrenceEmoji = chore.recurrence
                    ? recurrenceEmojis[chore.recurrence] || '🔄'
                    : ''

                const recurrenceText = chore.recurrence
                    ? `${recurrenceEmoji} ${chore.recurrence.toUpperCase()}`
                    : '⚪ No recurrence set'

                embed.addFields({
                    name: `${index + 1}. ${chore.name}`,
                    value: `⭐ **${chore.points}** points • ${recurrenceText}${
                        chore.penaltyPoints
                            ? `\n⚠️ Penalty: **${chore.penaltyPoints}** points`
                            : ''
                    }${
                        chore.createdAt
                            ? `\n🕐 Created: <t:${Math.floor(
                                  convertTZ(
                                      chore.createdAt,
                                      'America/Chicago'
                                  ).getTime() / 1000
                              )}:R>`
                            : ''
                    }`,
                    inline: true
                })
            })

            await interaction.editReply({ embeds: [embed] })
        }
    }
})
