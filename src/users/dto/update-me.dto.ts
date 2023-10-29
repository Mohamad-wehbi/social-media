import { IsString, IsEmail, MinLength, IsOptional } from 'class-validator';

export class UpdateMeDto {

    @IsOptional()
    @IsString()
    @MinLength(2)
    username: string

    @IsOptional()
    @IsEmail()
    email: string

    @IsOptional()
    @IsString()
    @MinLength(10)
    bio: string

    @IsOptional()
    @IsString()
    @MinLength(2)
    livesin: string

    @IsOptional()
    @IsString()
    @MinLength(2)
    worksAt: string
}