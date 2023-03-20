import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  OneToMany,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

import { Role } from './role.entity';
import { Availability } from './availability.entity';
import { Services } from './services.entity';
import { Appointment } from './appointment.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ unique: true })
  email: string;

  @Exclude()
  @Column({ nullable: true })
  password: string;

  @Column({ nullable: true })
  position: string;

  @Column({ default: true })
  verified?: boolean;

  @Exclude()
  @Column({ nullable: true, default: null })
  code?: string;

  @ManyToMany(() => Role, (role) => role.users, {
    eager: true,
  })
  @JoinTable({
    name: 'user_role',
    joinColumn: { name: 'userId' },
    inverseJoinColumn: { name: 'roleId' },
  })
  roles: Role[];

  @ManyToMany(() => Services, (service) => service.users, {
    eager: true,
  })
  @JoinTable({
    name: 'user_service',
    joinColumn: { name: 'userId' },
    inverseJoinColumn: { name: 'serviceId' },
  })
  services: Services[];

  @OneToMany(() => Availability, (availability) => availability.user, {
    eager: true,
  })
  @JoinTable({
    name: 'availability',
    joinColumn: { name: 'userId' },
    inverseJoinColumn: { name: 'id' },
  })
  availability: Availability[];

  @Exclude()
  @OneToMany(() => Appointment, (appointment) => appointment.doctor)
  appointment: Appointment[];

  public hasAm?: boolean;
  public hasPm?: boolean;

  @CreateDateColumn()
  created: Date;

  @UpdateDateColumn()
  modified: Date;
}
