import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import QueryBuilder from 'src/features/feature';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePostDto, UpdatePostDto } from './dto';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService, private cloudinary: CloudinaryService) {}

  private likeMessage(name:string){return `${name} liked your post`};

  private selectUser(){return {select: {id:true, username:true, profilePicUrl:true }}}
  private populateUser(){return {include:{user:this.selectUser()}}}
  private populateAll(){
    return{
      include:{
        comments: this.populateUser(),
        user: this.selectUser(),
        likes: this.populateUser()
      }}}
  
  async getPosts(query: any) {
    const postsCount = await this.postsCount();
    const {queryBuild, paginationResult} = new QueryBuilder(query, postsCount).filter().sort().select().paginate();
    const posts = await this.prisma.post.findMany({...queryBuild, ...this.populateAll()});
    return {data: posts, postsCount, paginationResult};
  }

  async getFollowingPosts(id:number) {
    const posts = await this.prisma.post.findMany({
      where:{user:{followers:{every:{userId:id}}}}, ...this.populateAll()});  
    return {data: posts};
  }

  async createPost(id: number, data: CreatePostDto, file: Express.Multer.File){
    if(!file) throw new BadRequestException("The image is required!");
    const {url: image, public_id: imageId} = await this.cloudinary.uploadFile(file);
    const post = await this.prisma.post.create({ data: {userId: id, disc: data.disc, image, imageId}});
    return {data: post, message: "The post has been created" };
  }

  async changePostImg(id: number, postId: number, file: Express.Multer.File){
    if(!file) throw new BadRequestException("The image is required!");
    let post = await this.prisma.post.findFirst({where:{id: postId, userId: id}})
    if(!post) throw new ForbiddenException("invalid request!");

    await await this.cloudinary.deleteImg(post.imageId)
    const {url: image, public_id: imageId} = await this.cloudinary.uploadFile(file);
    post = await this.prisma.post.update({where:{id: postId}, data:{image, imageId}});
    return {data: post, message: "The post image has been updated" };
  }

  async changePostDisc(id: number, postId: number, data: UpdatePostDto){
    let post = await this.prisma.post.findFirst({where:{id: postId, userId: id}})
    if(!post) throw new ForbiddenException("invalid request!");

    post = await this.prisma.post.update({where:{id: postId}, data:{disc: data.disc}});
    return {data: post, message: "The post image has been updated" };
  }

  async deleteMyPost(id: number, postId: number){
    const post = await this.prisma.post.findFirst({where:{id: postId, userId: id}})
    if(!post) throw new ForbiddenException("invalid request!");

    await this.cloudinary.deleteImg(post.imageId)
    await this.prisma.post.delete({where:{id:postId}});
    return { message: "The post has been deleted" };
  }

  async deletePost(postId: number){
    const post = await this.prisma.post.delete({where:{id: postId}});
    await this.cloudinary.deleteImg(post.imageId)
    return { message: "The post has been deleted" };
  }

  async postsCount() {
    return await this.prisma.post.count();
  }

  async addlike(id:number, postId:number) {
    const like = await this.prisma.like.findFirst({where: {userId: id, postId}})
    if(like) await this.prisma.like.delete({where: {id: like.id}})
    else {
      const like = await this.prisma.like.create({data: {userId: id, postId}, include:{user:true, post:true}})

      if(like.user.id !== like.post.userId){
        const myData = {username: like.user.username, userImg: like.user.profilePicUrl, userId: id};
        await this.prisma.user.update({where:{id:like.post.userId}, data:{
          notifications:{create:{...myData, message:this.likeMessage(myData.username)}}}})
    }}
    return { message: `${like ? "Unlike" : "like"} successfully` };
  }
}
