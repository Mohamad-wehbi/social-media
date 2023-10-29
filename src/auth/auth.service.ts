import { Injectable, ForbiddenException, NotFoundException, InternalServerErrorException, HttpException, BadRequestException } from '@nestjs/common';
import * as argon from 'argon2';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SigninDto, SignupDto } from './dto';
import { createHash } from 'crypto';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService, 
    private jwt: JwtService, 
    private mail: MailService, 
    private config: ConfigService) {}

  private createToken(id: number, role: string){
    const secret = this.config.get("SECRET_KEY_JWT")
    return this.jwt.signAsync({id, role},{ secret })
  }

  private hashedResetCode(resetCode){
    return createHash("sha256").update(resetCode).digest("hex");
  }

  private filterProp(user:any){
    delete user.password;
    delete user.passResetCode;
    delete user.passResetExpires;
    delete user.passResetVerified;
    //delete user.role;
    delete user.profilePicId;
    delete user.coverPicId;
    return user;
  }

  async signup(data: SignupDto) {
    const { email } = data;
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (user)throw new ForbiddenException('Email already registered!');
    data.password = await argon.hash(data.password);
    user = await this.prisma.user.create({data})
    const token = await this.createToken(user.id, user.role);
    return {data: this.filterProp(user), token}
  }

  async signin(data: SigninDto){
    const {email, password} = data
    const user = await this.prisma.user.findUnique({where:{email}});
    if(!user || !await argon.verify(user.password, password))
    throw new ForbiddenException("invalid email or password");
    const token = await this.createToken(user.id, user.role);
    return {data: this.filterProp(user), token};
  }

  async forgotPassword(data:any){
    const {email} = data;
    const user = await this.prisma.user.findUnique({where:{email}})
    if(!user) throw new NotFoundException("there is no user for this email");
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    await this.mail.sendEmail(user.username, user.email, resetCode);

    await this.prisma.user.update({where:{id:user.id}, data: {
      passResetCode : this.hashedResetCode(resetCode),
      passResetExpires : Date.now() + 1440 * 60 * 1000, // 1d
      passResetVerified : false
    }})
    return { message: "reset code sent to email" };
  }

  async verifyResetCode(data:any){
    const {resetCode} = data;
    const user = await this.prisma.user.findFirst({where:{
      passResetCode: this.hashedResetCode(resetCode),
      passResetExpires: {gt: Date.now()},
    }})
    if(!user) throw new BadRequestException("Reset code invalid or expired");
    await this.prisma.user.update({where:{id:user.id}, data:{passResetVerified: true}});
    return { message: "The reset code is valid" };
  }

  async resetPassword(data:any){
    let {email, newPassword, confirmNewPassword} = data;
    if(newPassword != confirmNewPassword)throw new BadRequestException("invalid confirm new password ");
    const user = await this.prisma.user.findFirst({where:{email, passResetVerified: true}})
    if(!user) throw new ForbiddenException("You are not allowed to reset password");
    newPassword = await argon.hash(newPassword);
    await this.prisma.user.update({where:{id: user.id}, data:{
      password: newPassword,
      passResetCode: undefined,
      passResetExpires: undefined,
      passResetVerified: undefined
    }})
    return {message: "The password has been updated successfully"};
  }
}
