import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateMeDto, UpdatePasswordDto } from './dto';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import QueryBuilder from 'src/features/feature';
import * as argon from 'argon2';


@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private cloudinary: CloudinaryService) {}

  private followingMessage(name:string){return `${name} started following you`}
  private visitMessage(name:string){return `${name} visited your profile`}

  private selectUser(){return{select: {id:true, username:true, profilePicUrl:true }}}
  private selectfollowed(){return{select: {id:true, username:true, userImg:true }}}
  private populateUser(){return {include:{user:this.selectUser()}}}
  private populatePost(){return{include:{comments:this.populateUser(),likes:this.populateUser()}}}
  private populateAll(){
    return{
      include:{
        followers: this.selectfollowed(), 
        following: this.selectfollowed(), 
        posts: this.populatePost()
    }}}

  private filterProp(user:any){
    delete user.password;
    delete user.passResetCode;
    delete user.passResetExpires;
    delete user.passResetVerified;
    delete user.role;
    delete user.profilePicId;
    delete user.coverPicId;
    return user; 
  }


  async getUsers(query: any) {
    const usersCount =  await this.countOfUsers();
    const {queryBuild, paginationResult} = new QueryBuilder(query, usersCount).filter().sort().select().paginate();
    const users = await this.prisma.user.findMany({...queryBuild, ...this.selectUser()});
    return {data: users, usersCount, paginationResult};
  }
  
  async getUser(userId: number, id?:number) {
    const user = await this.prisma.user.findUnique({where:{id:userId}, ...this.populateAll()});
    if(id != userId && id){
      const me = await this.prisma.user.findUnique({where:{id}});
      const myData = {username: me.username, userImg: me.profilePicUrl, userId: id};
      await this.prisma.user.update({where:{id:userId}, data:{
        notifications:{create:{...myData, message:this.visitMessage(myData.username)}}}})
    }
    return { data: this.filterProp(user) }  
  }

  async countOfUsers(){ return await this.prisma.user.count() }
  getMe(id: number){ return this.getUser(id) }
  deleteMe(id: number){ return this.deleteUser(id) }

  async deleteUser(id: number){
    const user = await this.prisma.user.delete({where:{id}, include: {posts: true}});
    if(user.profilePicId) await this.cloudinary.deleteImg(user.profilePicId);
    if(user.coverPicId) await this.cloudinary.deleteImg(user.coverPicId);
    if(user.posts.length) user.posts.map(async(post)=> await this.cloudinary.deleteImg(post.imageId));
    return { message: "Deleted successfully" };
  }

  async updateMe(id: number, data: UpdateMeDto){
    if(data.email){
      const user = await this.prisma.user.findUnique({where:{email:data.email}});
      if(user) throw new ForbiddenException("There is really email!");
    }
    const user = await this.prisma.user.update({where:{id}, data });
    return { data: this.filterProp(user), message: "updated successfully" };
  }

  async updatePassword(id: number, data: UpdatePasswordDto){
    let {password, oldPassword, confirmPassword} = data;
    if(password != confirmPassword)throw new BadRequestException("Invalid confirm password");
    let user = await this.prisma.user.findFirst({where:{id}});
    if(!user || !await argon.verify(user.password, oldPassword)) 
    throw new BadRequestException("Invalid old password");
    password = await argon.hash(password);
    user = await this.prisma.user.update({where:{id}, data:{password}});
    return { message: "The password has been updated" };
  }

  async changeProfilePic(id: number, file: Express.Multer.File){
    if(!file) throw new BadRequestException("Profile image is required!");
    let user = await this.prisma.user.findUnique({where:{id}});
    if(user.profilePicId) await this.cloudinary.deleteImg(user.profilePicId);
    const fileImg = await this.cloudinary.uploadFile(file);
    const {url: profilePicUrl, public_id: profilePicId} = fileImg
    user = await this.prisma.user.update({where:{id}, data:{profilePicUrl, profilePicId}});
    return {data: this.filterProp(user), message: "The profile image has been updated" };
  }

  async changeCoverPic(id: number, file: Express.Multer.File){
    if(!file) throw new BadRequestException("Cover image is required!");
    let user = await this.prisma.user.findUnique({where:{id}});
    if(user.coverPicId) await this.cloudinary.deleteImg(user.coverPicId);
    const fileImg = await this.cloudinary.uploadFile(file);
    const {url: coverPicUrl, public_id: coverPicId} = fileImg
    user = await this.prisma.user.update({where:{id}, data:{coverPicUrl, coverPicId}});
    return {data: this.filterProp(user), message: "The cover image has been updated" };
  }

  async deleteProfilePic(id: number){
    let user = await this.prisma.user.findUnique({where:{id}});
    if(!user.profilePicId)throw new BadRequestException("There is no profile image!");
    await this.cloudinary.deleteImg(user.profilePicId);
    user = await this.prisma.user.update({where:{id}, data: {
      profilePicUrl: "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460__480.png",
      profilePicId: null }});
    return { message: "The profile image has been deleted" };  
  }

  async deleteCoverPic(id: number){
    let user = await this.prisma.user.findUnique({where:{id}});
    if(!user.coverPicId)throw new BadRequestException("There is no cover image!");
    await this.cloudinary.deleteImg(user.coverPicId);
    user = await this.prisma.user.update({where:{id}, data: {
      coverPicUrl: "https://flowbite.com/docs/images/examples/image-3@2x.jpg",
      coverPicId: null }});
    return { message: "The cover image has been deleted" };  
  }

  async followUser(id: number, userId: number){
    const user = await this.prisma.user.findUnique({where:{id: userId}, include:{followers:true}});
    const me = await this.prisma.user.findUnique({where:{id}, include:{following:true}});
    const follower = user.followers.find((el) => el.userId == id);
    const followed = me.following.find((el) => el.userId == userId);

    if(!follower && !followed && id != userId){
      const userData = {username: user.username, userImg: user.profilePicUrl, userId};
      await this.prisma.user.update({where:{id},data:{following:{create:[userData]}}});
      const myData = {username: me.username, userImg: me.profilePicUrl, userId: id};
      await this.prisma.user.update({where:{id: userId},data: {followers: {create: [myData]}}});
      await this.prisma.user.update({where:{id:userId}, data:{
        notifications:{create:{...myData, message:this.followingMessage(myData.username)}}
      }})

    }else{
      await this.prisma.user.update({where:{id: userId},data: {followers: {delete: {id:follower.id}}}});
      await this.prisma.user.update({where:{id}, data: {following: {delete: {id: followed.id }}}});
    }
    return {message:`${user.username} has been ${follower?"UnFollowed":"Followed"}`};
  }
}

