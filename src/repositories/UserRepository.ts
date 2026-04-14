import { AppDataSource } from '../database.js'
import { User } from '../entities/User.js'
import dateDiffInDays from '../helpers/DaysDifference.js'

const repo = AppDataSource.getRepository(User)

export async function createUser(
    discordUserId: string,
    isAdmin: boolean = false
): Promise<User> {
    const user = repo.create({ discordUserId, isAdmin })
    await repo.save(user)
    return user
}

export async function findUserByDiscordId(
    discordUserId: string
): Promise<User> {
    return repo.findOneOrFail({
        where: { discordUserId }
    })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getRoommates(serverId?: string): Promise<User[]> {
    const users = repo.find()
    return users
}

export async function incrementStreak(discordUserId: string) {
    await repo.manager.transaction(async (manager) => {
        const user = await manager.findOneOrFail(User, {
            where: { discordUserId },
            lock: { mode: 'pessimistic_write' }
        })
        const today = new Date()
        const lastActivity = user.lastActivity

        if (!lastActivity) user.streak = 1
        else {
            const daysDiff = dateDiffInDays(lastActivity, today)
            if (daysDiff == 0 || daysDiff == 1) {
                user.streak += 1
            } else {
                user.streak = 1
            }
            user.lastActivity = today
            await manager.save(user)
        }
    })
}

export async function getStreak(discordUserId: string): Promise<number> {
    const user = await repo.findOneOrFail({
        where: { discordUserId },
        select: ['streak']
    })
    return user.streak
}

export async function getOrCreateUser(discordUserId: string) {
    let user = await repo.findOne({ where: { discordUserId } })

    if (!user) {
        user = repo.create({ discordUserId })
        await repo.save(user)
    }

    return user
}
