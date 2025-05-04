import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Delete,
  Patch,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto';
import { SessionGuard } from '../../common/guards';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() data: any) {
    return this.userService.create(data);
  }

  @UseGuards(SessionGuard)
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.userService.delete(id);
  }

  @UseGuards(SessionGuard)
  @Patch(':id')
  async updateProfile(
    @Param('id') id: string,
    @Body() data: UpdateProfileDto,
    @Req() req,
  ) {
    return this.userService.updateProfile(id, data);
  }
}
