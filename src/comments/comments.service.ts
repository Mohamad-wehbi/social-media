import { ForbiddenException, Injectable } from '@nestjs/common';
import QueryBuilder from 'src/features/feature';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCommentDto, UpdateCommentDto } from './dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}
  private commentMessage(name:string){return `${name} commented on your post`}
  private selectUser(){return{user: {select: {id:true, username:true, profilePicUrl:true }}}}

  async getComments(query:any) {
    const commentsCount = await this.commentsCount();
    const {queryBuild, paginationResult} = new QueryBuilder(query, commentsCount).filter().select().sort().paginate();
    const comments = await this.prisma.comment.findMany({...queryBuild, include: this.selectUser()});
    return {data: comments, commentsCount, paginationResult};
  }

  async commentsCount(){
    return await this.prisma.comment.count();
  }

  async createComment(id:number, data:CreateCommentDto){
    const content = {userId:id, postId:data.postId, text:data.text}
    const comment = await this.prisma.comment.create({data:content, include:{user:true, post:true}});
    
    if(comment.user.id !== comment.post.userId){
      const myData = {username: comment.user.username, userImg: comment.user.profilePicUrl, userId: id};
      await this.prisma.user.update({where:{id:comment.post.userId}, data:{
        notifications:{create:{...myData, message:this.commentMessage(myData.username)}}}});
    }
    return {data: comment, message:"Created successfully"}
  }

  async updateComment(id:number, commentId:number, data:UpdateCommentDto){
    let comment = await this.prisma.comment.findFirst({where:{id:commentId, userId:id}});
    if(!comment) throw new ForbiddenException("invalid request!");
    comment = await this.prisma.comment.update({where:{id: commentId}, data});
    return {data: comment, message:"Updated successfully"}
  }

  async deleteMyComment(id:number, commentId:number){
    let comment = await this.prisma.comment.findFirst({where:{id:commentId, userId:id}});
    if(!comment) throw new ForbiddenException("invalid request!");
    await this.prisma.comment.delete({where:{id: commentId}});
    return {message:"deleted successfully"}
  }

  async deleteComment(commentId:number){
    await this.prisma.comment.delete({where:{id: commentId}});
    return {message:"deleted successfully"}
  }
}
