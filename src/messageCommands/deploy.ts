/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { readdirSync } from 'fs'
import 'dotenv/config'

import type ApplicationCommand from '../templates/ApplicationCommand.js'
import MessageCommand from '../templates/MessageCommand.js'
import { REST } from '@discordjs/rest'
import { RESTPostAPIApplicationCommandsJSONBody, Routes } from 'discord.js'

// configuration from JSON
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const config = require('../config.json') as { prefix: string }

const { TOKEN, CLIENT_ID, OWNER_ID } = process.env as {
    TOKEN: string
    CLIENT_ID: string
    OWNER_ID: string
}

export default new MessageCommand({
    name: 'deploy',
    description: 'Deploys the slash commands',

    async execute(message, args): Promise<void> {
        if (message.author.id !== OWNER_ID) {
            await message.reply({
                content: 'You are not authorized to use this command.'
            })
            return
        }

        if (!args[0]) {
            await message.reply({
                content: `Incorrect number of arguments! The correct format is \`${config.prefix}deploy <guild|global>\``
            })
            return
        }

        const mode = args[0].toLowerCase()
        if (mode !== 'global' && mode !== 'guild') {
            await message.reply({
                content: 'Invalid mode. Use `global` or `guild`.'
            })
            return
        }

        console.log(`Deploying ${mode} commands by ${message.author.tag}`)

        // Collect all command data
        const commands: RESTPostAPIApplicationCommandsJSONBody[] = []
        const commandFiles = readdirSync('./commands').filter(
            (file) => file.endsWith('.js') || file.endsWith('.ts')
        )

        for (const file of commandFiles) {
            const commandModule = await import(`../commands/${file}`)
            const command = commandModule.default as ApplicationCommand
            if (command?.data) {
                commands.push(command.data.toJSON())
            }
        }

        if (commands.length === 0) {
            await message.reply({ content: 'No commands found to deploy.' })
            return
        }

        const rest = new REST({ version: '10' }).setToken(TOKEN)

        try {
            console.log(`Started refreshing ${mode} application (/) commands.`)

            if (mode === 'global') {
                await rest.put(Routes.applicationCommands(CLIENT_ID), {
                    body: commands
                })
                console.log(
                    'Successfully reloaded **global** application (/) commands.'
                )
                await message.reply({ content: 'Global commands deployed!' })
            } else {
                const guildId = message.guild?.id
                if (!guildId) {
                    await message.reply({
                        content:
                            'Cannot deploy to guild — no guild ID available.'
                    })
                    return
                }
                await rest.put(
                    Routes.applicationGuildCommands(CLIENT_ID, guildId),
                    { body: commands }
                )
                console.log(
                    `Successfully reloaded commands in guild ${guildId}.`
                )
                await message.reply({ content: 'Guild commands deployed!' })
            }
        } catch (error) {
            console.error('Deployment failed:', error)
            await message.reply({
                content: `Deployment failed: ${String(error).slice(0, 1000)}`
            })
        }
    }
})
