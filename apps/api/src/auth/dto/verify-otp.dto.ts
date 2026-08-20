import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'کد تأیید باید فقط شامل عدد باشد.' })
  code!: string;
}
