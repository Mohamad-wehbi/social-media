import { Body, Controller, Delete, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { User } from 'src/auth/decorators/user.decorator';
import { StoriesService } from './stories.service';
import { AuthGuard } from 'src/auth/guard/auth.guard';
import { AddStoryDto } from './dto';

@UseGuards(AuthGuard)
@Controller('stories')
export class StoriesController {
  constructor(private storyService: StoriesService){}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  addStory(@User("id") id:number, @Body() data:AddStoryDto, @UploadedFile() file:Express.Multer.File){
    return this.storyService.addStory(id, data, file);
  }

  @Delete(":id")
  deleteStory(@User("id") id:number, @Param("id") storyId:string){
    return this.storyService.deleteStory(id, +storyId);
  }

  @Get()
  getStories(@User("id") id:number){
    return this.storyService.getStories(id);
  }
}
