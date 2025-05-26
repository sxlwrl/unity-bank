import {
  Injectable,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { S3Service } from '../s3';
import { File } from 'multer';
import { PrismaService } from '../prisma';
import { ClientProxy } from '@nestjs/microservices';
import { AdminVerifyDto } from './dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class VerificationService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  async verifyUser(
    userId: string,
    file: File,
    documentType: string,
  ): Promise<any> {
    try {
      const fileUrl = await this.s3Service.uploadFile(file);

      const document = await this.prisma.document.create({
        data: {
          userId,
          documentType: documentType as any,
          documentNumber: '',
          issuedDate: new Date(),
          expiryDate: new Date(),
          fileUrl,
          status: 'pending',
        },
      });

      return { userId, document };
    } catch (error: any) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async adminVerify(verifyDto: AdminVerifyDto) {
    const document = await this.prisma.document.findUnique({
      where: { id: verifyDto.documentId },
    });
    if (!document) throw new Error('Document not found');

    const updatedDocument = await this.prisma.document.update({
      where: { id: verifyDto.documentId },
      data: {
        status: verifyDto.action === 'approve' ? 'approved' : 'rejected',
      },
    });

    if (verifyDto.action === 'approve') {
      await firstValueFrom(
        this.userClient.send(
          { cmd: 'change-user-status' },
          { userId: document.userId, status: 'active' },
        ),
      );
    }

    return {
      userId: document.userId,
      documentId: verifyDto.documentId,
      document: updatedDocument,
    };
  }
}
