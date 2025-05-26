import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VerificationService } from './verification.service';
import { File } from 'multer';
import { AdminVerifyDto } from './dto';
import { SessionGuard, AdminRoleGuard } from '../../common/guards';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @UseGuards(SessionGuard)
  async verify(
    @UploadedFile() file: File,
    @Body('userId') userId: string,
    @Body('documentType') documentType: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!userId || !documentType) {
      throw new BadRequestException('userId and documentType are required');
    }
    if (documentType !== 'id_card' && documentType !== 'drivers_license') {
      throw new BadRequestException('Invalid documentType');
    }
    return await this.verificationService.verifyUser(
      userId,
      file,
      documentType,
    );
  }

  @Post('admin')
  @UseGuards(SessionGuard, AdminRoleGuard)
  async adminVerify(@Body() verifyDto: AdminVerifyDto) {
    if (!verifyDto.documentId) {
      throw new BadRequestException('documentId is required');
    }

    return await this.verificationService.adminVerify(verifyDto);
  }
}
