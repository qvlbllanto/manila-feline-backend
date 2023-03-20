import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Patch,
  Query,
  Body,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Param } from '@nestjs/common/decorators';
import { Roles } from '../../../decorators/roles.decorator';
import {
  CreateEmailDto,
  DateDto,
  ReplyMailDto,
  SearchDoctorDto,
  CreateAppointmentDto,
  VerifyAppointmentDto,
} from '../dto';
import { OtherService } from '../services/other.service';
import { Roles as RoleTypes } from '../../../enum';
import { Parameter } from '../../../helpers';
import { MailService } from '../../../mail/mail.service';

import { SearchUserDto, DeleteDto } from '../../base/dto';

@ApiTags('other')
@Controller('other')
export class OtherController {
  constructor(
    private readonly otherService: OtherService,
    private readonly mailService: MailService,
  ) {}

  @Post('mail')
  public async sendMail(@Body() data: CreateEmailDto) {
    return await this.otherService.sendMail(data);
  }

  @Roles(RoleTypes.ADMIN)
  @Get('mail')
  public async getAllMessage(@Query() data: SearchUserDto) {
    return await this.otherService.getAll(data);
  }

  @Roles(RoleTypes.ADMIN)
  @Get('mail/' + Parameter.id())
  public async getMessage(
    @Param('id')
    id: string,
  ) {
    return await this.otherService.getMail(id);
  }

  @Roles(RoleTypes.ADMIN)
  @Patch('mail')
  public async deleteMessage(@Body() data: DeleteDto) {
    return await this.otherService.deleteMessage(data);
  }

  @Roles(RoleTypes.ADMIN)
  @Post('mail/' + Parameter.id() + '/reply')
  public async replyMail(
    @Param('id')
    id: string,
    @Body() data: ReplyMailDto,
  ) {
    return await this.otherService.replyMail(id, data);
  }

  @Get('doctor')
  public async getDoctors(@Query() data: SearchDoctorDto) {
    return await this.otherService.searchDoctor(data);
  }

  @Get('doctor/' + Parameter.id() + '/information')
  public async getDoctorInfo(
    @Param('id')
    id: string,
    @Query()
    data: DateDto,
  ) {
    return await this.otherService.getDoctorInfo(
      id,
      data.date,
      data.hoursBetweenUtc,
    );
  }

  @Post('doctor/' + Parameter.id() + '/set-an-appoinment')
  public async setAppointment(
    @Param('id')
    id: string,
    @Body()
    data: CreateAppointmentDto,
  ) {
    return await this.otherService.setAppointment(id, data);
  }

  @Patch('verify/' + Parameter.id())
  public async verifyAppointment(
    @Param('id')
    id: string,
    @Body()
    data: VerifyAppointmentDto,
  ) {
    return await this.otherService.verifyAppointment(id, data);
  }

  @Patch('refresh/' + Parameter.id())
  public async refreshAppointment(
    @Param('id')
    id: string,
  ) {
    return await this.otherService.refreshVerification(id);
  }
}
