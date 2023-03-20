import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Appointment,
  Availability,
  ContactUs,
  Replies,
  Role,
  Services,
  User,
} from '../../../entities';
import { Brackets, DataSource, ILike, Repository } from 'typeorm';

import {
  CreateAppointmentDto,
  CreateEmailDto,
  ReplyMailDto,
  SearchDoctorDto,
  VerifyAppointmentDto,
} from '../dto';

import { MailService } from '../../../mail/mail.service';
import { DeleteDto, ResponseDto, SearchUserDto } from '../../base/dto';
import { Roles } from '../../../enum';

@Injectable()
export class OtherService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly userRepository: Repository<User>,

    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Services)
    private readonly serviceRepository: Repository<Services>,
    @InjectRepository(Availability)
    private readonly availabilityRepository: Repository<Availability>,
    @InjectRepository(ContactUs)
    private readonly contactRepository: Repository<ContactUs>,
    @InjectRepository(Replies)
    private readonly replyRepository: Repository<Replies>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly mailService: MailService,
  ) {}

  public async getAll(query: SearchUserDto): Promise<ResponseDto> {
    const data = await this.contactRepository.find({
      where: !!query.search
        ? [
            {
              name: ILike(query.search + '%'),
            },
            {
              from: ILike(query.search + '%'),
            },
            {
              subject: ILike(query.search + '%'),
            },
          ]
        : undefined,
      skip: (query.page ?? 0) * (query.limit ?? 20),
      take: query.limit ?? 20,
    });

    const total = await this.contactRepository.count({
      where: !!query.search
        ? [
            {
              name: ILike(query.search + '%'),
            },
            {
              from: ILike(query.search + '%'),
            },
            {
              subject: ILike(query.search + '%'),
            },
          ]
        : undefined,
    });

    return {
      data,
      total,
    };
  }

  public async sendMail(data: CreateEmailDto) {
    const newContact = new ContactUs();
    Object.assign(newContact, data);
    await this.mailService.sendMail(data.from, data.subject, 'email', {});
    return await this.contactRepository.save(newContact);
  }

  public async getMail(id: string) {
    const contact = await this.contactRepository.findOne({
      where: {
        id,
      },
      relations: ['replies'],
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  public async replyMail(id: string, data: ReplyMailDto) {
    const contact = await this.contactRepository.findOne({
      where: {
        id,
      },
    });

    if (!contact) throw new NotFoundException('Contact not found');

    const newReply = new Replies();
    newReply.message = data.message;
    newReply.contact = contact;
    await this.mailService.sendMail(contact.from, contact.subject, 'reply', {
      name: contact.name,
      message: data.message,
      dateReplied:
        new Date().toDateString() + ' ' + new Date().toLocaleTimeString(),
    });

    return await this.replyRepository.save(newReply);
  }

  public async deleteMessage(data: DeleteDto) {
    const contacts = await this.contactRepository.findOne({
      where: data.ids.map((d) => ({ id: d })),
    });

    return await this.contactRepository.remove(contacts);
  }

  public async searchDoctor(data: SearchDoctorDto): Promise<ResponseDto> {
    const doctor = this.userRepository
      .createQueryBuilder('doctor')
      .leftJoinAndSelect('doctor.availability', 'availability')
      .leftJoinAndSelect('doctor.services', 'services');

    const count = this.userRepository
      .createQueryBuilder('doctor')
      .leftJoinAndSelect('doctor.availability', 'availability')
      .leftJoinAndSelect('doctor.services', 'services');

    if (!!data.id) {
      const whereCondition = new Brackets((sub) => {
        const query = `doctor.id = :id`;
        return sub.where(query, {
          id: data.id,
        });
      });

      doctor.andWhere(whereCondition);
      count.andWhere(whereCondition);
    }

    if (!!data.time) {
      const whereCondition = new Brackets((sub) => {
        const query = `TO_CHAR(availability.startDate + interval '${
          data.hoursBetweenUtc !== undefined ? data.hoursBetweenUtc : 8
        } hours', 'hh12:mi AM') LIKE :time OR TO_CHAR(availability.endDate + interval '${
          data.hoursBetweenUtc !== undefined ? data.hoursBetweenUtc : 8
        } hours', 'hh12:mi AM') LIKE :time`;
        return sub.where(query, {
          time: `%${data.time}%`,
        });
      });

      doctor.andWhere(whereCondition);
      count.andWhere(whereCondition);
    }

    if (!!data.name) {
      const whereCondition = new Brackets((sub) => {
        const query = `LOWER(doctor.name) LIKE LOWER(:name) OR LOWER(doctor.position) LIKE LOWER(:name)`;
        return sub.where(query, {
          name: `${data.name}%`,
        });
      });

      doctor.andWhere(whereCondition);
      count.andWhere(whereCondition);
    }

    if (!!data.day) {
      const whereCondition = new Brackets((sub) => {
        const query = `to_char(availability.startDate + interval '${
          data.hoursBetweenUtc !== undefined ? data.hoursBetweenUtc : 8
        } hours', 'day') LIKE :day OR to_char(availability.endDate + interval '${
          data.hoursBetweenUtc !== undefined ? data.hoursBetweenUtc : 8
        } hours', 'day') LIKE :day`;
        return sub.where(query, {
          day: `%${data.day}%`,
        });
      });

      doctor.andWhere(whereCondition);
      count.andWhere(whereCondition);
    }

    const serviceWhereCondition = new Brackets((sub) => {
      const query = !!data.serviceId
        ? `services.id = :id`
        : 'services IS NOT NULL';
      return sub.where(query, {
        id: data.serviceId,
      });
    });

    doctor.andWhere(serviceWhereCondition);
    count.andWhere(serviceWhereCondition);

    if (data.page && data.limit) {
      doctor.skip(Number(data.page) * Number(data.limit));
      doctor.take(Number(data.limit));
    }

    return {
      data: await doctor.getMany(),
      total: await count.getCount(),
    };
  }

  public async getDoctorInfo(id: string, date: Date, hoursBetweenUtc?: number) {
    const doctor = await this.userRepository.findOne({
      where: { id, roles: { name: Roles.DOCTOR } },
      relations: ['roles'],
    });

    const timeBetween =
      hoursBetweenUtc !== undefined ? Number(hoursBetweenUtc) : 8;

    if (!doctor) throw new NotFoundException('Doctor not found');

    const currDate = new Date(date);
    currDate.setHours(currDate.getHours() + timeBetween);

    doctor.hasAm = !!doctor.availability.some((d) => {
      const startDate = new Date(d.startDate);
      const endDate = new Date(d.endDate);

      startDate.setHours(startDate.getHours() + timeBetween);
      endDate.setHours(endDate.getHours() + timeBetween);

      return (
        currDate.getDay() === startDate.getDay() &&
        (startDate.getHours() < 12 || endDate.getHours() < 12)
      );
    });

    doctor.hasPm = !!doctor.availability.some((d) => {
      const startDate = new Date(d.startDate);
      const endDate = new Date(d.endDate);

      startDate.setHours(startDate.getHours() + timeBetween);
      endDate.setHours(endDate.getHours() + timeBetween);

      return (
        currDate.getDay() === startDate.getDay() &&
        (startDate.getHours() >= 12 || endDate.getHours() >= 12)
      );
    });

    return doctor;
  }

  public async setAppointment(id: string, data: CreateAppointmentDto) {
    const doctor = this.userRepository
      .createQueryBuilder('doctor')
      .leftJoinAndSelect('doctor.availability', 'availability')
      .leftJoinAndSelect('doctor.services', 'services')
      .leftJoinAndSelect('doctor.roles', 'roles');

    const mainWhereCondition = new Brackets((sub) => {
      const query = `(doctor.id = :id AND roles.name = :role AND services.id = :serviceId) AND (TO_CHAR(availability.startDate + interval '8 hours', 'hh12:mi AM') LIKE :time OR TO_CHAR(availability.endDate + interval '8 hours', 'hh12:mi AM') LIKE :time)`;
      return sub.where(query, {
        id,
        role: Roles.DOCTOR,
        time: `%${data.time}%`,
        serviceId: data.serviceId,
      });
    });

    doctor.andWhere(mainWhereCondition);

    const doctorData = await doctor.getOne();

    if (!doctorData) throw new NotFoundException('Doctor not found');

    const service = await this.serviceRepository.findOne({
      where: { id: data.serviceId },
    });

    if (!service) throw new NotFoundException('Service not found');

    const newAppointment = new Appointment();

    newAppointment.doctor = doctorData;
    newAppointment.service = service;
    newAppointment.email = data.email;
    newAppointment.message = data.message;
    newAppointment.name = data.name;
    newAppointment.time = data.time;
    newAppointment.date = new Date(data.date);
    newAppointment.refId = (
      new Date().getTime().toString(36) + Math.random().toString(36).slice(8)
    ).toUpperCase();
    newAppointment.verification = Math.random()
      .toString(36)
      .slice(2)
      .toUpperCase();

    const savedData = await this.appointmentRepository.save(newAppointment);

    await this.mailService.sendMail(
      savedData.email,
      'Please verify your appointment',
      'verification',
      {
        name: savedData.name,
        code: savedData.verification,
      },
    );

    delete savedData.refId;
    delete savedData.verification;

    return savedData;
  }

  public async verifyAppointment(id: string, data: VerifyAppointmentDto) {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
    });

    if (!appointment) throw new NotFoundException('Appointment not found');

    if (appointment.verification === data.verification) {
      appointment.verification = null;
      await this.mailService.sendMail(
        appointment.email,
        'Your booking is now verified',
        'verified',
        {
          name: appointment.name,
          code: appointment.refId,
        },
      );
      return await this.appointmentRepository.save(appointment);
    }

    throw new BadRequestException('Invalid verification code');
  }

  public async refreshVerification(id: string) {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
    });

    if (!appointment) throw new NotFoundException('Appointment not found');

    appointment.verification = Math.random()
      .toString(36)
      .slice(2)
      .toUpperCase();

    const savedData = await this.appointmentRepository.save(appointment);

    await this.mailService.sendMail(
      savedData.email,
      'Please verify your appointment',
      'verification',
      {
        name: savedData.name,
        code: savedData.verification,
      },
    );

    delete savedData.refId;
    delete savedData.verification;

    return savedData;
  }
}
