import { IsNotEmpty, IsNumber, IsString, MinLength } from "class-validator";

export class CreateCommentDto {

    @IsNotEmpty()
    @IsString()
    @MinLength(10)
    text:string

    @IsNotEmpty()
    @IsNumber()
    postId:number
}