import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddStoryDto } from './dto';

@Injectable()
export class StoriesService {
  constructor(private prisma: PrismaService, private cloudinary: CloudinaryService) {}

  private selectUser(){return {select: {id:true, username:true, profilePicUrl:true }}}
  private populateUser(){return {include:{user:this.selectUser()}}}

  async addStory(id:number, data:AddStoryDto, file: Express.Multer.File){
    if(!file) throw new BadRequestException("The image is required!");
    const {url: image, public_id: imageId} = await this.cloudinary.uploadFile(file);
    const story = await this.prisma.story.create({data:{userId:id, image, imageId, ...data}});
    return {data: story, message: "The story has been added successfully"}
  }

  async deleteStory(id:number, storyId:number){
    const story = await this.prisma.story.findFirst({where:{id:storyId, userId:id}});
    if(!story) throw new ForbiddenException("invalid request");
    await this.cloudinary.deleteImg(story.imageId);
    await this.prisma.story.delete({where:{id:storyId}});
    return {message: "The story has been deleted successfully"}
  }

  async getStories(id:number){
    const lastDay = Date.now() - (24 * 60 * 60 * 1000); // 1d
    let stories = await this.prisma.story.findMany({where:{createdAt:{lte: new Date(lastDay)}}});
    const imagesIds = stories.map((story)=> story.imageId);
    imagesIds.forEach(async(imageId)=> await this.cloudinary.deleteImg(imageId))
    await this.prisma.story.deleteMany({where:{createdAt:{lte: new Date(lastDay)}}});
    stories = await this.prisma.story.findMany({
      where:{user:{followers:{every:{userId: id}}}}, ...this.populateUser()});
    return { data: stories, message: "Successfully done" };
  }

}
