import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseMonthPipe implements PipeTransform {
  transform(value: string | undefined): number | undefined {
    if (value === undefined || value === '') return undefined;
    const month = parseInt(value, 10);
    if (isNaN(month) || month < 1 || month > 12) {
      throw new BadRequestException('month must be between 1 and 12');
    }
    return month;
  }
}
