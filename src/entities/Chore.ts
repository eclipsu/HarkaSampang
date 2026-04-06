import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Relation
} from 'typeorm'

import { Area } from './Area.js'

export enum ChoreRecurrence {
    DAILY = 'daily',
    WEEKLY = 'weekly',
    BIWEEKLY = 'biweekly'
}

@Entity('chores')
export class Chore {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ nullable: true })
    areaId: string

    @Column({ nullable: true })
    createdById: string

    @Column()
    name: string

    @Column()
    points: number

    @Column({ nullable: true })
    penaltyPoints: number

    @Column({ type: 'enum', enum: ChoreRecurrence, nullable: true })
    recurrence: ChoreRecurrence

    @Column({ default: true })
    isActive: boolean

    @CreateDateColumn()
    createdAt: Date

    @ManyToOne(() => Area, (area) => area.chores, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'areaId' })
    area: Relation<Area>
}
